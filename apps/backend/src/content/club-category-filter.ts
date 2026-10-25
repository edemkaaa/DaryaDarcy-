import { and, not, or, sql } from "drizzle-orm";
import { z } from "zod";
import { posts } from "../../../../packages/database/src/schema";
import {
  CLUB_SECTION_TAGS,
  CLUB_TAB_TAGS,
  SECTION_ORDER,
  type ClubTabId,
} from "../../../../packages/shared/src/club-tags";
import { postFilterTagAliases } from "../../../../packages/shared/src/post-tag-aliases";

export const clubCategoryInput = z
  .object({
    category: z.enum(["podborki", "community", "exclusive", "life"]).optional(),
    tag: z.string().trim().min(1).max(128).optional(),
    limit: z.number().int().min(1).max(50).default(20),
    cursor: z.number().int().nonnegative().safe().nullish(),
  })
  .strict();

// Match JavaScript trim(), including NBSP/BOM used in imported tag strings.
const whitespace =
  "[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]";
const trimPattern = `^${whitespace}+|${whitespace}+$`;
function hasTag(values: string[]) {
  if (!values.length) return sql`FALSE`;
  // A scalar aggregate preserves per-post JSON_TABLE correlation. EXISTS gave
  // false empty results for board-tag queries in the real MySQL regression.
  return sql`(SELECT COUNT(*) FROM JSON_TABLE(${posts.tags}, '$[*]' COLUMNS(tag TEXT PATH '$')) AS club_tag
    WHERE LOWER(REGEXP_REPLACE(club_tag.tag, ${trimPattern}, '')) COLLATE utf8mb4_bin
    IN (${sql.join(
      values.map((value) => sql`${value}`),
      sql`, `,
    )})) > 0`;
}
export function clubCategoryCondition(category: ClubTabId) {
  const earlier = SECTION_ORDER.slice(0, SECTION_ORDER.indexOf(category));
  // Explicit section tags win over fallback aliases; earlier sections win ties.
  return or(
    and(
      hasTag(CLUB_SECTION_TAGS[category]),
      not(hasTag(earlier.flatMap((key) => CLUB_SECTION_TAGS[key]))),
    ),
    and(
      not(hasTag(SECTION_ORDER.flatMap((key) => CLUB_SECTION_TAGS[key]))),
      hasTag(CLUB_TAB_TAGS[category]),
      not(hasTag(earlier.flatMap((key) => CLUB_TAB_TAGS[key]))),
    ),
  )!;
}
export const clubBoardTagCondition = (tag: string) =>
  hasTag(postFilterTagAliases(tag));
