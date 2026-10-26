import { afterEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { fileForPhotoUpload } from "../apps/frontend/src/shared/media/image-upload";
import { preparePhoto } from "../apps/backend/src/media/photos";

afterEach(() => vi.unstubAllGlobals());

it.each(["jpeg", "png", "webp"] as const)(
  "preserves already bounded %s bytes before the server's final encode",
  async (format) => {
    const bytes = await sharp({
      create: {
        width: 24,
        height: 16,
        channels: 4,
        background: { r: 100, g: 50, b: 20, alpha: 0.4 },
      },
    })
      .toFormat(format)
      .toBuffer();
    const closed = vi.fn();
    vi.stubGlobal("createImageBitmap", async () => ({
      width: 24,
      height: 16,
      close: closed,
    }));
    vi.stubGlobal("document", {
      createElement: () => {
        throw new Error("Unexpected additional image encode");
      },
    });
    const file = await fileForPhotoUpload(
      new File([bytes], `photo.${format}`, { type: `image/${format}` }),
      { preserveAlpha: true },
    );
    expect(Buffer.from(await file.arrayBuffer())).toEqual(bytes);
    expect(file.type).toBe(`image/${format}`);
    expect(closed).toHaveBeenCalledTimes(1);
    const normalized = await preparePhoto(
      Buffer.from(await file.arrayBuffer()).toString("base64"),
    );
    const metadata = await sharp(normalized).metadata();
    expect(metadata).toMatchObject({ format: "webp", width: 24, height: 16 });
    if (format !== "jpeg") expect(metadata.hasAlpha).toBe(true);
  },
);

it("keeps orientation and metadata removal authoritative on the server", async () => {
  const bytes = await sharp({
    create: { width: 24, height: 16, channels: 3, background: "red" },
  })
    .withExif({ IFD0: { Artist: "private fixture" } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  vi.stubGlobal("createImageBitmap", async () => ({
    width: 16,
    height: 24,
    close: () => {},
  }));
  vi.stubGlobal("document", {
    createElement: () => {
      throw new Error("Unexpected additional image encode");
    },
  });
  const prepared = await fileForPhotoUpload(
    new File([bytes], "oriented.jpg", { type: "image/jpeg" }),
  );
  const normalized = await preparePhoto(
    Buffer.from(await prepared.arrayBuffer()).toString("base64"),
  );
  const metadata = await sharp(normalized).metadata();
  expect(metadata).toMatchObject({ format: "webp", width: 16, height: 24 });
  expect(metadata.exif).toBeUndefined();
  expect(metadata.orientation).toBeUndefined();
});
