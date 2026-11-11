"use client";
/** Отображаемые подписи тегов не меняют их значения для фильтрации и API. */
export type PostTag = {
  slug: string;
  label: string;
  rubric?: boolean;
};
/** Four club section tabs — shown first, with a stronger chip. */
export const CLUB_RUBRIC_TAGS: PostTag[] = [
  { slug: "podborki", label: "Подборки", rubric: true },
  { slug: "community", label: "Комьюнити", rubric: true },
  { slug: "exclusive", label: "Эксклюзив", rubric: true },
  { slug: "life", label: "Лайф", rubric: true },
];
export const SEASON_TAGS: PostTag[] = [
  { slug: "spring", label: "Весна" },
  { slug: "summer", label: "Лето" },
  { slug: "autumn", label: "Осень" },
  { slug: "winter", label: "Зима" },
];
export const TOPIC_TAGS: PostTag[] = [
  { slug: "home", label: "Дом" },
  { slug: "garden", label: "Сад" },
  { slug: "kids", label: "Детское" },
  { slug: "mens", label: "Мужское" },
  { slug: "newyear", label: "Новый год" },
  { slug: "easter", label: "Пасха" },
  { slug: "travel", label: "Путешествия" },
  { slug: "recipes", label: "Рецепты" },
  { slug: "beauty", label: "Красота" },
  { slug: "wardrobe", label: "Гардероб" },
  { slug: "creativity", label: "Творчество" },
  { slug: "renovation", label: "Ремонт" },
  { slug: "kino", label: "Кино" },
  { slug: "video", label: "Видео" },
  { slug: "styling", label: "Стилизации" },
  { slug: "masterclass", label: "Мастер-классы" },
  { slug: "personal", label: "Личное" },
  { slug: "books", label: "Книги" },
  { slug: "letter", label: "Письмо месяца" },
  { slug: "podcast", label: "Подкаст" },
  { slug: "backstage", label: "Закулисье" },
];
export const FEED_TAGS: PostTag[] = [...SEASON_TAGS, ...TOPIC_TAGS];
export const CLUB_TAGS: PostTag[] = [
  ...CLUB_RUBRIC_TAGS,
  ...SEASON_TAGS,
  ...TOPIC_TAGS,
];
export const ALL_POST_TAGS: PostTag[] = CLUB_TAGS;
const LABEL_BY_SLUG = new Map(
  ALL_POST_TAGS.map((tag) => [tag.slug, tag.label.toLowerCase()]),
);
/** Отображаем согласованную русскую подпись известного slug, сохраняя неизвестный пользовательский тег. */
export function postTagLabel(slug: string): string {
  const found = ALL_POST_TAGS.find((tag) => tag.slug === slug);
  return found?.label || slug;
}
/** Сопоставляем slug и русские подписи без учёта регистра; пустой фильтр ничего не выбирает. */
export function postHasTag(
  tags: string[] | null | undefined,
  filter: string,
): boolean {
  const needle = filter.trim().toLowerCase();
  if (!needle) return false;
  const label = LABEL_BY_SLUG.get(needle) ?? needle;
  return (tags || []).some((tag) => {
    const slug = tag.trim().toLowerCase();
    return slug === needle || (LABEL_BY_SLUG.get(slug) ?? slug) === label;
  });
}
/** Предлагаем редактору набор тегов целевого раздела, не меняя уже сохранённые значения поста. */
export function tagsForTarget(target: "feed" | "club" | "both"): PostTag[] {
  if (target === "club") return CLUB_TAGS;
  if (target === "feed") return FEED_TAGS;
  return ALL_POST_TAGS;
}
