import fs from "fs";
import path from "path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const masterPath = path.join(repoRoot, "data", "master", "master-matrix.json");

const master = JSON.parse(fs.readFileSync(masterPath, "utf8"));
if (!master.rows || !Array.isArray(master.rows)) throw new Error("master.rows missing/invalid");

const ids = new Set();
for (const r of master.rows) {
  if (!r.capability_id) throw new Error("Row missing capability_id");
  if (ids.has(r.capability_id)) throw new Error("Duplicate capability_id: " + r.capability_id);
  ids.add(r.capability_id);
  if (!r.domain) throw new Error("Row missing domain");
  if (!r.providers) throw new Error("Row missing providers");
  for (const p of ["aws","azure","gcp","oci"]) {
    if (!Array.isArray(r.providers[p])) throw new Error(`providers.${p} must be an array for ${r.capability_id}`);
  }
}
console.log("Validation passed:", master.rows.length, "rows");
