import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync, writeFileSync, unlinkSync, copyFileSync, existsSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const root = join(projectRoot, "web-dist");
const privacySrc = join(projectRoot, "public", "privacy.html");
if (existsSync(privacySrc)) {
  copyFileSync(privacySrc, join(root, "privacy.html"));
  console.log("copied privacy.html");
}
const manifestSrc = join(projectRoot, "public", "manifest.webmanifest");
if (existsSync(manifestSrc)) {
  copyFileSync(manifestSrc, join(root, "manifest.webmanifest"));
  console.log("copied manifest.webmanifest");
}
const iconSrc = join(projectRoot, "assets", "images", "icon.png");
if (existsSync(iconSrc)) {
  copyFileSync(iconSrc, join(root, "apple-touch-icon.png"));
  console.log("copied apple-touch-icon.png");
}
const compressExt = new Set([".js", ".css", ".html", ".json", ".svg", ".txt", ".xml", ".mjs"]);

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const files = walk(root);
for (const file of files.filter((f) => f.endsWith(".html"))) {
  if (basename(file) === "privacy.html") continue;
  const before = readFileSync(file, "utf8");
  const shell =
    '<div style="flex:1;width:100%;height:100%;background:#FDF8F0"></div>';
  const responsive =
    "<style id=\"dd-responsive\">html,body{height:100%;margin:0;overflow:hidden;background:#cbbba6}#root{height:100%;width:100%;max-width:480px;margin:0 auto;background:#FDF8F0;overflow:hidden}@media(min-width:481px){#root{box-shadow:0 0 48px rgba(74,55,40,.22)}}</style>";
  let after = before.replace(
    /<div id="root">[\s\S]*<\/div>\s*(?=<script|<\/body>)/i,
    `<div id="root">${shell}</div>`,
  );
  if (!after.includes(`<div id="root">${shell}</div>`)) {
    after = before.replace(/<div id="root"><\/div>/, `<div id="root">${shell}</div>`);
  }
  if (!after.includes("id=\"dd-responsive\"")) {
    after = after.replace("</head>", `${responsive}</head>`);
  }
  if (!after.includes("apple-mobile-web-app-capable")) {
    const pwa =
      '<link rel="manifest" href="/manifest.webmanifest"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="DARYADARCY"><meta name="mobile-web-app-capable" content="yes"><link rel="apple-touch-icon" href="/apple-touch-icon.png">';
    after = after.replace("</head>", `${pwa}</head>`);
  }
  const deployTag = `<meta name="dd-deploy" content="${new Date().toISOString()}">`;
  after = after.replace(/<meta name="dd-deploy" content="[^"]*">\s*/g, "");
  after = after.replace("</head>", `${deployTag}</head>`);
  after = after.replace(
    /content="width=device-width, initial-scale=1, shrink-to-fit=no"/,
    'content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"',
  );
  const bust = `v=${Date.now().toString(36)}`;
  after = after.replace(/(src|href)="(\/_expo\/static\/[^"?]+)(?:\?[^"]*)?"/g, `$1="$2?${bust}"`);
  writeFileSync(file, after);
}
const html = files
  .filter((f) => f.endsWith(".html"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

const entryFiles = files.filter((f) => /entry-[a-f0-9]+\.js$/i.test(basename(f)));
for (const file of entryFiles) {
  if (!html.includes(basename(file))) {
    unlinkSync(file);
    console.log("removed unused entry", file);
  }
}

let bytesIn = 0;
let bytesOut = 0;
let count = 0;
for (const file of walk(root)) {
  if (file.endsWith(".gz")) continue;
  if (!compressExt.has(extname(file).toLowerCase())) continue;
  const buf = readFileSync(file);
  if (buf.length < 256) continue;
  const gz = gzipSync(buf, { level: 9 });
  writeFileSync(`${file}.gz`, gz);
  bytesIn += buf.length;
  bytesOut += gz.length;
  count += 1;
}

console.log(`gzipped ${count} files: ${bytesIn} -> ${bytesOut} bytes`);
