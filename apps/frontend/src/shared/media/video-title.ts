"use client";
const TITLE_OVERRIDES_BY_ID: Record<string, string> = {
  sq7pY1H_fYU: "Весенний влог | Пасхальный декор и обновления сада",
  ynAGqVHf6kg: "Как устроить красивый праздник? | идеи, декор, торт и подарки",
};
const TITLE_OVERRIDES: Record<string, string> = {
  "Creative Spring Vlog | Easter Decor and Garden Updates":
    "Весенний влог | Пасхальный декор и обновления сада",
  "Creative Spring Vlog": "Весенний влог | Пасхальный декор и обновления сада",
  "How to throw a beautiful celebration? | ideas, decor, cake, and gifts":
    "Как устроить красивый праздник? | идеи, декор, торт и подарки",
};
/** Prefer Russian display titles; DB may still hold English YouTube defaults. */
export function displayVideoTitle(
  title: string,
  youtubeId?: string | null,
): string {
  const id = (youtubeId || "").trim();
  if (id && TITLE_OVERRIDES_BY_ID[id]) return TITLE_OVERRIDES_BY_ID[id];
  const normalized = (title || "").normalize("NFC");
  if (TITLE_OVERRIDES[normalized]) return TITLE_OVERRIDES[normalized];
  if (normalized.startsWith("Creative Spring Vlog")) {
    return "Весенний влог | Пасхальный декор и обновления сада";
  }
  if (normalized.startsWith("How to throw a beautiful celebration")) {
    return "Как устроить красивый праздник? | идеи, декор, торт и подарки";
  }
  return normalized;
}
