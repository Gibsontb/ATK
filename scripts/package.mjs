import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const distDir = path.join(repoRoot, "dist");
fs.mkdirSync(distDir, { recursive: true });

const master = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "master", "master-matrix.json"), "utf8"));
const zipName = `ATK_${master.catalog_version}.zip`;
const zipPath = path.join(distDir, zipName);

if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

// Use system zip if available
try {
  execSync(`zip -r "${zipPath}" . -x "node_modules/*" "dist/*"`, { cwd: repoRoot, stdio: "inherit" });
  console.log("Packaged:", zipPath);
} catch (e) {
  // fallback: just copy notice
  console.error("zip not available in this environment. Package manually from repo root.");
  process.exit(1);
}
