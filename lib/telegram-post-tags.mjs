/**
 * Parse Telegram export entities into post text, richText, and tag slugs.
 * Footer tags in TG are doubled: #гардероб👒 — we keep chips, drop hashtag+emoji from body.
 */

const HASHTAG_TO_SLUG = {
  подборки: "podborki",
  подборка: "podborki",
  кино: "kino",
  подкаст: "exclusive",
  podcast: "exclusive",
  эксклюзив: "exclusive",
  app_эксклюзив: "exclusive",
  лайф: "life",
  app_лайф: "life",
  комьюнити: "community",
  app_комьюнити: "community",
  гардероб: "wardrobe",
  дом: "home",
  сад: "garden",
  детское: "kids",
  мужское: "mens",
  "новый год": "newyear",
  новыйгод: "newyear",
  пасха: "easter",
  путешествия: "travel",
  рецепты: "recipes",
  красота: "beauty",
  творчество: "creativity",
  ремонт: "renovation",
  образы: "outfits",
  видео: "video",
  стилизации: "styling",
  "мастер-классы": "masterclass",
  мастерклассы: "masterclass",
  личное: "personal",
  книги: "books",
  "письмо месяца": "letter",
  письмо: "letter",
  закулисье: "backstage",
  весна: "spring",
  лето: "summer",
  осень: "autumn",
  зима: "winter",
};

const RUBRIC_SLUGS = new Set(["podborki", "community", "exclusive", "life"]);

export function hashtagToSlug(raw) {
  const normalized = raw.replace(/^#/, "").trim().toLowerCase();
  return HASHTAG_TO_SLUG[normalized] || null;
}

/** Tags mapped from section hashtags anywhere in the message. */
export function resolveRubricTags(rawText) {
  const tags = new Set();
  const lower = rawText.toLowerCase();
  if (/#(?:подборки?|кино)/i.test(rawText)) tags.add("podborki");
  if (/#(?:подкаст|эксклюзив|app_эксклюзив)/i.test(rawText)) tags.add("exclusive");
  if (/#app_лайф/i.test(rawText)) tags.add("life");
  if (/#app_комьюнити/i.test(rawText)) tags.add("community");
  if (lower.includes("#комьюнити")) tags.add("community");
  if (lower.includes("#лайф")) tags.add("life");
  return tags;
}

/** True when message should be imported with --filter=tagged. */
export function isTaggedClubMessage(msg) {
  const raw = msg.text_entities?.length
    ? msg.text_entities.map((p) => p.text || "").join("")
    : typeof msg.text === "string"
      ? msg.text
      : "";
  if (resolveRubricTags(raw).size > 0) return true;
  if (/app_/i.test(raw)) return true;
  return false;
}

/**
 * Footer at end of TG posts: repeating (#tag + sticker emoji + space).
 * Returns index where footer starts (entities before this index are body).
 */
export function footerTagBoundary(entities) {
  if (!Array.isArray(entities) || entities.length === 0) {
    return { start: 0, footerTags: [] };
  }

  let i = entities.length - 1;
  while (i >= 0 && entities[i].type === "plain" && !String(entities[i].text || "").trim()) {
    i--;
  }

  const footerTags = [];
  let start = entities.length;

  while (i >= 0) {
    const part = entities[i];
    if (part.type === "custom_emoji") {
      i--;
      continue;
    }
    if (part.type === "plain" && !String(part.text || "").trim()) {
      i--;
      continue;
    }
    if (part.type === "hashtag") {
      const slug = hashtagToSlug(part.text || "");
      if (slug) footerTags.unshift(slug);
      start = i;
      i--;
      continue;
    }
    break;
  }

  return { start, footerTags: [...new Set(footerTags.filter(Boolean))] };
}

export function entitiesToPlain(entities, end = entities.length) {
  if (!Array.isArray(entities)) return typeof entities === "string" ? entities : "";
  return entities
    .slice(0, end)
    .map((part) => (typeof part === "string" ? part : part.text || ""))
    .join("");
}

export function entitiesToRichText(entities, end = entities.length) {
  if (!entities?.length) return null;
  const children = [];
  for (const part of entities.slice(0, end)) {
    const text = part.text || "";
    if (!text) continue;
    if (part.type === "plain") {
      children.push({ text });
      continue;
    }
    if (part.type === "bold") children.push({ text, bold: true });
    else if (part.type === "italic") children.push({ text, italic: true });
    else if (part.type === "text_link" && part.href) children.push({ text, link: part.href });
    else if (part.type === "link" && part.href) children.push({ text, link: part.href });
    else if (part.type === "hashtag" || part.type === "custom_emoji") continue;
    else children.push({ text });
  }

  const merged = [];
  for (const child of children) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.bold === child.bold &&
      prev.italic === child.italic &&
      prev.link === child.link
    ) {
      prev.text += child.text;
    } else {
      merged.push({ ...child });
    }
  }
  if (!merged.length) return null;

  const paragraphs = [];
  let bucket = [];

  const flushParagraph = () => {
    if (!bucket.length) return;
    paragraphs.push({ type: "paragraph", children: bucket });
    bucket = [];
  };

  for (const child of merged) {
    const raw = child.text || "";
    const lines = raw.split("\n");
    lines.forEach((line, index) => {
      const cleaned = line.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
      if (cleaned) {
        bucket.push({
          text: cleaned,
          ...(child.bold ? { bold: true } : {}),
          ...(child.italic ? { italic: true } : {}),
          ...(child.link ? { link: child.link } : {}),
        });
      }
      if (index < lines.length - 1) flushParagraph();
    });
  }
  flushParagraph();
  return paragraphs.length ? paragraphs : null;
}

export function cleanPlainText(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function mergeTags(...groups) {
  const rubric = [];
  const topics = [];
  const seen = new Set();
  for (const group of groups) {
    for (const tag of group) {
      if (!tag || seen.has(tag)) continue;
      seen.add(tag);
      if (RUBRIC_SLUGS.has(tag)) rubric.push(tag);
      else topics.push(tag);
    }
  }
  const ordered = [...rubric, ...topics];
  return ordered.length ? ordered : ["life"];
}

export function buildTelegramPostContent(msg) {
  const entities = msg.text_entities?.length ? msg.text_entities : msg.text;
  const rawText = entitiesToPlain(Array.isArray(entities) ? entities : []);
  const { start, footerTags } = Array.isArray(entities)
    ? footerTagBoundary(entities)
    : { start: 0, footerTags: [] };

  const bodyEntities = Array.isArray(entities) ? entities.slice(0, start) : entities;
  const text = cleanPlainText(
    Array.isArray(bodyEntities) ? entitiesToPlain(bodyEntities) : rawText,
  );
  const richText = Array.isArray(bodyEntities) ? entitiesToRichText(bodyEntities) : null;

  const inlineTags = [];
  if (Array.isArray(entities)) {
    for (const part of entities.slice(0, start)) {
      if (part.type === "hashtag") {
        const slug = hashtagToSlug(part.text || "");
        if (slug) inlineTags.push(slug);
      }
    }
  }

  const tags = mergeTags(resolveRubricTags(rawText), footerTags, inlineTags);
  return { text, richText, tags };
}
