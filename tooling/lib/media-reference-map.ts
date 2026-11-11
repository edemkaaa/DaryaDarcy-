// Строит карту точных ссылок из снимков постов и статей, различая общие и закрытые объекты. URL хешируются без нормализации, чтобы не смешать разные подписанные адреса и не раскрыть их в отчёте.
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
type Visibility = "public" | "restricted" | "unknown";
type ReferenceMap = {
  groups: {
    urlHash: string;
    visibility: Visibility | "shared";
    references: string[];
  }[];
  issues: string[];
};

function referenceReport() {
  // Создаёт общий накопитель точных хешей URL, видимости и диагностических проблем без запросов к файлам.

  const issues: string[] = [];
  const grouped = new Map<
    string,
    { access: Set<Visibility>; references: Set<string> }
  >();
  const add = (value: unknown, location: string, visibility: Visibility) => {
    // Проверяет ссылку и объединяет только побайтно одинаковые URL; подпись и fragment сохраняются как отдельное свидетельство.

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
    // Подпись или fragment требуют проверки объекта: автоматическое отбрасывание параметров меняет смысл ссылки.
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
    // Извлекает только явно размеченные ссылки текстового блока; обычный текст не превращается автоматически в ссылку.

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
    // Проверяет массив ссылок и сохраняет точное положение каждого элемента для будущей сверки привязок.

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
  const finish = <S extends string>(scope: S) => /* Возвращает неизменяющий файлы отчёт; неизвестная видимость имеет приоритет над предположением о публичности. */ ({
    scope,
    groups: [...grouped].map(([urlHash, group]) => ({
      urlHash,
      visibility: group.access.has("unknown")
        ? ("unknown" as const)
        : group.access.size > 1
          ? ("shared" as const)
          : [...group.access][0],
      references: [...group.references],
    })),
    issues,
  });
  const merge = (report: ReferenceMap) => {
    // Объединяет частичные карты ссылок, сохраняя смешанную публичную/закрытую принадлежность объектов.

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
  // Проверяет снимок статей и поддерживаемые блоки; неизвестные структуры отмечаются для ручного исследования.

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
      } else {
        issues.push(location + ".unknown-shape");
        // Preserve explicit saved URL candidates without inventing how an
        // unsupported block renders or who can read its underlying object.
        add(block.url, location + ".url", "unknown");
        for (const key of ["urls", "photos"])
          if (key in block) list(block[key], `${location}.${key}`, "unknown");
      }
    });
  }
  return finish("articles-only-no-object-inventory");
}

const decorationSnapshot = z
  .object({
    avatars: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            avatarUrl: z.string().max(4096).nullable(),
          })
          .strict(),
      )
      .max(10000),
    videos: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            published: z.union([z.boolean(), z.literal(0), z.literal(1)]),
            thumbnailUrl: z.string().max(4096).nullable(),
            videoUrl: z.string().max(4096).nullable(),
          })
          .strict(),
      )
      .max(5000),
    seasons: z
      .array(
        z
          .object({
            season: z.enum(["winter", "spring", "summer", "autumn"]),
            backgroundUrl: z.string().max(4096).nullable(),
            bannerUrl: z.string().max(4096).nullable(),
          })
          .strict(),
      )
      .max(4),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.avatars.map((row) => row.id)).size ===
        value.avatars.length &&
      new Set(value.videos.map((row) => row.id)).size === value.videos.length &&
      new Set(value.seasons.map((row) => row.season)).size ===
        value.seasons.length,
  );

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
    decoration: decorationSnapshot.optional(),
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
  // Собирает ссылки постов, вложений, комментариев и оформления; отсутствие родителя означает неизвестную видимость.

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
          const supported =
            block.type === "paragraph" || block.type === "heading";
          if (!supported) issues.push(location + ".unknown-shape");
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
            add(
              inline.link,
              childLocation + ".link",
              supported ? access : "unknown",
            );
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
    }
    // Missing parents remove visibility evidence, not the saved association.
    add(row.url, `post_media:${row.id}.url`, access ?? "unknown");
  }
  for (const row of parsed.data.comments ?? []) {
    const location = `post_comments:${row.id}`;
    const parentPresent = accessByPost.has(row.postId);
    if (!parentPresent) {
      issues.push(location + ".parent-not-in-snapshot");
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
    if (photos !== null)
      list(
        photos,
        location + ".photos",
        parentPresent ? "restricted" : "unknown",
      );
  }
  for (const row of parsed.data.decoration?.avatars ?? [])
    add(row.avatarUrl, `users:${row.id}.avatarUrl`, "public");
  for (const row of parsed.data.decoration?.videos ?? []) {
    const access =
      row.published === true || row.published === 1 ? "public" : "restricted";
    add(row.thumbnailUrl, `videos:${row.id}.thumbnailUrl`, access);
    add(row.videoUrl, `videos:${row.id}.videoUrl`, access);
  }
  for (const row of parsed.data.decoration?.seasons ?? []) {
    add(
      row.backgroundUrl,
      `launch_settings.seasons:${row.season}.backgroundUrl`,
      "public",
    );
    add(
      row.bannerUrl,
      `launch_settings.seasons:${row.season}.bannerUrl`,
      "public",
    );
  }
  return finish("content-references-partial-no-object-inventory");
}

/** Presence of selected fields is not proof of all database rows or objects. */
const inventorySnapshot = z
  .object({
    objects: z
      .array(
        z
          .object({
            objectId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
            urlHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(100),
          })
          .strict(),
      )
      .max(10000),
    externalUrlHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(10000),
  })
  .strict();

function mapDeclaredObjects(report: ReferenceMap, input: unknown) {
  // Сопоставляет хеши с явно объявленными объектами; невыбранные строки и отсутствующие файлы не считаются проверенными.

  const parsed = inventorySnapshot.safeParse(input);
  if (!parsed.success) throw new Error("Invalid media inventory");
  const hashes = [
    ...parsed.data.objects.flatMap((object) => object.urlHashes),
    ...parsed.data.externalUrlHashes,
  ];
  if (
    new Set(hashes).size !== hashes.length ||
    new Set(parsed.data.objects.map((object) => object.objectId)).size !==
      parsed.data.objects.length
  )
    throw new Error("Invalid media inventory");
  const groups = new Map(report.groups.map((group) => [group.urlHash, group]));
  const matched = new Set(hashes);
  const external = new Set(parsed.data.externalUrlHashes);
  return {
    scope: "declared-selected-inventory-not-rollout" as const,
    objects: parsed.data.objects.map((object) => {
      const references = object.urlHashes.flatMap(
        (hash) => groups.get(hash)?.references ?? [],
      );
      const visibility = new Set(
        object.urlHashes
          .map((hash) => groups.get(hash)?.visibility)
          .filter((value) => value !== undefined),
      );
      return {
        objectId: object.objectId,
        visibility: visibility.has("unknown")
          ? "unknown"
          : visibility.size === 0
            ? "unassociated-in-snapshot"
            : visibility.has("shared") || visibility.size > 1
              ? "shared"
              : [...visibility][0],
        references: [...new Set(references)],
      };
    }),
    externalReferences: report.groups
      .filter((group) => external.has(group.urlHash))
      .map((group) => ({
        urlHash: group.urlHash,
        references: group.references,
      })),
    unresolvedUrlHashes: report.groups
      .filter((group) => !matched.has(group.urlHash))
      .map((group) => group.urlHash),
  };
}

export function collectMediaSnapshot(input: unknown, inventory?: unknown) {
  // Дополняет карту явным отчётом полноты выбранных полей; это не доказательство полноты рабочей БД или S3.

  const report = collectPostReferences(input);
  const parsed = postSnapshot.parse(input);
  const missingFields: string[] = [];
  for (const key of ["articles", "comments", "decoration"] as const)
    if (parsed[key] === undefined) missingFields.push(key);
  for (const row of parsed.posts)
    for (const key of ["text", "richText"] as const)
      if (row[key] === undefined) missingFields.push(`posts:${row.id}.${key}`);
  return {
    ...report,
    snapshotCoverage: {
      selectedFieldsComplete: missingFields.length === 0,
      missingFields,
    },
    ...(inventory === undefined
      ? {}
      : { objectMap: mapDeclaredObjects(report, inventory) }),
  };
}
