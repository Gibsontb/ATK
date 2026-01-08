// scripts/package.mjs
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const master = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "master", "master-matrix.json"), "utf8"));
const ver = master.catalog_version || "unknown";

const distDir = path.join(repoRoot, "dist");
fs.mkdirSync(distDir, { recursive: true });

const zipName = `ATK-${ver}.zip`;
const zipPath = path.join(distDir, zipName);

// Prefer system zip if available
function has(cmd){
  try { execSync(`${cmd} --version`, { stdio: "ignore" }); return true; } catch { return false; }
}

try{
  if (has("zip")){
    execSync(`zip -r "${zipPath}" . -x "node_modules/*" -x "dist/*" -x ".git/*"`, { cwd: repoRoot, stdio: "inherit" });
  } else {
    // Fallback: Node-based simple zip is not included; use PowerShell on Windows
    execSync(`powershell -Command "Compress-Archive -Path * -DestinationPath '${zipPath}' -Force"`, { cwd: repoRoot, stdio: "inherit" });
  }
  console.log("Packaged:", zipPath);
} catch (e){
  console.error("Packaging failed:", e.message);
  process.exit(1);
}
