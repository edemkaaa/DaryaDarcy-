/** Нормализуем структурированные блоки статьи, их ссылки и встроенное форматирование. */
export type ArticleBlockType = "heading" | "text" | "photo" | "png" | "link" | "carousel";

export interface ArticleBlock {
  type: ArticleBlockType;
  text?: string;
  url?: string;
  label?: string;
  caption?: string;
  urls?: string[];
}

const BLOCK_TYPES = new Set(["heading", "text", "photo", "png", "link", "carousel"]);

/** Принимаем строковое поле старого или нового блока, для произвольного JSON возвращая пустую строку. */
function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Из массива выбираем только непустые строковые ссылки без утверждения об их безопасности или сетевой доступности. */
function asUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
}

/** Создаём пустой блок выбранного поддерживаемого типа для редактора статьи. */
export function emptyBlock(type: ArticleBlock["type"]): ArticleBlock {
  if (type === "photo" || type === "png") return { type, url: "", caption: "" };
  if (type === "link") return { type, url: "", label: "" };
  if (type === "carousel") return { type, urls: [], caption: "" };
  return { type, text: "" };
}

/** Извлекаем идентификатор связанной статьи только из ожидаемого формата источника. */
export function articleIdFromSource(source?: string | null): number | null {
  const match = /^article:(\d+)$/.exec(source || "");
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Приводим сохранённые блоки к допустимой структуре перед дальнейшей обработкой. */
/** Приводим новые типизированные и старые heading/photos/body блоки к одному формату, объединяем уникальные карусели и пропускаем неизвестные поля; пустой допустимый массив получает текстовый блок. */
export function normalizeArticleBlocks(value: unknown): ArticleBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: ArticleBlock[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const type = asString(row.type);
    if (BLOCK_TYPES.has(type)) {
      if (type === "carousel") {
        const urls = asUrlList(row.urls);
        if (asString(row.url)) urls.push(asString(row.url));
        const unique = [...new Set(urls.filter(Boolean))];
        if (unique.length) {
          blocks.push({
            type: "carousel",
            urls: unique,
            caption: asString(row.caption) || undefined,
          });
        }
        continue;
      }
      if (type === "photo" || type === "png") {
        const url = asString(row.url);
        if (url) {
          blocks.push({
            type,
            url,
            caption: asString(row.caption) || undefined,
          });
        }
        continue;
      }
      if (type === "link") {
        blocks.push({
          type: "link",
          url: asString(row.url),
          label: asString(row.label) || asString(row.text) || asString(row.url),
        });
        continue;
      }
      blocks.push({ type: type as "heading" | "text", text: asString(row.text) });
      continue;
    }
    const heading = asString(row.heading);
    const subheading = asString(row.subheading);
    const body = asString(row.body);
    const photos = Array.isArray(row.photos) ? row.photos.filter((url): url is string => typeof url === "string") : [];
    if (heading) blocks.push({ type: "heading", text: heading });
    if (subheading) blocks.push({ type: "heading", text: subheading });
    for (const url of photos) blocks.push({ type: "photo", url });
    if (body) blocks.push({ type: "text", text: body });
  }
  return blocks.length ? blocks : [emptyBlock("text")];
}

export type ArticleInline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "link"; text: string; url: string };

/** Разбираем встроенное форматирование текстового блока статьи. */
/** Выделяем поддерживаемые Markdown-ссылки и жирные фрагменты в токены без исполнения HTML; безопасность URL проверяется отдельной границей. */
export function parseArticleInlines(text: string): ArticleInline[] {
  const parts: ArticleInline[] = [];
  const pattern = /(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > last) {
      parts.push({ kind: "text", text: text.slice(last, match.index) });
    }
    const token = match[0];
    if (token.startsWith("[")) {
      const close = token.indexOf("](");
      parts.push({
        kind: "link",
        text: token.slice(1, close),
        url: token.slice(close + 2, -1),
      });
    } else {
      parts.push({ kind: "bold", text: token.slice(2, -2) });
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts.length ? parts : [{ kind: "text", text }];
}
