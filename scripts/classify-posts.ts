/**
 * Post Tag Classification Script v2
 * 
 * Uses sortOrder to derive original Instagram publication date:
 *   sortOrder = maxTimestamp - post.timestamp
 *   => post.timestamp = maxTimestamp - sortOrder
 * 
 * We find maxTimestamp by finding the post with sortOrder=0 (newest).
 * Then for each post: realDate = new Date((maxTimestamp - sortOrder) * 1000)
 */

import { drizzle } from "drizzle-orm/mysql2";
import { posts } from "../drizzle/schema";
import { eq, asc, desc } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

// Load shortcode-timestamp map for accurate date resolution
const timestampMap: Record<string, number> = JSON.parse(
  fs.readFileSync(path.join(__dirname, "shortcode-timestamps.json"), "utf-8")
);

// ── Keyword dictionaries for each tag ──

const TAG_KEYWORDS: Record<string, string[]> = {
  // Seasons — used to supplement/override date-based season
  spring: [
    "весна", "весенн", "подснежник", "тюльпан", "нарцисс",
    "рассад", "посев", "пасха", "пасхальн", "первоцвет", "капель",
    "распуска", "черемух", "сирень", "8 марта"
  ],
  summer: [
    "лето", "летн", "загар", "купа", "ягод", "клубник", "малин",
    "солнц", "зной", "жар", "пляж", "море"
  ],
  autumn: [
    "осень", "осенн", "листопад", "листья опада", "тыкв", "хэллоуин",
    "halloween", "грибы", "грибн", "яблок", "варень", "заготовк",
    "золотая осень", "бабье лето"
  ],
  winter: [
    "зима", "зимн", "снег", "снежн", "мороз", "рождеств", "новый год",
    "новогодн", "ёлк", "елк", "каникул", "камин", "гирлянд", "адвент"
  ],

  // Topics
  home: [
    "кухн", "комнат", "интерьер", "ремонт", "переделк", "мебел", "шкаф",
    "полк", "стен", "обои", "покупк для дом", "ikea", "икеа",
    "гостин", "спальн", "ванн", "прихож", "коридор", "штор",
    "текстил", "подушк", "плед", "ковёр", "ковер", "светильник",
    "зеркал", "карниз", "посуд", "кружк", "тарелк",
    "организац", "хранен", "порядок",
    "выдвижн", "ящик", "наволочк", "декор дом", "обустро"
  ],
  garden: [
    "сад", "садов", "огород", "грядк", "цветник", "клумб", "газон",
    "посадк", "рассад", "семен", "полив", "удобрен",
    "розы", "пион", "гортенз", "лаванд", "георгин",
    "флокс", "хост", "многолетник", "однолетник", "луковиц",
    "теплиц", "парник", "яблон", "вишн", "смородин",
    "участок", "беседк", "качел", "веранд", "террас",
    "преображение сад", "наш сад"
  ],
  outfits: [
    "образ", "наряд", "плать", "юбк", "блуз", "рубашк", "свитер",
    "кардиган", "пальто", "куртк", "шапк", "шарф",
    "обувь", "сапог", "ботинк", "туфл", "сумк",
    "украшен", "серьг", "кольц", "браслет",
    "гардероб", "капсул", "outfit", "look", "ootd"
  ],
  recipes: [
    "рецепт", "выпечк", "пирог", "торт", "печень", "кекс",
    "хлеб", "тест", "начинк", "крем", "глазур",
    "суп", "салат", "ужин", "обед", "завтрак",
    "ингредиент", "мук", "сахар", "духовк", "запека"
  ],
  styling: [
    "стилизац", "съёмк", "съемк", "фотосесси", "фотосъёмк", "фотосъемк",
    "раскладк", "flatlay", "flat lay"
  ],
  masterclass: [
    "мастер-класс", "мастеркласс", "diy", "своими руками",
    "пошагов", "как сделать", "как создать", "tutorial", "handmade"
  ],
  travel: [
    "путешеств", "поездк", "отпуск",
    "музей", "замок", "дворец", "собор", "храм",
    "отел", "гостиниц", "экскурс",
    "петербург", "москва", "париж", "лондон", "рим", "прага", "вена"
  ],
  personal: [
    "обо мне", "про меня", "моя жизнь", "мой день", "мои мысл",
    "расскажу о себе", "поделюсь", "признаюсь", "откровенн",
    "день рождения", "юбилей", "если честно"
  ],

  // New tags
  kids: [
    "детск", "ребёнок", "ребенок", "малыш", "сын", "сыночк", "сынул",
    "игрушк", "детская комнат", "кроватк",
    "мультик", "сказк", "книжк", "раскраск", "пластилин", "лего",
    "конструктор", "домик фе", "фея", "волшебн", "принцесс",
    "плюшев", "мягк игрушк", "детский", "младенц",
    "материнств", "мам "
  ],
  dacha: [
    "дача", "дачн", "дачу", "даче", "загородн", "за городом",
    "романтика дачи", "переезд за город", "загород"
  ],
  books: [
    "книг", "книж", "чтен", "читаю", "прочитал", "прочла",
    "библиотек", "полка с книг", "книжная полк",
    "издательств", "издание", "тираж", "обложк",
    "календар", "блокнот", "ежедневник", "планер", "planner",
    "моя книга", "написала", "рукопись", "романтика дачи",
    "тропинка к творчеств"
  ],
  creativity: [
    "творчеств", "творческ", "тропинка к творчеств",
    "рисова", "рисую", "акварел", "краск", "кист", "холст",
    "вышивк", "вышива", "шить", "шью", "выкройк",
    "вязан", "вяжу", "спиц", "крючок", "пряж",
    "керамик", "глин", "лепк", "гончар",
    "скрапбукинг", "декупаж", "коллаж"
  ],
};

// ── Season detection by date ──
function getSeasonByMonth(month: number): string {
  // month is 0-indexed
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 9) return "autumn";
  return "winter"; // Nov, Dec, Jan, Feb
}

// Check if text contains any keyword from the list (case-insensitive, partial match)
function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

// Count how many keywords match
function countKeywordMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter(kw => lower.includes(kw.toLowerCase())).length;
}

// ── Main classification function ──
function classifyPost(post: { id: number; text: string; sortOrder: number; instagramId: string | null }): string[] {
  const assignedTags: Set<string> = new Set();
  const text = post.text;

  // Derive real date from instagramId -> timestamp map, or from sortOrder
  let realDate: Date | null = null;
  if (post.instagramId && timestampMap[post.instagramId]) {
    realDate = new Date(timestampMap[post.instagramId] * 1000);
  }

  // 1. Season by date
  if (realDate) {
    const month = realDate.getMonth();
    let season = getSeasonByMonth(month);
    
    // Override: November with strong winter keywords -> winter
    if (month === 10 && countKeywordMatches(text, TAG_KEYWORDS.winter) >= 2) {
      season = "winter";
    }
    // Override: February with strong spring keywords -> spring
    if (month === 1 && countKeywordMatches(text, TAG_KEYWORDS.spring) >= 2) {
      season = "spring";
    }
    // Override: August with strong autumn keywords -> autumn
    if (month === 7 && countKeywordMatches(text, TAG_KEYWORDS.autumn) >= 2) {
      season = "autumn";
    }
    
    assignedTags.add(season);
  } else {
    // No date available — try to detect season from text only
    const seasonScores: [string, number][] = [
      ["spring", countKeywordMatches(text, TAG_KEYWORDS.spring)],
      ["summer", countKeywordMatches(text, TAG_KEYWORDS.summer)],
      ["autumn", countKeywordMatches(text, TAG_KEYWORDS.autumn)],
      ["winter", countKeywordMatches(text, TAG_KEYWORDS.winter)],
    ];
    const best = seasonScores.sort((a, b) => b[1] - a[1])[0];
    if (best[1] >= 2) {
      assignedTags.add(best[0]);
    }
  }

  const year = realDate ? realDate.getFullYear() : 0;

  // 2. Topic tags by keywords
  // Home: needs 2+ keyword matches (common words like "дом" appear everywhere)
  if (countKeywordMatches(text, TAG_KEYWORDS.home) >= 2) {
    assignedTags.add("home");
  }

  // Garden: 1+ match is fine (garden terms are specific)
  if (matchesKeywords(text, TAG_KEYWORDS.garden)) {
    assignedTags.add("garden");
  }

  // Outfits: 2+ matches (avoid false positives from single word "образ")
  if (countKeywordMatches(text, TAG_KEYWORDS.outfits) >= 2) {
    assignedTags.add("outfits");
  }

  // Recipes: 2+ matches (cooking terms can appear casually)
  if (countKeywordMatches(text, TAG_KEYWORDS.recipes) >= 2) {
    assignedTags.add("recipes");
  }

  // Styling: 1+ match (terms are very specific)
  if (matchesKeywords(text, TAG_KEYWORDS.styling)) {
    assignedTags.add("styling");
  }

  // Masterclass: 1+ match
  if (matchesKeywords(text, TAG_KEYWORDS.masterclass)) {
    assignedTags.add("masterclass");
  }

  // Travel: 2+ matches (city names alone shouldn't trigger)
  if (countKeywordMatches(text, TAG_KEYWORDS.travel) >= 2) {
    assignedTags.add("travel");
  }

  // Personal: 2+ matches (very common words like "я", "мне" excluded, using specific phrases)
  if (countKeywordMatches(text, TAG_KEYWORDS.personal) >= 1) {
    assignedTags.add("personal");
  }

  // Kids: 1+ match (terms are specific enough)
  if (matchesKeywords(text, TAG_KEYWORDS.kids)) {
    assignedTags.add("kids");
  }

  // Dacha: keyword match + from 2021 onwards (or explicit "дача"/"романтика дачи")
  if (matchesKeywords(text, TAG_KEYWORDS.dacha)) {
    if (year >= 2021 || text.toLowerCase().includes("романтика дачи")) {
      assignedTags.add("dacha");
    }
  }

  // Books: 2+ matches (avoid false positives from single "книг" mention in passing)
  if (countKeywordMatches(text, TAG_KEYWORDS.books) >= 2) {
    assignedTags.add("books");
  }
  // But specific book titles always count
  if (text.toLowerCase().includes("романтика дачи") || text.toLowerCase().includes("тропинка к творчеств")) {
    assignedTags.add("books");
  }

  // Creativity: 2+ matches or specific title
  if (text.toLowerCase().includes("тропинка к творчеств")) {
    assignedTags.add("creativity");
  } else if (countKeywordMatches(text, TAG_KEYWORDS.creativity) >= 2) {
    assignedTags.add("creativity");
  }

  // 3. Special rules
  if (text.toLowerCase().includes("романтика дачи")) {
    assignedTags.add("books");
    assignedTags.add("dacha");
  }

  return Array.from(assignedTags);
}

// ── Main execution ──
async function main() {
  console.log("Starting post classification v2 (with real dates)...\n");
  
  // Fetch all posts
  const allPosts = await db.select({
    id: posts.id,
    text: posts.text,
    tags: posts.tags,
    sortOrder: posts.sortOrder,
    instagramId: posts.instagramId,
    createdAt: posts.createdAt,
  }).from(posts).orderBy(asc(posts.id));

  console.log(`Found ${allPosts.length} posts to classify`);

  let updated = 0;
  let skipped = 0;
  const tagCounts: Record<string, number> = {};
  const noTagPosts: number[] = [];

  for (const post of allPosts) {
    const newTags = classifyPost(post);
    
    // Count tags
    for (const tag of newTags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }

    if (newTags.length === 0) {
      noTagPosts.push(post.id);
    }

    // Update post tags
    const currentTags = (post.tags as string[]) || [];
    const tagsChanged = JSON.stringify(newTags.sort()) !== JSON.stringify(currentTags.sort());
    
    if (tagsChanged) {
      await db.update(posts).set({ tags: newTags }).where(eq(posts.id, post.id));
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`\nClassification complete!`);
  console.log(`Updated: ${updated} posts`);
  console.log(`Unchanged: ${skipped} posts`);
  console.log(`Posts with no tags: ${noTagPosts.length}`);
  console.log(`\nTag distribution:`);
  
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sortedTags) {
    const pct = ((count / allPosts.length) * 100).toFixed(1);
    console.log(`  ${tag}: ${count} posts (${pct}%)`);
  }

  // Show season distribution
  console.log(`\nSeason distribution:`);
  const seasons = ["spring", "summer", "autumn", "winter"];
  for (const s of seasons) {
    console.log(`  ${s}: ${tagCounts[s] || 0} posts`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
