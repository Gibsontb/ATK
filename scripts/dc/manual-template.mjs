#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function die(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

function getOutPath(argv) {
  const args = argv.slice(2);
  const outIdx = args.indexOf("--out");
  if (outIdx !== -1 && args[outIdx + 1]) return args[outIdx + 1];
  if (args[0] && !args[0].startsWith("-")) return args[0];
  return null;
}

const outArg = getOutPath(process.argv);
if (!outArg) {
  die("Usage: npm run dc:manual-template -- data/imports/manual/dc-import.manual.json");
}

const outPath = path.resolve(process.cwd(), outArg);

const template = {
  meta: {
    source: "manual-entry",
    export_time: new Date().toISOString(),
    notes: "Manual datacenter entry. Fill in hosts, VMs, datastores, and network segments."
  },
  compute: {
    clusters: [
      { cluster_id: "cl-01", name: "MainCluster", ha_enabled: true, drs_enabled: true }
    ],
    hosts: [
      {
        host_id: "esx-01",
        name: "esx01",
        cluster_id: "cl-01",
        cpu_sockets: 2,
        cpu_cores: 32,
        cpu_model: "Intel Xeon (optional)",
        ram_gb: 512,
        esxi_version: "8.0",
        nics: [
          { name: "vmnic0", speed_mbps: 10000, connected: true },
          { name: "vmnic1", speed_mbps: 10000, connected: true }
        ]
      }
    ],
    vms: [
      {
        vm_id: "vm-001",
        name: "app01",
        power_state: "poweredOn",
        guest_os: "Windows Server",
        vcpus: 4,
        ram_gb: 16,
        cluster_id: "cl-01",
        host_id: "esx-01",
        datastores: ["ds-01"],
        networks: ["seg-001"],
        nics: [
          { nic_id: "nic-1", segment_id: "seg-001", mac: "00:00:00:00:00:00", connected: true }
        ],
        disks: [
          { disk_id: "d1", size_gb: 200, thin_provisioned: true, datastore: "ds-01" }
        ],
        utilization: {
          cpu_avg_pct: null,
          cpu_max_pct: null,
          ram_avg_pct: null
        },
        tags: { env: "prod", app: "core" }
      }
    ]
  },
  network: {
    segments: [
      {
        segment_id: "seg-001",
        name: "VLAN100-App",
        vlan_id: 100,
        switch_name: "dvSwitch0",
        mtu: 1500,
        cidr: null,
        gateway: null,
        zone: "app"
      }
    ]
  },
  storage: {
    datastores: [
      {
        datastore_id: "ds-01",
        name: "Datastore01",
        type: "vmfs",
        capacity_gb: 10000,
        used_gb: 6500,
        tier: "gold",
        storage_policy: null
      }
    ]
  }
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });

if (fs.existsSync(outPath)) {
  die(`Refusing to overwrite existing file:\n${outPath}\nMove it or delete it, then re-run.`);
}

fs.writeFileSync(outPath, JSON.stringify(template, null, 2), "utf8");
console.log("✅ Wrote manual template:", outPath);
