export type ClubTabId = "podborki" | "community" | "exclusive" | "life";

export const CLUB_SECTION_TAGS: Record<ClubTabId, string[]> = {
  podborki: ["podborki", "подборки", "подборка"],
  community: ["community", "комьюнити"],
  exclusive: ["exclusive", "эксклюзив"],
  life: ["life", "лайф"],
};

export const CLUB_TAB_TAGS: Record<ClubTabId, string[]> = {
  podborki: [...CLUB_SECTION_TAGS.podborki],
  community: [...CLUB_SECTION_TAGS.community],
  exclusive: [...CLUB_SECTION_TAGS.exclusive, "letter", "письмо", "podcast", "подкаст"],
  life: [...CLUB_SECTION_TAGS.life, "личное", "personal", "backstage", "закулисье"],
};

export const SECTION_ORDER = ["podborki", "community", "exclusive", "life"] as const;

export function primaryClubTab(tags: string[] | null | undefined): ClubTabId | null {
  const set = new Set((tags || []).map(normalizeClubTag));
  for (const tab of SECTION_ORDER) {
    if (CLUB_SECTION_TAGS[tab].some((item) => set.has(item))) return tab;
  }
  for (const tab of SECTION_ORDER) {
    if (CLUB_TAB_TAGS[tab].some((item) => set.has(item))) return tab;
  }
  return null;
}

export const COMMUNITY_COMMENT_HOURS = 48;

export function normalizeClubTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function postMatchesClubTab(tags: string[] | null | undefined, tab: ClubTabId): boolean {
  return primaryClubTab(tags) === tab;
}

export function isCommunityPost(tags: string[] | null | undefined): boolean {
  return postMatchesClubTab(tags, "community");
}

export function commentsCloseAt(createdAt: Date | string | null | undefined): Date | null {
  if (!createdAt) return null;
  const start = new Date(createdAt).getTime();
  if (!Number.isFinite(start)) return null;
  return new Date(start + COMMUNITY_COMMENT_HOURS * 60 * 60 * 1000);
}

const RUBRIC_SLUGS = new Set(Object.values(CLUB_SECTION_TAGS).flat().map(normalizeClubTag));

export function isClubRubricTag(tag: string): boolean {
  return RUBRIC_SLUGS.has(normalizeClubTag(tag));
}

export function areCommentsOpen(
  tags: string[] | null | undefined,
  createdAt: Date | string | null | undefined,
): boolean {
  if (!isCommunityPost(tags)) return false;
  const until = commentsCloseAt(createdAt);
  return Boolean(until && until.getTime() > Date.now());
}

const HIDDEN_CLUB_TAGS = new Set([
  "discussion",
  "обсуждение",
  "photomarathon",
  "фотомарафон",
  "guide",
  "гид",
]);

export function visibleClubTags(tags: string[] | null | undefined): string[] {
  return (tags || []).filter((tag) => !HIDDEN_CLUB_TAGS.has(normalizeClubTag(tag)));
}

export function clubTagLabel(tag: string): string {
  const value = normalizeClubTag(tag);
  const labels: Record<string, string> = {
    podborki: "подборки",
    community: "комьюнити",
    exclusive: "эксклюзив",
    life: "лайф",
    personal: "личное",
    letter: "письмо",
    podcast: "подкаст",
    backstage: "закулисье",
    home: "дом",
    garden: "сад",
    kids: "детское",
    mens: "мужское",
    newyear: "новый год",
    easter: "пасха",
    travel: "путешествия",
    recipes: "рецепты",
    beauty: "красота",
    wardrobe: "гардероб",
    creativity: "творчество",
    renovation: "ремонт",
    kino: "кино",
    outfits: "кино",
    summer: "лето",
    winter: "зима",
    autumn: "осень",
    spring: "весна",
  };
  return labels[value] || tag;
}
