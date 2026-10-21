import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { expect, it } from "vitest";

const publicRoot = resolve("apps/frontend/public");

it.each([192, 512])(
  "ships a decodable %ipx install icon matching its manifest declaration",
  async (size) => {
    const manifest = JSON.parse(
      await readFile(resolve(publicRoot, "manifest.webmanifest"), "utf8"),
    );
    const icon = manifest.icons.find(
      (entry: { sizes: string }) => entry.sizes === `${size}x${size}`,
    );
    expect(icon, `Missing ${size}px install icon`).toBeDefined();
    const url = new URL(icon.src, "https://app.example.test");
    expect(url.origin).toBe("https://app.example.test");
    const bytes = await readFile(resolve(publicRoot, `.${url.pathname}`));
    const decoded = await sharp(bytes)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(decoded.info.width).toBe(size);
    expect(decoded.info.height).toBe(size);
    expect((await sharp(bytes).metadata()).format).toBe("png");
    expect(icon.type).toBe("image/png");
  },
);
