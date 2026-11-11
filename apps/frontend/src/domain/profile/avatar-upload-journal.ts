/** Журнал аватара хранит исходную операцию загрузки и её подтверждение, чтобы потеря ответа не требовала нового файла. */
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
/** Валидируем состояния missing/pending/ready; готовый аватар обязан сообщать, применён ли он и является ли текущим. */
export function requireAvatarReceipt(value: unknown) {
  const result = receiptSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}

/** Изолируем восстановление аватара аккаунтом, не сохраняя его в общем ключе устройства. */
const key = (ownerId: number) => `darcy:user:${ownerId}:avatar-upload`;
/** Доступ к журналу разрешён только текущему personal-data владельцу. */
function storage(ownerId: number) {
  if (!isPersonalDataOwner(ownerId))
    throw new DOMException("Операция отменена", "AbortError");
  return window.localStorage;
}

export class CorruptAvatarIntentError extends Error {
  readonly idempotencyKey: string | null;
  /** Сохраняем исходные повреждённые байты и, если возможно, прежний ключ для читающей проверки до удаления журнала. */
  constructor(
    readonly ownerId: number,
    readonly raw: string,
  ) {
    super(
      "Не удалось открыть черновик фото на этом устройстве.",
    );
    this.name = "CorruptAvatarIntentError";
    this.idempotencyKey = null;
    try {
      const header = intentSchema
        .pick({ ownerId: true, idempotencyKey: true })
        .strip()
        .safeParse(JSON.parse(raw));
      if (header.success && header.data.ownerId === ownerId)
        this.idempotencyKey = header.data.idempotencyKey;
    } catch {
      /* The original bytes remain available for download. */
    }
  }
}

// The cropped 400px image is small. Storage failures must stop the write,
// unlike optional preferences: the exact bytes and key are needed after reload.
/** Читаем строгий intent своего аккаунта; повреждение возвращаем отдельной ошибкой с исходным содержимым, а не как пустой слот. */
export function readAvatarIntent(ownerId: number): AvatarUploadIntent | null {
  const raw = storage(ownerId).getItem(key(ownerId));
  if (raw === null) return null;
  try {
    const intent = intentSchema.parse(JSON.parse(raw));
    if (intent.ownerId !== ownerId) throw invalidResponse();
    return intent;
  } catch {
    throw new CorruptAvatarIntentError(ownerId, raw);
  }
}
/** Удаляем только явно выбранную всё ещё повреждённую копию; исправленный или изменившийся журнал сохраняем. */
export function discardCorruptAvatarIntent(corrupt: CorruptAvatarIntentError) {
  const store = storage(corrupt.ownerId);
  if (store.getItem(key(corrupt.ownerId)) !== corrupt.raw)
    throw new Error(
      "Черновик фото изменился в другой вкладке. Повторите проверку.",
    );
  try {
    readAvatarIntent(corrupt.ownerId);
  } catch (cause) {
    if (
      !(cause instanceof CorruptAvatarIntentError) ||
      cause.raw !== corrupt.raw
    )
      throw cause;
    store.removeItem(key(corrupt.ownerId));
    if (store.getItem(key(corrupt.ownerId)) !== null)
      throw new Error("Не удалось сбросить повреждённый черновик фото.");
    return;
  }
  throw new Error("Черновик фото уже исправен. Сброс отменён.");
}
/** Сохраняем точные подготовленные байты и ключ, не заменяя отличающееся старое намерение. */
export function saveAvatarIntent(intent: AvatarUploadIntent) {
  const valid = intentSchema.parse(intent);
  const store = storage(valid.ownerId);
  const existing = readAvatarIntent(valid.ownerId);
  if (existing && JSON.stringify(existing) !== JSON.stringify(valid))
    throw new Error("Сначала проверьте предыдущую загрузку фото.");
  store.setItem(key(valid.ownerId), JSON.stringify(valid));
}
/** Удаляем только совпадающий idempotencyKey, чтобы поздний результат не стёр загрузку другой вкладки. */
export function removeAvatarIntent(intent: AvatarUploadIntent) {
  const store = storage(intent.ownerId);
  if (
    readAvatarIntent(intent.ownerId)?.idempotencyKey === intent.idempotencyKey
  )
    store.removeItem(key(intent.ownerId));
}
/** Восстанавливаем локальный просмотр из сохранённых MIME и Base64 без сетевой загрузки. */
export const avatarIntentUri = (intent: AvatarUploadIntent) =>
  `data:${intent.mimeType};base64,${intent.base64}`;
