import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { saveVkPoster } from "../apps/backend/src/media/vk-poster-object";

const source = "a".repeat(64);
const status = (code: number) =>
  Object.assign(new Error("fixture"), { $metadata: { httpStatusCode: code } });
describe("immutable automatic VK covers", () => {
  let send: ReturnType<typeof vi.spyOn>;
  let stored:
    | { key: string; bytes: Buffer; metadata: Record<string, string> }
    | undefined;
  let image: Buffer;
  beforeEach(async () => {
    vi.stubEnv("S3_ENDPOINT", "https://s3.example.test");
    vi.stubEnv("S3_BUCKET", "test-covers");
    vi.stubEnv("S3_ACCESS_KEY", "synthetic");
    vi.stubEnv("S3_SECRET_KEY", "synthetic");
    stored = undefined;
    image = await sharp({
      create: { width: 64, height: 36, channels: 3, background: "#807060" },
    })
      .png()
      .toBuffer();
    send = vi.spyOn(S3Client.prototype, "send").mockImplementation((async (
      command: unknown,
    ) => {
      if (command instanceof HeadObjectCommand) {
        if (!stored || command.input.Key !== stored.key) throw status(404);
        return {
          ContentLength: stored.bytes.length,
          ContentType: "image/webp",
          Metadata: stored.metadata,
        };
      }
      if (!(command instanceof PutObjectCommand))
        throw new Error("Unexpected write");
      expect(command.input).toMatchObject({
        IfNoneMatch: "*",
        ACL: "public-read",
        CacheControl: "public, max-age=31536000, immutable",
      });
      stored = {
        key: command.input.Key!,
        bytes: Buffer.from(command.input.Body as Buffer),
        metadata: command.input.Metadata!,
      };
      return {};
    }) as never);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  it("creates a bounded WebP and reuses the same immutable object on retry", async () => {
    const url = await saveVkPoster(source, image, AbortSignal.timeout(1000));
    const first = stored!;
    const hash = createHash("sha256").update(first.bytes).digest("hex");
    expect(url).toBe(
      `https://s3.example.test/test-covers/covers/vk-v1/${source}/${hash}.webp`,
    );
    expect(await sharp(first.bytes).metadata()).toMatchObject({
      format: "webp",
      width: 64,
      height: 36,
    });
    expect(await saveVkPoster(source, image, AbortSignal.timeout(1000))).toBe(
      url,
    );
    expect(
      send.mock.calls.filter(([c]: [unknown]) => c instanceof PutObjectCommand),
    ).toHaveLength(1);
  });
  it("recovers a lost PUT acknowledgement by HEAD on the next call without another PUT", async () => {
    const original = send.getMockImplementation()!;
    send.mockImplementation((async (command: unknown) => {
      const result = await original(command);
      if (command instanceof PutObjectCommand) throw new Error("lost ACK");
      return result;
    }) as never);
    await expect(
      saveVkPoster(source, image, AbortSignal.timeout(1000)),
    ).rejects.toThrow("lost ACK");
    const key = stored!.key;
    expect(
      await saveVkPoster(source, image, AbortSignal.timeout(1000)),
    ).toContain(key);
    expect(
      send.mock.calls.filter(([c]: [unknown]) => c instanceof PutObjectCommand),
    ).toHaveLength(1);
  });
  it("refuses a pre-existing object with mismatched evidence without overwriting it", async () => {
    await saveVkPoster(source, image, AbortSignal.timeout(1000));
    stored!.metadata = { ...stored!.metadata, sha256: "b".repeat(64) };
    await expect(
      saveVkPoster(source, image, AbortSignal.timeout(1000)),
    ).rejects.toThrow("integrity");
    expect(
      send.mock.calls.filter(([c]: [unknown]) => c instanceof PutObjectCommand),
    ).toHaveLength(1);
  });
  it("rejects invalid image bytes and source identity before any object request", async () => {
    await expect(
      saveVkPoster(source, Buffer.from("<svg/>"), AbortSignal.timeout(1000)),
    ).rejects.toThrow();
    await expect(
      saveVkPoster("../other", image, AbortSignal.timeout(1000)),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});
