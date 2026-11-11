// Формирует точный manifest старых платных копий для маршрутизации. Сам не удаляет оригиналы и не закрывает объекты в хранилище.
/** Inventory exact paid copies. Preserve originals; this only writes a routing manifest. */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd(),
  frontend = path.join(root, "apps/frontend");
const registry = JSON.parse(
  await fs.readFile(
    path.join(root, "docs/audits/library-source-map-2026-10-20.json"),
    "utf8",
  ),
);
const output = path.join(frontend, "private-library-assets.json");
const previous = await fs
  .readFile(output, "utf8")
  .then(JSON.parse)
  .catch((error) => {
    if (error.code === "ENOENT") return { legacyBuildPaths: [] };
    throw error;
  });
const paths = new Set(),
  hashes = new Set();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const file of registry.visuals.files) {
  const base = file.uri.replace(/(?:\.lossless)?\.webp$/, "");
  for (const suffix of [
    ".webp",
    ".lossless.webp",
    ".jpg",
    ".jpeg",
    ".png",
    ".avif",
  ]) {
    const uri = base + suffix;
    paths.add(uri); // Retire old-format aliases even if this checkout no longer contains them.
    try {
      const bytes = await fs.readFile(path.join(frontend, "public", uri));
      hashes.add(sha(bytes));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}
const variants = JSON.parse(
  await fs.readFile(path.join(frontend, "image-variants.json"), "utf8"),
);
for (const image of variants.images) {
  if (paths.has(image.full))
    for (const variant of image.variants) paths.add(variant.uri);
}
for (const pattern of Object.values(registry.patterns))
  for (const uri of pattern.untouchedPublicCopies) paths.add(uri);
const legacyBuildPaths = new Set(previous.legacyBuildPaths);
const media = path.join(frontend, ".next/static/media");
try {
  for (const name of await fs.readdir(media)) {
    const file = path.join(media, name);
    if (
      (await fs.stat(file)).isFile() &&
      hashes.has(sha(await fs.readFile(file)))
    )
      legacyBuildPaths.add("/_next/static/media/" + name);
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
for (const uri of legacyBuildPaths) paths.add(uri);
await fs.writeFile(
  output,
  JSON.stringify(
    {
      paths: [...paths].sort(),
      legacyBuildPaths: [...legacyBuildPaths].sort(),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    exactPaths: paths.size,
    legacyBuildPaths: legacyBuildPaths.size,
    originalsPreserved: true,
  }),
);
