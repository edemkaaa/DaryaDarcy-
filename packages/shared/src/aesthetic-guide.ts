/** Типы ключей и ответа гида эстетики согласуют серверную выдачу и чтение на клиенте. */
import { z } from "zod";
export const aestheticKeySchema = z.enum([
  "cottagecore",
  "goblincore",
  "witchcore",
  "castlecore",
  "fairycore",
  "darkAcademia",
  "lightAcademia",
]);
export type AestheticGuideKey = z.infer<typeof aestheticKeySchema>;
export interface InspirationSection {
  films: string[];
  series: string[];
  books: string[];
  music: string[];
  blogs: {
    instagram: string[];
    youtube: string[];
  };
  magazines: string[];
}
export interface StyleSection {
  intro: string;
  table: {
    romantic: string[];
    workwear: string[];
  };
  contrast: string;
  details: string;
  accessories: string;
  shoes: string;
  fabrics: string;
  colors: string;
  bonus: string;
  principle: string;
  mixing: string;
}
export interface SpaceSection {
  intro: string;
  finishing: string;
  wallpaperBrands: string;
  ceilings: string;
  importantNote: string;
  palette: string;
  lifehack: string;
  furniture: string;
  furnitureWhere: string;
  furnitureAvoid: string;
  textile: string;
  textileFormula: string;
  details: string;
  lighting: string;
}
export interface RitualsSection {
  items: {
    title: string;
    description: string;
  }[];
}
export interface BlogSection {
  intro: string;
  strength: string;
  rubrics: {
    title: string;
    description: string;
  }[];
  tips: string[];
}

export interface AestheticGuideContent {
  style: StyleSection;
  space: SpaceSection;
  rituals: RitualsSection;
  blog: BlogSection;
  inspiration: InspirationSection;
}
export type AestheticGuide = AestheticGuideContent & { key: AestheticGuideKey };
/** Строим типизированную карту строковых Zod-полей из фиксированного перечня ключей, сохраняя их имена в типе результата. */
const strings = <const K extends readonly string[]>(keys: K) =>
  Object.fromEntries(keys.map((key) => [key, z.string()])) as Record<
    K[number],
    z.ZodString
  >;
const titled = z
  .object({ title: z.string(), description: z.string() })
  .strict();
export const aestheticGuideSchema = z
  .object({
    key: aestheticKeySchema,
    style: z
      .object({
        ...strings([
          "intro",
          "contrast",
          "details",
          "accessories",
          "shoes",
          "fabrics",
          "colors",
          "bonus",
          "principle",
          "mixing",
        ]),
        table: z
          .object({
            romantic: z.array(z.string()),
            workwear: z.array(z.string()),
          })
          .strict(),
      })
      .strict(),
    space: z
      .object(
        strings([
          "intro",
          "finishing",
          "wallpaperBrands",
          "ceilings",
          "importantNote",
          "palette",
          "lifehack",
          "furniture",
          "furnitureWhere",
          "furnitureAvoid",
          "textile",
          "textileFormula",
          "details",
          "lighting",
        ]),
      )
      .strict(),
    rituals: z.object({ items: z.array(titled) }).strict(),
    blog: z
      .object({
        intro: z.string(),
        strength: z.string(),
        rubrics: z.array(titled),
        tips: z.array(z.string()),
      })
      .strict(),
    inspiration: z
      .object({
        films: z.array(z.string()),
        series: z.array(z.string()),
        books: z.array(z.string()),
        music: z.array(z.string()),
        blogs: z
          .object({
            instagram: z.array(z.string()),
            youtube: z.array(z.string()),
          })
          .strict(),
        magazines: z.array(z.string()),
      })
      .strict(),
  })
  .strict();
