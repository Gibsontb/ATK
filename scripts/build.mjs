// scripts/build.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const masterPath = path.join(repoRoot, "data", "master", "master-matrix.json");
const master = JSON.parse(fs.readFileSync(masterPath, "utf8"));

const rows = master.rows || [];

const providers = ["aws","azure","gcp","oci"];
const providerDisplay = { aws:"AWS", azure:"Azure", gcp:"Google Cloud", oci:"Oracle Cloud" };

function slug(s){
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
}

function uniq(arr){
  return [...new Set(arr)];
}

// Build equivalency JSON
const eqOut = {
  catalog_version: master.catalog_version,
  generated_at: new Date().toISOString(),
  rows
};

fs.mkdirSync(path.join(repoRoot, "generated"), { recursive: true });
fs.writeFileSync(path.join(repoRoot, "generated", "equivalency.generated.json"), JSON.stringify(eqOut, null, 2), "utf8");

// Build provider inventories
for (const p of providers){
  const items = [];
  for (const r of rows){
    const svcs = (r.providers && r.providers[p]) ? r.providers[p] : [];
    for (const svc of svcs){
      items.push({
        id: `${p}.${slug(svc)}`,
        name: svc,
        category: r.domain,
        capability_id: r.capability_id,
        capability_name: r.capability_name,
        status: r.status || "active"
      });
    }
  }
  const out = {
    provider: p,
    provider_name: providerDisplay[p],
    catalog_version: master.catalog_version,
    generated_at: new Date().toISOString(),
    services: uniq(items.map(i=>JSON.stringify(i))).map(s=>JSON.parse(s))
  };
  fs.writeFileSync(path.join(repoRoot, "generated", `${p}.services.generated.json`), JSON.stringify(out, null, 2), "utf8");
}

// Build browser bundle that is compatible with existing navigator (window.CDK.providers.*)
const cdks = {};
for (const p of providers){
  const inv = JSON.parse(fs.readFileSync(path.join(repoRoot, "generated", `${p}.services.generated.json`), "utf8"));
  const categories = {};
  for (const s of inv.services){
    categories[s.category] = categories[s.category] || [];
    categories[s.category].push({ id: s.id, category: s.category, name: s.name });
  }
  cdks[p] = {
    id: p,
    displayName: providerDisplay[p],
    serviceCategories: categories
  };
}

const js = `// web/generated/catalog.generated.js
// Generated from data/master/master-matrix.json
(function(){
  window.CDK = window.CDK || {};
  window.CDK.providers = window.CDK.providers || {};
  const providers = ${JSON.stringify(cdks, null, 2)};
  for (const k in providers){
    window.CDK.providers[k] = providers[k];
  }
  window.ATK = window.ATK || {};
  window.ATK.catalogVersion = ${JSON.stringify(master.catalog_version)};
  window.ATK.generatedAt = ${JSON.stringify(new Date().toISOString())};
})();`;

fs.mkdirSync(path.join(repoRoot, "web", "generated"), { recursive: true });
fs.writeFileSync(path.join(repoRoot, "web", "generated", "catalog.generated.js"), js, "utf8");

const versionJs = `// web/generated/version.generated.js
(function(){
  window.ATK = window.ATK || {};
  window.ATK.catalogVersion = ${JSON.stringify(master.catalog_version)};
  window.ATK.generatedAt = ${JSON.stringify(new Date().toISOString())};
})();`;
fs.writeFileSync(path.join(repoRoot, "web", "generated", "version.generated.js"), versionJs, "utf8");

console.log("ATK build complete:", master.catalog_version);
