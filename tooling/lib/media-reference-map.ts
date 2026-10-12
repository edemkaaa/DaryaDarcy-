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
type ReferenceMap = {
  groups: {
    urlHash: string;
    visibility: Visibility | "shared";
    references: string[];
  }[];
  issues: string[];
};

function referenceReport() {
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
      if (typeof url !== "string" || url === "")
        issues.push(item + ".invalid-url");
      else add(url, item, access);
    });
  };
  const finish = <S extends string>(scope: S) => ({
    scope,
    groups: [...grouped].map(([urlHash, group]) => ({
      urlHash,
      visibility:
        group.access.size > 1 ? ("shared" as const) : [...group.access][0],
      references: [...group.references],
    })),
    issues,
  });
  const merge = (report: ReferenceMap) => {
    issues.push(...report.issues);
    for (const source of report.groups) {
      const group = grouped.get(source.urlHash) ?? {
        access: new Set<Visibility>(),
        references: new Set<string>(),
      };
      if (source.visibility === "shared") {
        group.access.add("public");
        group.access.add("restricted");
      } else group.access.add(source.visibility);
      source.references.forEach((reference) => group.references.add(reference));
      grouped.set(source.urlHash, group);
    }
  };
  return { add, text, list, issues, finish, merge };
}

/** Offline reference evidence only: never an object inventory or ACL decision. */
export function collectArticleReferences(input: unknown) {
  const parsed = snapshot.safeParse(input);
  if (
    !parsed.success ||
    new Set(parsed.data.map((row) => row.id)).size !== parsed.data.length
  )
    throw new Error("Invalid article snapshot");
  const { add, text, list, issues, finish } = referenceReport();
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
  return finish("articles-only-no-object-inventory");
}

const postSnapshot = z
  .object({
    posts: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            published: z.union([z.boolean(), z.literal(0), z.literal(1)]),
            status: z.enum(["published", "draft", "scheduled"]),
            target: z.enum(["feed", "club", "both"]),
            photos: z.unknown().refine((value) => value !== undefined),
            text: z.unknown().optional(),
            richText: z.unknown().optional(),
          })
          .strict(),
      )
      .max(5000),
    media: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            postId: z.number().int().positive(),
            url: z.string().max(4096),
          })
          .strict(),
      )
      .max(10000),
    articles: snapshot.optional(),
    comments: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            postId: z.number().int().positive(),
            photos: z.unknown().refine((value) => value !== undefined),
          })
          .strict(),
      )
      .max(10000)
      .optional(),
  })
  .strict();

/** Selected references only; omitted sources are never an inventory or ACL. */
export function collectPostReferences(input: unknown) {
  const parsed = postSnapshot.safeParse(input);
  if (
    !parsed.success ||
    new Set(parsed.data.posts.map((row) => row.id)).size !==
      parsed.data.posts.length ||
    new Set(parsed.data.media.map((row) => row.id)).size !==
      parsed.data.media.length ||
    new Set(parsed.data.comments?.map((row) => row.id)).size !==
      (parsed.data.comments?.length ?? 0)
  )
    throw new Error("Invalid post snapshot");
  const { add, list, issues, finish, merge } = referenceReport();
  if (parsed.data.articles)
    merge(collectArticleReferences(parsed.data.articles));
  const accessByPost = new Map<number, Visibility>();
  for (const row of parsed.data.posts) {
    const access: Visibility =
      (row.published === true || row.published === 1) &&
      row.status === "published" &&
      row.target !== "club"
        ? "public"
        : "restricted";
    accessByPost.set(row.id, access);
    if (row.text !== undefined) {
      if (typeof row.text !== "string")
        issues.push(`posts:${row.id}.text.invalid-text`);
      else {
        // Plain posts render text, not automatic anchors. These are candidates
        // only; punctuation/aliases must not be normalized into object identity.
        const candidates = row.text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
        if (candidates.length)
          issues.push(`posts:${row.id}.text.candidates-not-rendered-links`);
        candidates.forEach((url, index) =>
          add(url, `posts:${row.id}.text.candidate:${index}`, access),
        );
      }
    }
    let richText = row.richText;
    const richLocation = `posts:${row.id}.richText`;
    if (typeof richText === "string") {
      try {
        richText = JSON.parse(richText);
      } catch {
        issues.push(richLocation + ".invalid-json");
        richText = null;
      }
    }
    if (richText !== undefined && richText !== null) {
      if (!Array.isArray(richText))
        issues.push(richLocation + ".invalid-array");
      else
        richText.forEach((value, index) => {
          const location = `${richLocation}:${index}`;
          if (!value || typeof value !== "object" || Array.isArray(value)) {
            issues.push(location + ".unknown-shape");
            return;
          }
          const block = value as Record<string, unknown>;
          if (block.type !== "paragraph" && block.type !== "heading")
            issues.push(location + ".unknown-shape");
          if (
            Object.keys(block).some(
              (key) => !["type", "children"].includes(key),
            )
          )
            issues.push(location + ".unknown-fields");
          if (!Array.isArray(block.children)) {
            issues.push(location + ".children.invalid-array");
            return;
          }
          block.children.forEach((child, childIndex) => {
            const childLocation = `${location}.children:${childIndex}`;
            if (!child || typeof child !== "object" || Array.isArray(child)) {
              issues.push(childLocation + ".unknown-shape");
              return;
            }
            const inline = child as Record<string, unknown>;
            if (
              Object.keys(inline).some(
                (key) => !["text", "bold", "italic", "link"].includes(key),
              )
            )
              issues.push(childLocation + ".unknown-fields");
            add(inline.link, childLocation + ".link", access);
          });
        });
    }
    const location = `posts:${row.id}.photos`;
    let photos = row.photos;
    if (typeof photos === "string") {
      try {
        photos = JSON.parse(photos);
      } catch {
        issues.push(location + ".invalid-json");
        continue;
      }
    }
    list(photos, location, access);
  }
  for (const row of parsed.data.media) {
    const access = accessByPost.get(row.postId);
    if (!access) {
      issues.push(`post_media:${row.id}.parent-not-in-snapshot`);
      continue;
    }
    add(row.url, `post_media:${row.id}.url`, access);
  }
  for (const row of parsed.data.comments ?? []) {
    const location = `post_comments:${row.id}`;
    if (!accessByPost.has(row.postId)) {
      issues.push(location + ".parent-not-in-snapshot");
      continue;
    }
    let photos = row.photos;
    if (typeof photos === "string") {
      try {
        photos = JSON.parse(photos);
      } catch {
        issues.push(location + ".photos.invalid-json");
        continue;
      }
    }
    // club.comments requires membership even for a parent also visible in feed.
    if (photos !== null) list(photos, location + ".photos", "restricted");
  }
  return finish("content-references-partial-no-object-inventory");
}
