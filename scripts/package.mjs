import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const version = JSON.parse(fs.readFileSync("package.json","utf8")).version;
const outDir = "dist";
fs.mkdirSync(outDir, { recursive: true });
const zipName = `ATK_${version}.zip`;
const zipPath = path.join(outDir, zipName);

// Cross-platform zip creation
try{
  // prefer system zip if available
  execSync(`zip -r "${zipPath}" . -x "node_modules/*" -x "dist/*"`, { stdio: "inherit" });
}catch(e){
  // fallback to PowerShell on Windows
  try{
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path * -DestinationPath '${zipPath}' -Force"`, { stdio: "inherit" });
  }catch(e2){
    console.error("Unable to create zip. Install 'zip' or use PowerShell Compress-Archive.");
    process.exit(1);
  }
}

console.log("Packaged:", zipPath);
