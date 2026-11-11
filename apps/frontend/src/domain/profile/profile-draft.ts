/** Снимки редактирования профиля привязаны к владельцу и базовой ревизии, а не к одному общему браузерному ключу. */
import { z } from "zod";

export const CLUB_PROFILE_DRAFT_KEY = "@darcy_club_profile_draft";
export const PROFILE_NAME_DRAFT_KEY = "@darcy_profile_name_draft";
export const CLUB_PROFILE_PENDING_KEY = "@darcy_club_profile_pending";
export const PROFILE_NAME_PENDING_KEY = "@darcy_profile_name_pending";
export const LEGACY_PROFILE_NAME_KEY = "@darcy_club_profile_name";
export const LEGACY_PROFILE_GENDER_KEY = "@darcy_club_profile_gender";

const gender = z.enum(["female", "male"]);
const snapshot = z.object({
  revision: z.number().int().nonnegative().safe().nullable(),
  name: z.string().nullable(),
  gender: gender.nullable(),
});
const values = z.object({
  name: z.string().optional(),
  gender: gender.nullable().optional(),
  avatarUrl: z.string().startsWith("data:image/").nullable().optional(),
});
const draft = z.object({
  version: z.literal(1),
  ownerId: z.number().int().positive(),
  base: snapshot,
  values,
  needsReview: z.boolean(),
  review: snapshot.optional(),
});
export type ProfileSnapshot = z.infer<typeof snapshot>;
export type ProfileDraftValues = z.infer<typeof values>;
export type ProfileDraft = z.infer<typeof draft>;
export type ProfileInput = { name?: string; gender?: "female" | "male" };

/** Фиксируем базовые редактируемые поля и ревизию; отсутствие revision сохраняем явно, не подставляя новую серверную базу. */
export function profileSnapshot(user: {
  profileRevision?: number;
  name?: string | null;
  gender?: "female" | "male" | null;
}): ProfileSnapshot {
  return {
    revision: user.profileRevision ?? null,
    name: user.name ?? null,
    gender: user.gender ?? null,
  };
}

/** Восстанавливаем только своего владельца; legacy-ввод сохраняем для явной сверки с revision=null, а неизвестную версию не затираем. */
export function restoreProfileDraft(
  raw: string | null,
  ownerId: number,
  base: ProfileSnapshot,
  defaults: ProfileDraftValues,
  nameOnly: boolean,
): ProfileDraft {
  if (raw === null)
    return { version: 1, ownerId, base, values: defaults, needsReview: false };
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    decoded = raw;
  }
  const parsed = draft.safeParse(decoded);
  if (parsed.success && parsed.data.ownerId === ownerId) return parsed.data;
  if (
    decoded &&
    typeof decoded === "object" &&
    "ownerId" in decoded &&
    decoded.ownerId !== ownerId
  )
    throw new Error("Черновик принадлежит другому аккаунту.");
  if (decoded && typeof decoded === "object" && "version" in decoded)
    throw new Error(
      "Формат черновика не поддерживается. Сохранённые данные оставлены на устройстве.",
    );
  const legacy = values.safeParse(decoded);
  // The old name format was literal text: even "123" or "null" is a name.
  const input = nameOnly ? { name: raw } : legacy.success ? legacy.data : null;
  if (!input || !Object.keys(input).length)
    throw new Error(
      "Не удалось прочитать черновик. Сохранённые данные оставлены на устройстве.",
    );
  return {
    version: 1,
    ownerId,
    base: { revision: null, name: null, gender: null },
    values: { ...defaults, ...input },
    needsReview: true,
  };
}
