\# VMware RVTools Export Map (ATK)



Goal: Ingest common RVTools exports into ATK's normalized datacenter import model:

`data/imports/<name>/dc-import.normalized.json`



ATK does NOT assume vCenter contains CIDRs. CIDRs are typically added via overrides or IPAM imports.



---



\## Export method (RVTools)

1\. Run RVTools against vCenter

2\. Export \*\*all tabs\*\* to CSV (recommended)

3\. Place the CSV files here:

&nbsp;  `data/raw/vmware/rvtools/<export\_name>/`



Example:

`data/raw/vmware/rvtools/acme-2026q1/vInfo.csv`



---



\## Minimum required tabs (to build a useful cloud plan)

\### 1) vInfo (VM inventory)

Purpose: workload sizing + mapping to networks and datastores.



Columns we need (common RVTools names; case-insensitive match):

\- VM / Name

\- Powerstate

\- OS according to the configuration file / Guest OS

\- Num CPU / vCPU

\- Memory / Memory MB

\- Provisioned MB (optional)

\- In Use MB (optional)

\- Cluster

\- Host

\- Datastore (sometimes separate tab is better)

\- Network 1 / Network (portgroup)

\- Resource pool (optional)

\- Folder (optional)

\- Annotation (optional)



ATK mapping:

\- compute.vms\[].name

\- compute.vms\[].power\_state

\- compute.vms\[].guest\_os

\- compute.vms\[].vcpus

\- compute.vms\[].ram\_gb

\- compute.vms\[].cluster\_id / cluster name mapping table

\- compute.vms\[].host\_id / host name mapping table

\- compute.vms\[].networks\[] (segment\_ids derived from portgroup list)

\- compute.vms\[].datastores\[] (datastore ids derived from datastore list)

\- compute.vms\[].tags (env/app extracted from naming or manual override)



Optional utilization mapping (if present):

\- cpu\_avg\_pct / cpu\_max\_pct (if RVTools provides performance columns in your version)

\- ram\_avg\_pct / active (if present)



---



\### 2) vHost (Host inventory)

Purpose: capacity + consolidation + HA inference.



Columns we need:

\- Host / Name

\- Cluster

\- CPU Model

\- CPU Sockets

\- CPU Cores

\- CPU Speed (optional)

\- Memory Size / Memory MB

\- ESXi Version

\- Powerstate (optional)



Optional:

\- NIC count / vmnic list (if exported)

\- HBA info (usually not needed for first pass)



ATK mapping:

\- compute.hosts\[].name

\- compute.hosts\[].cluster\_id

\- compute.hosts\[].cpu\_model

\- compute.hosts\[].cpu\_sockets

\- compute.hosts\[].cpu\_cores

\- compute.hosts\[].ram\_gb

\- compute.hosts\[].esxi\_version



---



\### 3) vDatastore (Datastore inventory)

Purpose: storage tier mapping + sizing.



Columns we need:

\- Datastore / Name

\- Type

\- Capacity MB / GB

\- Free MB / GB (optional)

\- Used MB / GB (optional)



ATK mapping:

\- storage.datastores\[].name

\- storage.datastores\[].type

\- storage.datastores\[].capacity\_gb

\- storage.datastores\[].used\_gb



Tier:

\- Set `tier` by naming convention or later overrides (gold/silver/bronze).



---



\### 4) vNetwork (Network / Portgroups)

Purpose: discover segments + VLAN ids.



Columns we need:

\- Portgroup / Network Name

\- VLAN / VLAN ID

\- vSwitch / dvSwitch

\- MTU (optional)



ATK mapping:

\- network.segments\[].name

\- network.segments\[].vlan\_id

\- network.segments\[].switch\_name

\- network.segments\[].mtu



CIDR/gateway:

\- typically missing → keep null and override later.



---



\## Recommended additional tabs (later)

\- vDisk: per-VMDK sizes/provisioning and datastore mapping (more accurate than vInfo alone)

\- vNIC: per-NIC mapping, MACs, connected state

\- vCluster: HA/DRS flags, EVC mode

\- vPartition / vMemory / vCPU performance tabs (if your RVTools version supports it)



---



\## Known gaps (normal)

\- CIDRs, gateways, routing: usually not in RVTools → use overrides or IPAM import

\- Firewall rules: separate export/import

\- App dependencies: separate inventory stage (manual grouping)



---



\## Next step in ATK

We will implement:

`scripts/ingest/vmware-rvtools.mjs`



Inputs:

\- folder containing RVTools CSV exports



Outputs:

\- `data/imports/<export\_name>/dc-import.normalized.json`

\- `reports/<export\_name>/gaps.json` (missing CIDR, missing datastore mapping, etc.)



