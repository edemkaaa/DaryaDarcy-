import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { drizzle } from "drizzle-orm/mysql2";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import type { User } from "../packages/database/src/schema";

const storage = vi.hoisted(() => ({ writes: [] as { key: string; data: Buffer; mime: string }[] }));
vi.mock("../apps/backend/src/storage", () => ({
  storagePut: async (key: string, data: Buffer, mime: string) => {
    storage.writes.push({ key, data, mime });
    return { key, url: "https://assets.example.test/photo.webp" };
  },
}));
vi.mock("../apps/backend/src/db", () => ({
  isOwnerAccount: (user: User) => user.role === "admin",
  updateUserProfile: async () => undefined,
  getDb: async () => drizzle.mock(),
  getUserById: async () => user,
}));
vi.mock("../apps/backend/src/profile/profile-writes", () => ({ saveProfile: async () => 1 }));
import { appRouter } from "../apps/backend/src/routers";
const user = { id: 7, role: "admin", blockedAt: null } as User;
function caller() { return appRouter.createCaller({ user, req: {}, res: {} } as TrpcContext); }
const uploaders = [
  (input: { base64: string; filename: string; mimeType: string }) => caller().profile.uploadAvatar(input),
  (input: { base64: string; filename: string; mimeType: string }) => caller().admin.uploadPhoto({ ...input, purpose: "publicCover" }),
];
beforeEach(() => { storage.writes.length = 0; });
describe("photo upload validates bytes rather than the client MIME or filename", () => {
  it("disables SVG at the native decoder even if a future caller bypasses the signature gate", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><rect width="2" height="3" fill="red"/></svg>');
    await expect(sharp(svg).metadata()).rejects.toThrow();
  });
  it.each(["jpeg", "png", "webp"] as const)("still uploads genuine %s after decoder hardening", async (format) => {
    const bytes = await sharp({ create: { width: 2, height: 3, channels: 3, background: "red" } }).toFormat(format).toBuffer();
    for (const upload of uploaders) {
      await upload({ base64: bytes.toString("base64"), filename: "untrusted.svg", mimeType: "image/svg+xml" });
    }
    expect(storage.writes).toHaveLength(2);
    for (const stored of storage.writes) {
      expect(await sharp(stored.data).metadata()).toMatchObject({ format: "webp", width: 2, height: 3 });
      expect(stored.mime).toBe("image/webp");
    }
  });
  it.each(uploaders)("rejects HTML masquerading as JPEG without storing it", async (upload) => {
    await expect(upload({ base64: Buffer.from("<html><script>alert(1)</script></html>").toString("base64"), filename: "photo.jpg", mimeType: "image/jpeg" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(storage.writes).toHaveLength(0);
  });
  it.each(uploaders)("rejects oversized photos before storage", async (upload) => {
    await expect(upload({ base64: Buffer.alloc(4 * 1024 * 1024 + 1).toString("base64"), filename: "photo.jpg", mimeType: "image/jpeg" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(storage.writes).toHaveLength(0);
  });
  it.each(uploaders)("re-encodes JPEG, removes location metadata and ignores path traversal filename", async (upload) => {
    const input = await sharp({ create: { width: 12, height: 8, channels: 3, background: "red" } })
      .withExif({ IFD0: { Artist: "private owner", ImageDescription: "private location" } }).jpeg().toBuffer();
    await upload({ base64: input.toString("base64"), filename: "../../secret.html", mimeType: "text/html" });
    expect(storage.writes).toHaveLength(1);
    const stored = storage.writes[0];
    const metadata = await sharp(stored.data).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(stored.mime).toBe("image/webp");
    expect(stored.key).not.toMatch(/\.\.|secret|html/);
    expect(stored.key.endsWith(".webp")).toBe(true);
  });
  it("rejects malformed base64 rather than silently decoding a partial file", async () => {
    const bytes = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer();
    await expect(caller().admin.uploadPhoto({ base64: bytes.toString("base64") + "!", filename: "a.png", purpose: "publicCover" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(storage.writes).toHaveLength(0);
  });
  it("rejects SVG even when its MIME says JPEG", async () => {
    await expect(caller().admin.uploadPhoto({ base64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>').toString("base64"), filename: "a.jpg", purpose: "publicCover" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(storage.writes).toHaveLength(0);
  });
  it("rejects small compressed images with excessive decoded pixel dimensions", async () => {
    const bytes = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: "red" } }).png().toBuffer();
    await expect(caller().admin.uploadPhoto({ base64: bytes.toString("base64"), filename: "a.png", purpose: "publicCover" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(storage.writes).toHaveLength(0);
  });
  it("rotates by EXIF Orientation before stripping metadata", async () => {
    const bytes = await sharp({ create: { width: 12, height: 8, channels: 3, background: "red" } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    await caller().admin.uploadPhoto({ base64: bytes.toString("base64"), filename: "a.jpg", purpose: "publicCover" });
    const metadata = await sharp(storage.writes[0].data).metadata();
    expect(metadata.width).toBe(8);
    expect(metadata.height).toBe(12);
    expect(metadata.orientation).toBeUndefined();
  });
});
