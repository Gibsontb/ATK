// scripts/validate.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const masterPath = path.join(repoRoot, "data", "master", "master-matrix.json");
const master = JSON.parse(fs.readFileSync(masterPath, "utf8"));

if (!master.catalog_version) throw new Error("master-matrix.json missing catalog_version");
if (!Array.isArray(master.rows)) throw new Error("master-matrix.json rows must be an array");

const ids = new Set();
for (const r of master.rows){
  if (!r.capability_id || !r.capability_name || !r.domain) throw new Error("Row missing domain/capability_name/capability_id");
  if (ids.has(r.capability_id)) throw new Error("Duplicate capability_id: " + r.capability_id);
  ids.add(r.capability_id);
  if (!r.providers) throw new Error("Row missing providers: " + r.capability_id);
}

console.log(`Validation passed: ${master.rows.length} rows, version ${master.catalog_version}`);
