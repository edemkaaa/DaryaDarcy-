import { expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ writes: [] as string[] }));
vi.mock("../apps/backend/src/storage", () => ({
  storagePut: async (key: string) => {
    storage.writes.push(key);
    return { key, url: "https://assets.example.test/fixture" };
  },
}));
import { decodeMediaBase64 } from "../apps/backend/src/media/media-encoding";

it("rejects encoded data above the existing 50 MiB JSON ceiling before storage", async () => {
  // Literal ceiling from the HTTP contract, independent of production constants.
  expect(() => decodeMediaBase64("AAAA".repeat((50 * 1024 * 1024) / 4 + 1))).toThrowError(expect.objectContaining({ code: "BAD_REQUEST" }));
  expect(storage.writes).toEqual([]);
});
