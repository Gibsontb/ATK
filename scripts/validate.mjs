import fs from "fs";

const master = JSON.parse(fs.readFileSync("data/master/master-matrix.json","utf8"));

let ok = true;
function fail(msg){ console.error("VALIDATION FAIL:", msg); ok = false; }

if(!master.rows || !Array.isArray(master.rows)) fail("master.rows missing/invalid");

const ids = new Set();
for(const r of master.rows){
  if(!r.capability_id) fail("Missing capability_id on a row");
  if(ids.has(r.capability_id)) fail("Duplicate capability_id: " + r.capability_id);
  ids.add(r.capability_id);
  if(!r.used_for || r.used_for.trim().length < 10) fail("used_for too short: " + r.capability_id);
  if(!r.providers) fail("providers missing: " + r.capability_id);
}

if(!ok) process.exit(1);
console.log("Validation passed:", master.rows.length, "rows");
