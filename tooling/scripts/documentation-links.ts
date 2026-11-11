// Разбирает локальные Markdown-ссылки с учётом блоков кода и относительных путей. Не пытается подтверждать доступность внешних URL.
import path from "node:path";

export type BrokenDocumentationLink = {
  file: string;
  line: number;
  target: string;
  reason: "missing-target" | "outside-repository" | "invalid-encoding";
};

/** Checks local file/directory destinations; does not fetch URLs or check headings. */
export function checkDocumentationLinks(
  file: string,
  markdown: string,
  repositoryFiles: ReadonlySet<string>,
): BrokenDocumentationLink[] {
  const failures: BrokenDocumentationLink[] = [];
  const targets = new Set(repositoryFiles);
  for (const name of repositoryFiles) {
    let directory = path.posix.dirname(name);
    while (directory !== ".") {
      targets.add(directory);
      directory = path.posix.dirname(directory);
    }
  }
  targets.add(".");
  let fence: { marker: string; length: number } | undefined;
  for (const [index, raw] of markdown.split(/\r?\n/).entries()) {
    const delimiter = raw.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (
        delimiter &&
        delimiter[1][0] === fence.marker &&
        delimiter[1].length >= fence.length &&
        !delimiter[2].trim()
      )
        fence = undefined;
      continue;
    }
    if (delimiter) {
      fence = { marker: delimiter[1][0], length: delimiter[1].length };
      continue;
    }
    // Leave line boundaries intact for useful diagnostics.
    const line = raw.replace(/(`+).*?\1/g, "");
    const destinations: string[] = [];
    const reference = line.match(/^ {0,3}\[[^\]]+\]:\s*(.*)$/);
    if (reference) destinations.push(readDestination(reference[1]));
    for (const match of line.matchAll(/\]\(\s*/g)) {
      destinations.push(
        readDestination(line.slice(match.index! + match[0].length)),
      );
    }
    for (const target of destinations) {
      if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue;
      let decoded: string;
      try {
        decoded = decodeURIComponent(target.split(/[?#]/, 1)[0]);
      } catch {
        failures.push({
          file,
          line: index + 1,
          target,
          reason: "invalid-encoding",
        });
        continue;
      }
      const resolved =
        path.posix
          .normalize(
            decoded.startsWith("/")
              ? decoded.slice(1)
              : path.posix.join(path.posix.dirname(file), decoded),
          )
          .replace(/\/$/, "") || ".";
      const reason =
        resolved === ".." || resolved.startsWith("../")
          ? "outside-repository"
          : !targets.has(resolved)
            ? "missing-target"
            : undefined;
      if (reason) failures.push({ file, line: index + 1, target, reason });
    }
  }
  return failures;
}

function readDestination(source: string): string {
  if (source.startsWith("<")) {
    const end = source.indexOf(">");
    return end < 0 ? "" : source.slice(1, end);
  }
  let depth = 0;
  let destination = "";
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === "\\" && i + 1 < source.length) {
      destination += source[++i];
      continue;
    }
    if (/\s/.test(char)) break;
    if (char === "(") depth++;
    if (char === ")" && depth-- === 0) break;
    destination += char;
  }
  return destination;
}
