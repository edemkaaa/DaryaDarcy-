import { z } from "zod";
import { isPersonalDataOwner } from "../../shared/browser/storage";
import { invalidResponse } from "../../shared/api/errors";

const intentSchema = z
  .object({
    version: z.literal(1),
    ownerId: z.number().int().positive().safe(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{16,128}$/),
    base64: z
      .string()
      .min(4)
      .max(6 * 1024 * 1024)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
    filename: z.enum(["avatar.jpg", "avatar.png", "avatar.webp"]),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  })
  .strict();
export type AvatarUploadIntent = z.infer<typeof intentSchema>;

const receiptSchema = z.union([
  z.object({ state: z.enum(["missing", "pending"]) }).strict(),
  z
    .object({
      state: z.literal("ready"),
      url: z
        .string()
        .url()
        .regex(/^https?:\/\//),
      avatarApplied: z.boolean(),
      // Unlike a cover receipt, an avatar must say whether it is current.
      isCurrent: z.boolean(),
    })
    .strict(),
]);
export function requireAvatarReceipt(value: unknown) {
  const result = receiptSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}

const key = (ownerId: number) => `darcy:user:${ownerId}:avatar-upload`;
function storage(ownerId: number) {
  if (!isPersonalDataOwner(ownerId))
    throw new DOMException("Операция отменена", "AbortError");
  return window.localStorage;
}

// The cropped 400px image is small. Storage failures must stop the write,
// unlike optional preferences: the exact bytes and key are needed after reload.
export function readAvatarIntent(ownerId: number): AvatarUploadIntent | null {
  const raw = storage(ownerId).getItem(key(ownerId));
  if (raw === null) return null;
  const intent = intentSchema.parse(JSON.parse(raw));
  if (intent.ownerId !== ownerId) throw invalidResponse();
  return intent;
}
export function saveAvatarIntent(intent: AvatarUploadIntent) {
  const valid = intentSchema.parse(intent);
  const store = storage(valid.ownerId);
  const existing = readAvatarIntent(valid.ownerId);
  if (existing && JSON.stringify(existing) !== JSON.stringify(valid))
    throw new Error("Сначала проверьте предыдущую загрузку фото.");
  store.setItem(key(valid.ownerId), JSON.stringify(valid));
}
export function removeAvatarIntent(intent: AvatarUploadIntent) {
  const store = storage(intent.ownerId);
  if (
    readAvatarIntent(intent.ownerId)?.idempotencyKey === intent.idempotencyKey
  )
    store.removeItem(key(intent.ownerId));
}
export const avatarIntentUri = (intent: AvatarUploadIntent) =>
  `data:${intent.mimeType};base64,${intent.base64}`;
