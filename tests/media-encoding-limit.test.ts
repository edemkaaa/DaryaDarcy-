import { expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ writes: [] as string[] }));
vi.mock("../apps/backend/src/storage", () => ({
  storagePut: async (key: string) => {
    storage.writes.push(key);
    return { key, url: "https://assets.example.test/fixture" };
  },
}));
import { ContentUploadService } from "../apps/backend/src/content/content-upload.service";

it("rejects encoded data above the existing 50 MiB JSON ceiling before storage", async () => {
  // Literal ceiling from the HTTP contract, independent of production constants.
  await expect(
    new ContentUploadService().uploadMedia({
      base64: "AAAA".repeat((50 * 1024 * 1024) / 4 + 1),
      filename: "fixture.mp3",
      mimeType: "audio/mpeg",
      type: "audio",
    }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(storage.writes).toEqual([]);
});
