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
    die(`Invalid JSON: ${p}\nTip: if the file begins with "MZ", it's binary.\n${e.message}`);
  }
}

function isNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}
function isInt(x) {
  return Number.isInteger(x) && x >= 0;
}

function getInputPath(argv) {
  const args = argv.slice(2);
  const inIdx = args.indexOf("--in");
  if (inIdx !== -1 && args[inIdx + 1]) return args[inIdx + 1];
  if (args[0] && !args[0].startsWith("-")) return args[0];
  return null;
}

const inArg = getInputPath(process.argv);
if (!inArg) {
  die("Usage: npm run dc:validate -- <path/to/dc.json>");
}
const inPath = path.resolve(process.cwd(), inArg);

const dc = readJson(inPath);

// top-level
if (!dc.meta || !dc.compute || !dc.network || !dc.storage) {
  die("Missing required top-level sections: meta/compute/network/storage");
}
if (!dc.meta.source || !dc.meta.export_time) {
  die("meta.source and meta.export_time are required");
}

// compute
if (!Array.isArray(dc.compute.clusters)) die("compute.clusters must be an array");
if (!Array.isArray(dc.compute.hosts)) die("compute.hosts must be an array");
if (!Array.isArray(dc.compute.vms)) die("compute.vms must be an array");

for (const h of dc.compute.hosts) {
  if (!h.host_id || !h.name || !h.cluster_id) die("Each host requires host_id, name, cluster_id");
  if (!isInt(h.cpu_cores)) die(`Host cpu_cores must be int >= 0 (host ${h.name})`);
  if (!isNum(h.ram_gb)) die(`Host ram_gb must be number (host ${h.name})`);
  // optional: cpu_sockets, nics[], hbas[]
}

for (const vm of dc.compute.vms) {
  if (!vm.vm_id || !vm.name) die("Each VM requires vm_id and name");
  if (!isInt(vm.vcpus)) die(`VM vcpus must be int >= 0 (vm ${vm.name})`);
  if (!isNum(vm.ram_gb)) die(`VM ram_gb must be number (vm ${vm.name})`);
  if (!Array.isArray(vm.networks)) die(`VM networks must be an array (vm ${vm.name})`);
  if (!Array.isArray(vm.disks)) die(`VM disks must be an array (vm ${vm.name})`);
  // optional: utilization{}, nics[], tags{}, datastores[]
}

// network
if (!Array.isArray(dc.network.segments)) die("network.segments must be an array");
for (const s of dc.network.segments) {
  if (!s.segment_id || !s.name) die("Each segment requires segment_id and name");
  if (s.vlan_id !== undefined && s.vlan_id !== null && !isInt(s.vlan_id)) {
    die(`segment vlan_id must be int or null (segment ${s.name})`);
  }
  // cidr may be null (normal)
}

// storage
if (!Array.isArray(dc.storage.datastores)) die("storage.datastores must be an array");
for (const ds of dc.storage.datastores) {
  if (!ds.datastore_id || !ds.name || !ds.type) die("Each datastore requires datastore_id, name, type");
  if (ds.capacity_gb !== undefined && ds.capacity_gb !== null && !isNum(ds.capacity_gb)) die(`capacity_gb must be number (${ds.name})`);
  if (ds.used_gb !== undefined && ds.used_gb !== null && !isNum(ds.used_gb)) die(`used_gb must be number (${ds.name})`);
}

console.log("✅ Datacenter import is valid:", inPath);
