\# ATK Data Layout: Raw vs Normalized



ATK always separates raw tool exports from normalized inputs used by the pipeline.



\## Raw exports (never edited)

`data/raw/\*\*`



Examples:

\- `data/raw/vmware/rvtools/acme-2026q1/vInfo.csv`

\- `data/raw/vmware/rvtools/acme-2026q1/vHost.csv`

\- `data/raw/ipam/acme-2026q1/subnets.csv`



Raw exports can be:

\- CSV

\- XLSX

\- JSON

\- PDF



ATK does not run planning directly from raw exports.



\## Normalized inputs (what ATK runs on)

`data/imports/\*\*`



Examples:

\- `data/imports/acme-2026q1/dc-import.normalized.json`



This MUST validate with:

`npm run dc:validate -- data/imports/acme-2026q1/dc-import.normalized.json`



\## Overrides (human edits)

`data/overrides/\*\*`



Examples:

\- `data/overrides/acme-2026q1.overrides.json`



\## Generated reports (build output)

`reports/\*\*`



Examples:

\- `reports/dc-plan/cloud-plan.123456.json`

\- `reports/acme-2026q1/gaps.json`



Do not commit `reports/` to git.



