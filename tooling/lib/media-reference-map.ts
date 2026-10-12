import { createHash } from "node:crypto";
import { z } from "zod";
import { parseArticleInlines } from "../../packages/shared/src/article-blocks";

const snapshot = z
  .array(
    z
      .object({
        id: z.number().int().positive(),
        access: z.enum(["public", "club"]),
        published: z.union([z.boolean(), z.literal(0), z.literal(1)]),
        coverUrl: z.string().max(4096).nullable(),
        sections: z.unknown().refine((value) => value !== undefined),
      })
      .strict(),
  )
  .max(5000);
type Visibility = "public" | "restricted";

/** Offline reference evidence only: never an object inventory or ACL decision. */
export function collectArticleReferences(input: unknown) {
  const parsed = snapshot.safeParse(input);
  if (
    !parsed.success ||
    new Set(parsed.data.map((row) => row.id)).size !== parsed.data.length
  )
    throw new Error("Invalid article snapshot");
  const issues: string[] = [];
  const grouped = new Map<
    string,
    { access: Set<Visibility>; references: Set<string> }
  >();
  const add = (value: unknown, location: string, visibility: Visibility) => {
    if (value === "" || value === null || value === undefined) return;
    let url: URL;
    try {
      if (typeof value !== "string" || value.length > 4096) throw new Error();
      url = new URL(value);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error();
    } catch {
      issues.push(location + ".invalid-url");
      return;
    }
    if (url.search || url.hash)
      issues.push(location + ".query-or-fragment-needs-object-resolution");
    // Exact bytes: stripping signatures, decoding paths or normalizing aliases
    // could merge different objects. Hashes avoid exposing signed links in logs.
    const urlHash = createHash("sha256")
      .update(value as string)
      .digest("hex");
    const group = grouped.get(urlHash) ?? {
      access: new Set<Visibility>(),
      references: new Set<string>(),
    };
    group.access.add(visibility);
    group.references.add(location);
    grouped.set(urlHash, group);
  };
  const text = (value: unknown, location: string, access: Visibility) => {
    if (value === undefined || value === null) return;
    if (typeof value !== "string") {
      issues.push(location + ".invalid-text");
      return;
    }
    let index = 0;
    for (const inline of parseArticleInlines(value))
      if (inline.kind === "link")
        add(inline.url, `${location}.link:${index++}`, access);
  };
  const list = (value: unknown, location: string, access: Visibility) => {
    if (!Array.isArray(value)) {
      issues.push(location + ".invalid-array");
      return;
    }
    value.forEach((url, index) => {
      const item = `${location}:${index}`;
      if (typeof url !== "string") issues.push(item + ".invalid-url");
      else add(url, item, access);
    });
  };
  const known = new Set([
    "type",
    "text",
    "url",
    "urls",
    "caption",
    "label",
    "heading",
    "subheading",
    "body",
    "photos",
  ]);
  for (const row of parsed.data) {
    const root = `articles:${row.id}`;
    const published = row.published === true || row.published === 1;
    const access: Visibility =
      published && row.access === "public" ? "public" : "restricted";
    add(row.coverUrl, root + ".coverUrl", published ? "public" : "restricted");
    let sections = row.sections;
    if (typeof sections === "string") {
      try {
        sections = JSON.parse(sections);
      } catch {
        issues.push(root + ".sections.invalid-json");
        continue;
      }
    }
    if (!Array.isArray(sections)) {
      issues.push(root + ".sections.invalid-array");
      continue;
    }
    sections.forEach((section, index) => {
      const location = `${root}.sections:${index}`;
      if (!section || typeof section !== "object" || Array.isArray(section)) {
        issues.push(location + ".unknown-shape");
        return;
      }
      const block = section as Record<string, unknown>;
      if (Object.keys(block).some((key) => !known.has(key)))
        issues.push(location + ".unknown-fields");
      if (
        typeof block.type === "string" &&
        ["photo", "png", "link"].includes(block.type)
      )
        add(block.url, location + ".url", access);
      else if (block.type === "carousel") {
        list(block.urls, location + ".urls", access);
        add(block.url, location + ".url", access);
      } else if (block.type === "text" || block.type === "heading")
        text(block.text, location + ".text", access);
      else if (
        block.type === undefined &&
        ["heading", "subheading", "body", "photos"].some((key) => key in block)
      ) {
        if ("photos" in block) list(block.photos, location + ".photos", access);
        for (const key of ["heading", "subheading", "body"])
          text(block[key], `${location}.${key}`, access);
      } else issues.push(location + ".unknown-shape");
    });
  }
  return {
    scope: "articles-only-no-object-inventory" as const,
    groups: [...grouped].map(([urlHash, group]) => ({
      urlHash,
      visibility:
        group.access.size > 1 ? ("shared" as const) : [...group.access][0],
      references: [...group.references],
    })),
    issues,
  };
}
