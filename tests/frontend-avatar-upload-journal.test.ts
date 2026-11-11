/** Аватарный journal хранит точные bytes/key в персональном scope и не скрывает повреждение/ошибки storage. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setPersonalDataOwner } from "../apps/frontend/src/shared/browser/storage";
import {
  readAvatarIntent,
  saveAvatarIntent,
  removeAvatarIntent,
  requireAvatarReceipt,
  CorruptAvatarIntentError,
  discardCorruptAvatarIntent,
  type AvatarUploadIntent,
} from "../apps/frontend/src/domain/profile/avatar-upload-journal";
let values: Map<string, string>;
const intent: AvatarUploadIntent = {
  version: 1,
  ownerId: 101,
  idempotencyKey: "avatar-test-operation-01",
  base64: "aGVsbG8=",
  filename: "avatar.jpg",
  mimeType: "image/jpeg",
};
/** Собственный Map заменяет localStorage; активен только owner101. */
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  setPersonalDataOwner(101);
});
/** Снимаем персонального owner и synthetic window. */
afterEach(() => {
  setPersonalDataOwner(null);
  vi.unstubAllGlobals();
});
/** Logout/другой owner не могут читать/менять upload101; возврат владельца восстанавливает прежнее намерение. */
it("retains exact bytes and key for the same owner across session changes", () => {
  saveAvatarIntent(intent);
  setPersonalDataOwner(null);
  expect(() => readAvatarIntent(101)).toThrow();
  setPersonalDataOwner(202);
  expect(readAvatarIntent(202)).toBeNull();
  expect(() => saveAvatarIntent(intent)).toThrow();
  expect(() => removeAvatarIntent(intent)).toThrow();
  setPersonalDataOwner(101);
  expect(readAvatarIntent(101)).toEqual(intent);
});
/** PNG/WebP metadata не приводится молча к JPEG при восстановлении. */
it.each([
  ["avatar.png", "image/png"],
  ["avatar.webp", "image/webp"],
] as const)(
  "retains the actual prepared image format for %s across recovery",
  (filename, mimeType) => {
    const prepared = { ...intent, filename, mimeType };
    saveAvatarIntent(prepared);
    expect(readAvatarIntent(101)).toEqual(prepared);
  },
);
/** Неподтверждённое pending намерение нельзя заменить другими bytes/key или удалить чужим key. */
it("does not silently replace a pending file or key in another tab", () => {
  saveAvatarIntent(intent);
  expect(() => saveAvatarIntent({ ...intent, base64: "bmV3" })).toThrow();
  expect(() =>
    saveAvatarIntent({ ...intent, idempotencyKey: "another-operation-02" }),
  ).toThrow();
  expect(readAvatarIntent(101)).toEqual(intent);
  removeAvatarIntent({ ...intent, idempotencyKey: "another-operation-02" });
  expect(readAvatarIntent(101)).toEqual(intent);
});
/** QuotaExceeded не разрешает отправить файл без долговечного журнала. */
it("propagates quota failures instead of allowing an unjournaled upload", () => {
  window.localStorage.setItem = () => {
    throw new DOMException("full", "QuotaExceededError");
  };
  expect(() => saveAvatarIntent(intent)).toThrow("full");
  expect(readAvatarIntent(101)).toBeNull();
});
/** Broken JSON, другой owner и data-URL вместо Base64 отвергаются. */
it.each([
  "{broken",
  JSON.stringify({ ...intent, ownerId: 202 }),
  JSON.stringify({ ...intent, base64: "data:image/jpeg;base64,aGVsbG8=" }),
])("rejects corrupted or mismatched durable data: %s", (raw) => {
  values.set("darcy:user:101:avatar-upload", raw);
  expect(() => readAvatarIntent(101)).toThrow();
});
/** Состояние, safe URL и avatarApplied/isCurrent должны составлять корректный receipt. */
it.each([
  {
    state: "ready",
    url: "javascript:alert(1)",
    avatarApplied: true,
    isCurrent: true,
  },
  {
    state: "ready",
    url: "https://example.test/a.jpg",
    avatarApplied: false,
    isCurrent: null,
  },
  { state: "ready", url: "https://example.test/a.jpg", isCurrent: true },
  { state: "done" },
])("rejects malformed avatar receipts: %j", (value) => {
  expect(() => requireAvatarReceipt(value)).toThrow();
});
/** Ready прежнего upload с isCurrent:false не обещает повторно применить аватар. */
it("accepts a completed upload that is no longer current without implying reapplication", () => {
  expect(
    requireAvatarReceipt({
      state: "ready",
      url: "https://example.test/a.jpg",
      avatarApplied: true,
      isCurrent: false,
    }),
  ).toMatchObject({ isCurrent: false });
});

/** Читаем намеренно повреждённую запись и возвращаем её типизированное evidence для безопасного discard. */
function corrupt(raw: string) {
  values.set("darcy:user:101:avatar-upload", raw);
  try {
    readAvatarIntent(101);
  } catch (error) {
    expect(error).toBeInstanceOf(CorruptAvatarIntentError);
    return error as CorruptAvatarIntentError;
  }
  throw new Error("Expected corrupt data");
}
/** Ошибка сохраняет raw и допустимый исходный key до явного discard. */
it("preserves the original damaged bytes and a usable same-owner receipt key", () => {
  const raw = JSON.stringify({ ...intent, base64: "broken!" });
  const error = corrupt(raw);
  expect(error.raw).toBe(raw);
  expect(error.idempotencyKey).toBe(intent.idempotencyKey);
  expect(values.get("darcy:user:101:avatar-upload")).toBe(raw);
  discardCorruptAvatarIntent(error);
  expect(readAvatarIntent(101)).toBeNull();
});
/** Чужая запись не отдаёт ключ восстановления текущему аккаунту. */
it("never uses a foreign owner's receipt key", () => {
  const error = corrupt(JSON.stringify({ ...intent, ownerId: 202 }));
  expect(error.idempotencyKey).toBeNull();
});
/** SecurityError не становится предложением удалить нечитанную запись. */
it("does not mistake unavailable storage for a corrupt record", () => {
  window.localStorage.getItem = () => {
    throw new DOMException("denied", "SecurityError");
  };
  expect(() => readAvatarIntent(101)).toThrow("denied");
  try {
    readAvatarIntent(101);
  } catch (error) {
    expect(error).not.toBeInstanceOf(CorruptAvatarIntentError);
  }
});
/** Discard сверяет текущий raw и owner, не стирая заменённое намерение другой вкладки. */
it("refuses to discard a replacement or another owner's data", () => {
  const error = corrupt("{bad");
  values.set("darcy:user:101:avatar-upload", JSON.stringify(intent));
  expect(() => discardCorruptAvatarIntent(error)).toThrow("изменился");
  expect(readAvatarIntent(101)).toEqual(intent);
  setPersonalDataOwner(202);
  expect(() => discardCorruptAvatarIntent(error)).toThrow();
  expect(values.get("darcy:user:101:avatar-upload")).toBe(
    JSON.stringify(intent),
  );
});
/** Если removeItem ничего не удалил, проверка чтением сообщает отказ. */
it("reports failed durable removal rather than pretending recovery succeeded", () => {
  const error = corrupt("{bad");
  window.localStorage.removeItem = () => {};
  expect(() => discardCorruptAvatarIntent(error)).toThrow(
    "Не удалось сбросить",
  );
  expect(values.get("darcy:user:101:avatar-upload")).toBe("{bad");
});
