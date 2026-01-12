#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function die(msg) {
  console.error("❌ " + msg);
  process.exit(1);
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
  die("Usage: npm run dc:summary -- <path/to/dc.json>   OR   npm run dc:summary -- --in <path/to/dc.json>");
}

const inPath = path.resolve(process.cwd(), inArg);

let dc;
try {
  dc = JSON.parse(fs.readFileSync(inPath, "utf8"));
} catch (e) {
  die(`Invalid JSON: ${inPath}\n${e.message}`);
}

const vms = dc?.compute?.vms || [];
const hosts = dc?.compute?.hosts || [];
const segments = dc?.network?.segments || [];
const datastores = dc?.storage?.datastores || [];

const vmVcpu = vms.reduce((a, v) => a + (Number(v.vcpus) || 0), 0);
const vmRam = vms.reduce((a, v) => a + (Number(v.ram_gb) || 0), 0);
const hostCores = hosts.reduce((a, h) => a + (Number(h.cpu_cores) || 0), 0);
const hostRam = hosts.reduce((a, h) => a + (Number(h.ram_gb) || 0), 0);

console.log(
  JSON.stringify(
    {
      meta: dc.meta || {},
      totals: {
        vms: vms.length,
        hosts: hosts.length,
        clusters: (dc?.compute?.clusters || []).length,
        networks: segments.length,
        datastores: datastores.length
      },
      capacity: {
        vm_total_vcpu: vmVcpu,
        vm_total_ram_gb: vmRam,
        host_total_cpu_cores: hostCores,
        host_total_ram_gb: hostRam
      },
      gaps: {
        network_segments_missing_cidr: segments.filter((s) => !s.cidr).length
      }
    },
    null,
    2
  )
);
