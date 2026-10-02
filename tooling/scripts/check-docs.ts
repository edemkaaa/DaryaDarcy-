import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkDocumentationLinks } from "./documentation-links";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const inventory = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
    cwd: root,
    encoding: "utf8",
  },
)
  .split("\0")
  .filter(Boolean);
// Deleted tracked files may remain in the index while an edit is in progress.
const files = new Set(
  inventory.filter((file) => fs.existsSync(path.join(root, file))),
);
const currentDocuments = [...files]
  .filter(
    (file) =>
      file === "README.md" ||
      file === "docs/archive/README.md" ||
      (file.startsWith("docs/") &&
        !file.startsWith("docs/archive/") &&
        file.endsWith(".md")) ||
      /^apps\/[^/]+\/README\.md$/.test(file) ||
      /^packages\/[^/]+\/README\.md$/.test(file) ||
      /^tooling\/(?:[^/]+\/)?README\.md$/.test(file) ||
      /^tasks\/[^/]+\.md$/.test(file),
  )
  .sort();

const failures = currentDocuments.flatMap((file) =>
  checkDocumentationLinks(
    file,
    fs.readFileSync(path.join(root, file), "utf8"),
    files,
  ),
);
for (const failure of failures) {
  console.error(
    `${failure.file}:${failure.line}: ${failure.reason}: ${failure.target}`,
  );
}
if (failures.length) {
  console.error(
    `Documentation check failed: ${failures.length} broken local links.`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Documentation check passed: ${currentDocuments.length} current documents; local file/directory links only.`,
  );
}
