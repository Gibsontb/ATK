#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function die(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}
function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    die(`Invalid JSON: ${p}\n${e.message}`);
  }
}
function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { inPath: null, overridesPath: null, outPath: null };

  // flags
  const inIdx = args.indexOf("--in");
  if (inIdx !== -1 && args[inIdx + 1]) out.inPath = args[inIdx + 1];

  const ovIdx = args.indexOf("--overrides");
  if (ovIdx !== -1 && args[ovIdx + 1]) out.overridesPath = args[ovIdx + 1];

  const outIdx = args.indexOf("--out");
  if (outIdx !== -1 && args[outIdx + 1]) out.outPath = args[outIdx + 1];

  // positional fallback
  if (!out.inPath && args[0] && !args[0].startsWith("-")) out.inPath = args[0];
  if (!out.overridesPath && args[1] && !args[1].startsWith("-")) out.overridesPath = args[1];

  return out;
}

function isNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

function ceilTo(x, step) {
  if (!isNum(x) || x <= 0) return x;
  return Math.ceil(x / step) * step;
}

function pickPolicy(ov) {
  const p = ov?.policy_overrides || {};
  return {
    data_classification: Array.isArray(p.data_classification) ? p.data_classification : [],
    internet_exposed: !!p.internet_exposed,
    rto_minutes: isNum(p.rto_minutes) ? p.rto_minutes : null,
    encryption_required: p.encryption_required ?? null
  };
}

function synthesizeNetwork(segments, ov) {
  const segMap = ov?.network_overrides?.segment_map || {};
  const warnings = [];

  // Group segments into VPCs:
  // - if override provides target_vpc -> use it
  // - else single default VPC
  const vpcNameDefault = ov?.target?.naming_prefix ? `${ov.target.naming_prefix}-primary` : "primary";

  const vpcsByName = new Map();

  for (const s of segments) {
    const o = segMap[s.segment_id] || {};
    const vpcName = o.target_vpc || vpcNameDefault;

    if (!vpcsByName.has(vpcName)) {
      vpcsByName.set(vpcName, { name: vpcName, cidr: null, subnets: [] });
    }

    const subnetName = o.rename || s.name;
    const cidr = o.cidr || s.cidr || null;
    const role = o.target_subnet_role || (s.zone ? String(s.zone) : "private");

    if (!cidr) warnings.push(`Segment '${s.name}' has no CIDR. Add it in overrides.network_overrides.segment_map.${s.segment_id}.cidr`);

    vpcsByName.get(vpcName).subnets.push({
      name: subnetName,
      cidr,
      role,
      source_segment_id: s.segment_id,
      vlan_id: s.vlan_id ?? null
    });
  }

  return { vpcs: Array.from(vpcsByName.values()), warnings };
}

function sizeWorkload(vm) {
  // Conservative default if no utilization
  const baseVcpu = isNum(vm.vcpus) ? vm.vcpus : 2;
  const baseRam = isNum(vm.ram_gb) ? vm.ram_gb : 4;

  const u = vm.utilization || null;

  // If utilization present, still do conservative headroom:
  // vCPU: round up by 25% headroom and minimum 2
  // RAM: round up by 25% and round to 1GB
  let recVcpu = baseVcpu;
  let recRam = baseRam;

  if (u && (isNum(u.cpu_max_pct) || isNum(u.cpu_avg_pct))) {
    // Without MHz we cannot compute exact cores needed; we use base vcpus with headroom.
    recVcpu = Math.max(2, Math.ceil(baseVcpu * 1.25));
  } else {
    recVcpu = Math.max(2, baseVcpu);
  }

  if (u && (isNum(u.ram_avg_pct) || isNum(u.ram_active_gb))) {
    recRam = Math.max(4, ceilTo(baseRam * 1.25, 1));
  } else {
    recRam = Math.max(4, ceilTo(baseRam, 1));
  }

  return { vcpus: recVcpu, ram_gb: recRam };
}

function awsRecommendInstance(vcpus, ramGb, policy) {
  // Very first-pass mapping (we will refine with pricing + perf later)
  // Families:
  // - general: m7i
  // - compute: c7i
  // - memory: r7i
  // With CJIS/internet_exposed we do not change family, but we will later enforce Nitro + encryption + private subnets.

  const wantMemoryHeavy = ramGb / Math.max(1, vcpus) >= 6;   // heuristic
  const wantComputeHeavy = ramGb / Math.max(1, vcpus) <= 2;  // heuristic

  let family = "m7i";
  if (wantMemoryHeavy) family = "r7i";
  else if (wantComputeHeavy) family = "c7i";

  // size: pick from common sizes by vCPU; keep it simple
  const sizeTable = [
    { v: 2, s: "large" },
    { v: 4, s: "xlarge" },
    { v: 8, s: "2xlarge" },
    { v: 16, s: "4xlarge" },
    { v: 32, s: "8xlarge" },
    { v: 48, s: "12xlarge" },
    { v: 64, s: "16xlarge" }
  ];

  let chosen = sizeTable[sizeTable.length - 1].s;
  for (const row of sizeTable) {
    if (vcpus <= row.v) { chosen = row.s; break; }
  }

  const instance = `${family}.${chosen}`;

  const notes = [];
  if (policy.internet_exposed) notes.push("Internet-exposed workload: ensure ALB/WAF and private subnets for instances unless explicitly required.");
  if (policy.data_classification.includes("CJIS")) notes.push("CJIS: enforce encryption at rest/in transit and restricted IAM; confirm region/compliance controls.");
  if (policy.rto_minutes !== null && policy.rto_minutes <= 60) notes.push("Tight RTO: consider Multi-AZ + backups/replication; later we’ll map to HA patterns.");

  return { instance, family, notes };
}

function main() {
  const { inPath: inArg, overridesPath: ovArg, outPath: outArg } = parseArgs(process.argv);
  if (!inArg) {
    die("Usage: npm run dc:enrich -- <dc-import.normalized.json> [<overrides.json>] [--out <file.json>]");
  }

  const inPath = path.resolve(process.cwd(), inArg);
  const dc = readJson(inPath);

  const ovPath = ovArg ? path.resolve(process.cwd(), ovArg) : null;
  const ov = ovPath ? readJson(ovPath) : {};

  const exportName =
    dc?.meta?.export_name ||
    path.basename(path.dirname(inPath)) ||
    "dc";

  const policy = pickPolicy(ov);

  const segments = dc?.network?.segments || [];
  const vms = dc?.compute?.vms || [];

  const net = synthesizeNetwork(segments, ov);

  const workloads = vms.map((vm) => {
    const sizing = sizeWorkload(vm);
    const aws = awsRecommendInstance(sizing.vcpus, sizing.ram_gb, policy);
    return {
      name: vm.name,
      source_vm_id: vm.vm_id,
      sizing,
      recommendation: {
        aws
      },
      networks: vm.networks || [],
      datastores: vm.datastores || [],
      utilization: vm.utilization || null
    };
  });

  const enriched = {
    meta: {
      generated_time: new Date().toISOString(),
      version: "dc-enrich/0.1.0",
      export_name: exportName
    },
    inputs: {
      policy,
      target: ov?.target || {}
    },
    network: {
      vpcs: net.vpcs
    },
    compute: {
      workloads
    },
    explain: {
      warnings: net.warnings
    }
  };

  const outPath = outArg
    ? path.resolve(process.cwd(), outArg)
    : path.resolve(process.cwd(), "reports", exportName, `enriched.${Date.now()}.json`);

  writeJson(outPath, enriched);
  console.log("✅ Wrote enriched report:", outPath);
  if (net.warnings.length) {
    console.log("⚠️ Warnings:");
    for (const w of net.warnings) console.log(" - " + w);
  }
}

main();
