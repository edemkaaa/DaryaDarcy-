import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setPersonalDataOwner } from "../apps/frontend/src/shared/browser/storage";
import {
  readAvatarIntent,
  saveAvatarIntent,
  removeAvatarIntent,
  requireAvatarReceipt,
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
afterEach(() => {
  setPersonalDataOwner(null);
  vi.unstubAllGlobals();
});
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
it("propagates quota failures instead of allowing an unjournaled upload", () => {
  window.localStorage.setItem = () => {
    throw new DOMException("full", "QuotaExceededError");
  };
  expect(() => saveAvatarIntent(intent)).toThrow("full");
  expect(readAvatarIntent(101)).toBeNull();
});
it.each([
  "{broken",
  JSON.stringify({ ...intent, ownerId: 202 }),
  JSON.stringify({ ...intent, base64: "data:image/jpeg;base64,aGVsbG8=" }),
])("rejects corrupted or mismatched durable data: %s", (raw) => {
  values.set("darcy:user:101:avatar-upload", raw);
  expect(() => readAvatarIntent(101)).toThrow();
});
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
