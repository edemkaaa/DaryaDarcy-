#!/usr/bin/env node
/** Extract Woolen webfont into the Expo and legacy Vite font directories. */
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "assets", "fonts");
const zipPath = process.env.WOOLEN_ZIP || join(process.env.USERPROFILE || "", "Downloads", "Woolen.zip");

if (!existsSync(zipPath)) {
  console.error("Woolen.zip not found:", zipPath);
  process.exit(1);
}

mkdirSync(assets, { recursive: true });

const py = `
import zipfile
from pathlib import Path
from fontTools.ttLib import TTFont
zip_path = r"${zipPath.replace(/\\/g, "\\\\")}"
assets = Path(r"${assets.replace(/\\/g, "\\\\")}")
assets.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(zip_path) as zf:
    woff2 = next(n for n in zf.namelist() if n.endswith(".woff2"))
    tmp = assets / "Woolen-webfont.woff2"
    tmp.write_bytes(zf.read(woff2))
    eula = next(n for n in zf.namelist() if "EULA" in n)
    (assets / "Woolen-EULA.txt").write_bytes(zf.read(eula))
font = TTFont(tmp)
font.save(assets / "Woolen-Regular.ttf")
font.save(assets / "Woolen-Regular.woff")
print("ok")
`;

execSync(`python -c "${py.replace(/"/g, '\\"')}"`, { stdio: "inherit" });

const siteFonts = join(root, "apps", "legacy-web", "public", "fonts");
mkdirSync(siteFonts, { recursive: true });
for (const name of ["Woolen-Regular.ttf", "Woolen-Regular.woff", "Woolen-webfont.woff2", "Woolen-EULA.txt"]) {
  copyFileSync(join(assets, name), join(siteFonts, name));
}
console.log("Woolen fonts: assets/fonts + apps/legacy-web/public/fonts");
