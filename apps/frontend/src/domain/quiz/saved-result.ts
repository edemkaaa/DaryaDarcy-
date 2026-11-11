/** Сохранённый результат теста читаем как недоверенные локальные данные и сверяем с известными эстетиками. */
import { z } from "zod";
import { AESTHETIC_RESULTS, type QuizResult } from "./quiz-data";

const key = z.enum([
  "cottagecore",
  "goblincore",
  "witchcore",
  "castlecore",
  "fairycore",
  "darkAcademia",
  "lightAcademia",
]);
const score = z.number().finite().int().min(0).max(21);
const saved = z
  .object({
    primaryKey: key,
    secondaryKey: key.nullable(),
    isBlend: z.boolean(),
    scores: z.object({
      cottagecore: score,
      goblincore: score,
      witchcore: score,
      castlecore: score,
      fairycore: score,
      darkAcademia: score,
      lightAcademia: score,
    }),
  })
  .refine((value) =>
    value.isBlend
      ? value.secondaryKey !== null && value.secondaryKey !== value.primaryKey
      : value.secondaryKey === null,
  );

/** Browser data is untrusted; restore only keys/scores, never stored HTML or titles. */
export function parseSavedQuizResult(raw: string | null): QuizResult | null {
  if (!raw || raw.length > 4096) return null;
  try {
    const parsed = saved.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const data = parsed.data;
    return {
      primary: AESTHETIC_RESULTS[data.primaryKey],
      secondary:
        data.isBlend && data.secondaryKey
          ? AESTHETIC_RESULTS[data.secondaryKey]
          : undefined,
      isBlend: data.isBlend,
      scores: data.scores,
    };
  } catch {
    return null;
  }
}
