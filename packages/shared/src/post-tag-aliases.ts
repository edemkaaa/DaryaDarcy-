import { clubTagLabel, normalizeClubTag } from "./club-tags";

// Existing board-filter labels, not the broader rubric fallback aliases.
const slugs = [
  "podborki",
  "community",
  "exclusive",
  "life",
  "spring",
  "summer",
  "autumn",
  "winter",
  "home",
  "garden",
  "kids",
  "mens",
  "newyear",
  "easter",
  "travel",
  "recipes",
  "beauty",
  "wardrobe",
  "creativity",
  "renovation",
  "kino",
  "video",
  "styling",
  "masterclass",
  "personal",
  "books",
  "letter",
  "podcast",
  "backstage",
];
const labels: Record<string, string> = {
  video: "видео",
  styling: "стилизации",
  masterclass: "мастер-классы",
  books: "книги",
  letter: "письмо месяца",
};

export function postFilterTagAliases(value: string): string[] {
  const tag = normalizeClubTag(value);
  for (const slug of slugs) {
    const label = labels[slug] ?? clubTagLabel(slug);
    if (tag === slug || tag === label) return [slug, label];
  }
  return [tag];
}
