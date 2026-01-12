#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { readCsv } from "./_csv.mjs";

function die(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

function normKey(s) {
  return (s ?? "").toString().trim().toLowerCase();
}

function findCol(row, candidates) {
  // candidates are lowercase normalized
  const keys = Object.keys(row || {});
  const map = new Map(keys.map((k) => [normKey(k), k]));
  for (const c of candidates) {
    if (map.has(c)) return map.get(c);
  }
  // fuzzy contains
  for (const c of candidates) {
    for (const k of keys) {
      if (normKey(k).includes(c)) return k;
    }
  }
  return null;
}

function pick(row, candidates, def = "") {
  const col = findCol(row, candidates);
  if (!col) return def;
  return (row[col] ?? "").toString().trim();
}

function toInt(x, def = 0) {
  const n = parseInt(String(x).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : def;
}

function toNum(x, def = 0) {
  const s = String(x).trim();
  if (!s) return def;
  const n = Number(s.replace(/,/g, "").replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : def;
}

function mbToGb(mb) {
  const n = toNum(mb, 0);
  return n ? n / 1024 : 0;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listFiles(dir) {
  return fs.readdirSync(dir).map((f) => path.join(dir, f));
}

function findFileCI(dir, baseName) {
  const wanted = baseName.toLowerCase();
  for (const f of listFiles(dir)) {
    const bn = path.basename(f).toLowerCase();
    if (bn === wanted) return f;
  }
  return null;
}

function inferExportName(rawDir) {
  // rawDir may end in .../rvtools/<exportName>
  return path.basename(rawDir);
}

function main() {
  const args = process.argv.slice(2);

  // Usage:
  // node scripts/ingest/vmware-rvtools.mjs <rawFolder> [<exportName>]
  if (!args[0]) {
    die("Usage: npm run ingest:rvtools -- <data/raw/vmware/rvtools/<exportName>>");
  }

  const rawFolder = path.resolve(process.cwd(), args[0]);
  if (!fs.existsSync(rawFolder) || !fs.statSync(rawFolder).isDirectory()) {
    die(`Raw folder not found: ${rawFolder}`);
  }

  const exportName = args[1] || inferExportName(rawFolder);

  const vInfoPath = findFileCI(rawFolder, "vInfo.csv");
  const vHostPath = findFileCI(rawFolder, "vHost.csv");
  const vDatastorePath = findFileCI(rawFolder, "vDatastore.csv");
  const vNetworkPath = findFileCI(rawFolder, "vNetwork.csv");

  const gaps = {
    exportName,
    missing_files: [],
    missing: {
      vm_cluster: 0,
      vm_host: 0,
      vm_network: 0,
      vm_datastore: 0,
      segments_missing_vlan: 0,
      segments_missing_cidr: 0,
      datastores_missing_capacity: 0,
      datastores_missing_used: 0
    },
    notes: []
  };

  if (!vInfoPath) gaps.missing_files.push("vInfo.csv");
  if (!vHostPath) gaps.missing_files.push("vHost.csv");
  if (!vDatastorePath) gaps.missing_files.push("vDatastore.csv");
  if (!vNetworkPath) gaps.missing_files.push("vNetwork.csv");

  // We can still build partial output, but warn.
  if (gaps.missing_files.length) {
    gaps.notes.push("Some RVTools tabs are missing; output will be partial.");
  }

  const vInfo = vInfoPath ? readCsv(vInfoPath) : [];
  const vHost = vHostPath ? readCsv(vHostPath) : [];
  const vDatastore = vDatastorePath ? readCsv(vDatastorePath) : [];
  const vNetwork = vNetworkPath ? readCsv(vNetworkPath) : [];

  // Build lookup maps
  const clusterNameToId = new Map();
  const hostNameToId = new Map();
  const datastoreNameToId = new Map();
  const segmentNameToId = new Map();

  function getOrMakeId(map, prefix, name) {
    const key = (name ?? "").trim();
    if (!key) return null;
    if (!map.has(key)) map.set(key, `${prefix}-${String(map.size + 1).padStart(3, "0")}`);
    return map.get(key);
  }

  // NETWORK SEGMENTS
  const segments = [];
  for (const row of vNetwork) {
    const name = pick(row, ["portgroup", "network", "network name", "name"]);
    if (!name) continue;

    const vlanRaw = pick(row, ["vlan", "vlan id", "vlanid"]);
    const vlan = vlanRaw ? toInt(vlanRaw, null) : null;

    const sw = pick(row, ["vswitch", "dvswitch", "switch", "switch name", "distributed switch"], "");
    const mtuRaw = pick(row, ["mtu"], "");
    const mtu = mtuRaw ? toInt(mtuRaw, null) : null;

    const segment_id = getOrMakeId(segmentNameToId, "seg", name);
    segments.push({
      segment_id,
      name,
      vlan_id: vlan,
      switch_name: sw || null,
      mtu,
      cidr: null,
      gateway: null,
      zone: null
    });

    if (vlan === null) gaps.missing.segments_missing_vlan++;
    gaps.missing.segments_missing_cidr++; // always null until override or IPAM import
  }

  // DATASTORES
  const datastores = [];
  for (const row of vDatastore) {
    const name = pick(row, ["datastore", "datastore name", "name"]);
    if (!name) continue;

    const type = pick(row, ["type"], "unknown") || "unknown";

    // RVTools commonly uses MB columns; accept MB or GB
    const capMB = pick(row, ["capacity mb", "capacity"], "");
    const capGB = pick(row, ["capacity gb"], "");
    const freeMB = pick(row, ["free mb", "free"], "");
    const freeGB = pick(row, ["free gb"], "");
    const usedMB = pick(row, ["used mb", "used"], "");
    const usedGB = pick(row, ["used gb"], "");

    let capacity_gb = 0;
    if (capGB) capacity_gb = toNum(capGB, 0);
    else if (capMB) capacity_gb = mbToGb(capMB);

    let used_gb = 0;
    if (usedGB) used_gb = toNum(usedGB, 0);
    else if (usedMB) used_gb = mbToGb(usedMB);
    else {
      // try capacity - free
      let free_gb = 0;
      if (freeGB) free_gb = toNum(freeGB, 0);
      else if (freeMB) free_gb = mbToGb(freeMB);
      if (capacity_gb && free_gb) used_gb = Math.max(0, capacity_gb - free_gb);
    }

    const datastore_id = getOrMakeId(datastoreNameToId, "ds", name);

    datastores.push({
      datastore_id,
      name,
      type,
      capacity_gb: capacity_gb || null,
      used_gb: used_gb || null,
      tier: null,
      notes: null
    });

    if (!capacity_gb) gaps.missing.datastores_missing_capacity++;
    if (!used_gb) gaps.missing.datastores_missing_used++;
  }

  // HOSTS
  const hosts = [];
  for (const row of vHost) {
    const name = pick(row, ["host", "name", "hostname"]);
    if (!name) continue;

    const clusterName = pick(row, ["cluster"], "");
    const cluster_id = clusterName ? getOrMakeId(clusterNameToId, "cl", clusterName) : null;

    const cpuModel = pick(row, ["cpu model", "model"], "") || null;
    const sockets = toInt(pick(row, ["cpu sockets", "sockets"], "0"), 0);
    const cores = toInt(pick(row, ["cpu cores", "cores"], "0"), 0);

    const memMB = pick(row, ["memory mb", "memory size", "memory"], "");
    const memGB = pick(row, ["memory gb"], "");
    const ram_gb = memGB ? toNum(memGB, 0) : mbToGb(memMB);

    const esxi = pick(row, ["esxi version", "version"], "") || null;
    const pwr = pick(row, ["powerstate", "power state"], "") || null;

    const host_id = getOrMakeId(hostNameToId, "esx", name);

    hosts.push({
      host_id,
      name,
      cluster_id: cluster_id || "cl-unknown",
      cpu_sockets: sockets || 0,
      cpu_cores: cores || 0,
      cpu_model: cpuModel,
      ram_gb: ram_gb || 0,
      esxi_version: esxi,
      power_state: pwr
    });

    if (!cluster_id) {
      gaps.missing.vm_cluster++; // counts as cluster gap in overall; still useful
    }
  }

  // CLUSTERS (from names we saw)
  const clusters = [];
  for (const [name, id] of clusterNameToId.entries()) {
    clusters.push({
      cluster_id: id,
      name,
      ha_enabled: null,
      drs_enabled: null,
      notes: null
    });
  }
  if (!clusters.length) {
    clusters.push({ cluster_id: "cl-unknown", name: "UNKNOWN", ha_enabled: null, drs_enabled: null, notes: "No cluster data found" });
  }

  // VMS
  const vms = [];
  for (const row of vInfo) {
    const name = pick(row, ["vm", "name", "vm name"]);
    if (!name) continue;

    const power = pick(row, ["powerstate", "power state"], "") || null;
    const guest = pick(row, ["os according", "guest os", "os"], "") || null;

    const vcpu = toInt(pick(row, ["num cpu", "vcpu", "cpus", "cpu"], "0"), 0);

    // RAM often in MB
    const memMB = pick(row, ["memory", "memory mb", "memorymb"], "");
    const memGB = pick(row, ["memory gb"], "");
    const ram_gb = memGB ? toNum(memGB, 0) : mbToGb(memMB);

    const clusterName = pick(row, ["cluster"], "");
    const hostName = pick(row, ["host"], "");

    const cluster_id = clusterName ? getOrMakeId(clusterNameToId, "cl", clusterName) : null;
    const host_id = hostName ? getOrMakeId(hostNameToId, "esx", hostName) : null;

    const dsName = pick(row, ["datastore"], "");
    const ds_id = dsName ? getOrMakeId(datastoreNameToId, "ds", dsName) : null;

    // network fields vary: Network, Network 1, Portgroup, etc
    const netName =
      pick(row, ["network 1", "network", "portgroup", "network name"], "") ||
      "";

    const seg_id = netName ? getOrMakeId(segmentNameToId, "seg", netName) : null;

    const vm_id = `vm-${String(vms.length + 1).padStart(4, "0")}`;

    vms.push({
      vm_id,
      name,
      power_state: power,
      guest_os: guest,
      vcpus: vcpu,
      ram_gb: ram_gb,
      cluster_id: cluster_id || "cl-unknown",
      host_id: host_id || null,
      datastores: ds_id ? [ds_id] : [],
      networks: seg_id ? [seg_id] : [],
      disks: [],
      tags: {}
    });

    if (!cluster_id) gaps.missing.vm_cluster++;
    if (!host_id) gaps.missing.vm_host++;
    if (!seg_id) gaps.missing.vm_network++;
    if (!ds_id) gaps.missing.vm_datastore++;
  }

  // Ensure any segments/datastores discovered from vInfo are represented even if vNetwork/vDatastore missing
  for (const [name, id] of segmentNameToId.entries()) {
    if (!segments.some((s) => s.segment_id === id)) {
      segments.push({ segment_id: id, name, vlan_id: null, switch_name: null, mtu: null, cidr: null, gateway: null, zone: null });
      gaps.missing.segments_missing_vlan++;
      gaps.missing.segments_missing_cidr++;
    }
  }
  for (const [name, id] of datastoreNameToId.entries()) {
    if (!datastores.some((d) => d.datastore_id === id)) {
      datastores.push({ datastore_id: id, name, type: "unknown", capacity_gb: null, used_gb: null, tier: null, notes: "Discovered from vInfo only" });
      gaps.missing.datastores_missing_capacity++;
      gaps.missing.datastores_missing_used++;
    }
  }

  const normalized = {
    meta: {
      source: "rvtools",
      export_time: new Date().toISOString(),
      notes: `Imported from RVTools folder: ${rawFolder}`,
      version: "1.0.0",
      export_name: exportName
    },
    compute: { clusters, hosts, vms },
    network: { segments },
    storage: { datastores }
  };

  // Output
  const importsDir = path.resolve(process.cwd(), "data", "imports", exportName);
  const reportsDir = path.resolve(process.cwd(), "reports", exportName);

  ensureDir(importsDir);
  ensureDir(reportsDir);

  const outImport = path.join(importsDir, "dc-import.normalized.json");
  const outGaps = path.join(reportsDir, "gaps.json");

  fs.writeFileSync(outImport, JSON.stringify(normalized, null, 2), "utf8");
  fs.writeFileSync(outGaps, JSON.stringify(gaps, null, 2), "utf8");

  console.log("✅ Wrote normalized import:", outImport);
  console.log("✅ Wrote gaps report:", outGaps);

  // Tip for next steps
  console.log("Next:");
  console.log(`  npm run dc:validate -- ${path.relative(process.cwd(), outImport)}`);
  console.log(`  npm run dc:summary  -- ${path.relative(process.cwd(), outImport)}`);
  console.log(`  npm run dc:plan     -- ${path.relative(process.cwd(), outImport)} data/overrides/dc-overrides.json`);
}

main();
