/** Границы редактирования профиля учитывают SQL-размеры и ревизию сохранения. */
import { z } from "zod";

export const MAX_PROFILE_REVISION = 2_147_483_647;

// Колонки MySQL TEXT ограничены байтами, а не числом символов строки.
/** Сверяем UTF-8 размер строки с пределом MySQL TEXT, чтобы имя и URL не проходили по числу символов при переполнении байт. */
const fitsTextColumn = (value: string) =>
  Buffer.byteLength(value, "utf8") <= 65_535;

export const profileUpdateInput = z.object({
  expectedRevision: z.number().int().min(0).max(MAX_PROFILE_REVISION),
  name: z
    .string()
    .trim()
    .min(1)
    .refine(fitsTextColumn, "Имя слишком длинное")
    .optional(),
  gender: z.enum(["female", "male"]).optional(),
  avatarUrl: z
    .string()
    .trim()
    .url()
    .refine(
      (value) => /^https?:\/\//i.test(value),
      "Нужен HTTP(S) URL изображения",
    )
    .refine(fitsTextColumn, "URL изображения слишком длинный")
    .optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateInput>;
