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

  // positional fallback:
  //  args[0] = input
  //  args[1] = overrides (if present and not a flag)
  if (!out.inPath && args[0] && !args[0].startsWith("-")) out.inPath = args[0];
  if (!out.overridesPath && args[1] && !args[1].startsWith("-")) out.overridesPath = args[1];

  return out;
}

const { inPath: inArg, overridesPath: ovArg, outPath: outArg } = parseArgs(process.argv);
if (!inArg) {
  die("Usage: npm run dc:plan -- <dc.json> [<overrides.json>] [--out <plan.json>]");
}

const inPath = path.resolve(process.cwd(), inArg);
const dc = readJson(inPath);

const ovPath = ovArg ? path.resolve(process.cwd(), ovArg) : null;
const ov = ovPath ? readJson(ovPath) : {};

const target = ov?.target || {};
const cloud = target.cloud || "aws";
const region = target.region || "us-east-1";

const vms = dc?.compute?.vms || [];
const segments = dc?.network?.segments || [];
const datastores = dc?.storage?.datastores || [];

const segmentMap = ov?.network_overrides?.segment_map || {};
const vmMap = ov?.workload_overrides?.vm_map || {};
const dsMap = ov?.storage_overrides?.datastore_map || {};

const plan = {
  meta: {
    generated_time: new Date().toISOString(),
    version: "dc-plan/0.2.0",
    generator: "scripts/dc/plan.mjs"
  },
  inputs: {
    cloud,
    region,
    import_source: dc?.meta?.source || null,
    export_time: dc?.meta?.export_time || null,
    policy: ov?.policy_overrides || {}
  },
  network: {
    segments: segments.map((s) => {
      const o = segmentMap[s.segment_id] || {};
      return {
        segment_id: s.segment_id,
        source_name: s.name,
        name: o.rename || s.name,
        vlan_id: s.vlan_id ?? null,
        cidr: o.cidr || s.cidr || null,
        gateway: o.gateway || s.gateway || null,
        zone: o.zone || s.zone || null,
        target_vpc: o.target_vpc || null,
        target_subnet_role: o.target_subnet_role || null
      };
    })
  },
  compute: {
    workloads: vms.map((vm) => {
      const o = vmMap[vm.vm_id] || {};
      const disksTotalGb = Array.isArray(vm.disks)
        ? vm.disks.reduce((a, d) => a + (Number(d.size_gb) || 0), 0)
        : null;

      return {
        name: vm.name,
        source_vm_id: vm.vm_id,
        target_pattern: o.target_pattern || "rehost",
        sizing: {
          vcpus: o.vcpus ?? vm.vcpus ?? null,
          ram_gb: o.ram_gb ?? vm.ram_gb ?? null,
          disks_total_gb: disksTotalGb
        },
        utilization: vm.utilization || null,
        networks: vm.networks || [],
        datastores: vm.datastores || []
      };
    })
  },
  storage: {
    datastores: datastores.map((ds) => {
      const o = dsMap[ds.datastore_id] || {};
      return {
        datastore_id: ds.datastore_id,
        name: ds.name,
        type: ds.type,
        tier: o.tier || ds.tier || null,
        cloud_storage_class: o.cloud_storage_class || null,
        capacity_gb: ds.capacity_gb ?? null,
        used_gb: ds.used_gb ?? null
      };
    })
  },
  explain: {
    warnings: [
      ...(segments.some((s) => !(segmentMap[s.segment_id]?.cidr || s.cidr))
        ? ["Some network segments have no CIDR; set CIDRs in overrides before final subnet/VPC synthesis."]
        : []),
      ...(vms.some((v) => !v.utilization)
        ? ["Some VMs have no utilization metrics; rightsizing will be conservative until utilization is provided/imported."]
        : [])
    ]
  }
};

const outPath = outArg
  ? path.resolve(process.cwd(), outArg)
  : path.resolve(process.cwd(), "reports", `cloud-plan.${Date.now()}.json`);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(plan, null, 2), "utf8");
console.log("✅ Wrote plan:", outPath);
