import { z } from "zod";

// These columns are MySQL TEXT: the storage ceiling is bytes, not characters.
const fitsTextColumn = (value: string) =>
  Buffer.byteLength(value, "utf8") <= 65_535;

export const profileUpdateInput = z.object({
  expectedRevision: z.number().int().min(0).max(2_147_483_647),
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
