import { TRPCError } from "@trpc/server";
import { z } from "zod";
import sharp from "sharp";
import { digest } from "../media/private-upload-object";
import { detectBinaryFileType } from "../media/file-signature";
import { resolveMediaContentType } from "./media-content-type";
import { isDeliverableAttachmentMime } from "../media/private-attachment-mime";
import { privateUploadKey } from "./private-upload-key";

const subjectSchema = z
  .object({
    kind: z.enum(["postPhoto", "articleMedia", "postMedia"]),
    id: z.number().int().min(1).max(2147483647),
    slot: z.string().max(128),
  })
  .strict()
  .refine((value) =>
    value.kind === "postPhoto"
      ? /^photos\.\d{1,5}$/.test(value.slot)
      : value.kind === "postMedia"
        ? value.slot === "url"
        : /^sections\.[1-9]\d{0,4}\.(?:url|urls\.\d{1,5})$/.test(value.slot),
  );
const manifest = z
  .object({
    version: z.literal(1),
    idempotencyKey: privateUploadKey,
    operationId: z.string().regex(/^[a-f0-9]{64}$/),
    subject: subjectSchema,
    expectedOldUrl: z
      .string()
      .max(8192)
      .regex(
        /^https:\/\/s3\.twcstorage\.ru\/daryadarcy-s3\/(?:feed|articles)\/[A-Za-z0-9._/-]+$/,
      )
      .refine(
        (url) =>
          new URL(url).href === url &&
          !url.includes("private-v1") &&
          !url.includes("//", "https://".length),
      ),
    expectedSourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    expectedSourceBytes: z
      .number()
      .int()
      .positive()
      .max(80 * 1024 * 1024),
    preserveOriginal: z.literal(true),
    type: z.enum(["photo", "document", "audio", "video"]),
    filename: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .refine((name) => !/[\x00-\x1f\x7f/\\]/.test(name)),
    bytes: z.instanceof(Buffer),
  })
  .strict();
const invalid = () =>
  new TRPCError({
    code: "BAD_REQUEST",
    message: "Нужен проверенный список переноса и исходные байты",
  });

/** Operator-owned bytes only. No URL/path reads, re-encoding, public upload or ACL changes. */
export async function prepareLegacyMedia(raw: unknown) {
  const parsed = manifest.safeParse(raw);
  if (!parsed.success) throw invalid();
  const input = parsed.data;
  if (
    input.bytes.length !== input.expectedSourceBytes ||
    input.bytes.length > (input.type === "video" ? 80 : 32) * 1024 * 1024 ||
    (input.subject.kind === "postPhoto" && input.type !== "photo") ||
    (input.subject.kind === "postMedia" && input.type === "photo") ||
    (input.subject.kind === "articleMedia" &&
      !["photo", "document"].includes(input.type)) ||
    digest(JSON.stringify([input.subject, input.expectedOldUrl])) !==
      input.operationId
  )
    throw invalid();
  // Capture before the first await. Verified bytes cannot be changed by the caller.
  const bytes = Buffer.from(input.bytes);
  if (digest(bytes) !== input.expectedSourceSha256) throw invalid();
  let mimeType: string;
  try {
    if (input.type === "photo") {
      const detected = await detectBinaryFileType(bytes);
      if (
        !detected ||
        !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
          detected.mime,
        )
      )
        throw invalid();
      const image = sharp(bytes, {
        animated: true,
        failOn: "warning",
        limitInputPixels: 20_000_000,
      });
      const meta = await image.metadata(),
        frames = meta.pages ?? 1;
      if (
        !meta.width ||
        !meta.height ||
        frames > 200 ||
        meta.width * (meta.pageHeight ?? meta.height) * frames > 20_000_000
      )
        throw invalid();
      await image.raw().timeout({ seconds: 10 }).toBuffer();
      mimeType = detected.mime;
    } else {
      const detected = await detectBinaryFileType(bytes);
      const declared =
        input.type === "document"
          ? (detected?.mime ?? "text/plain")
          : input.type === "video"
            ? "video/mp4"
            : "audio/mpeg";
      mimeType = await resolveMediaContentType(input.type, declared, bytes);
      if (
        !isDeliverableAttachmentMime(mimeType) ||
        (input.type === "document" &&
          ![
            "text/plain",
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ].includes(mimeType.split(";")[0]))
      )
        throw invalid();
    }
  } catch {
    throw invalid();
  }
  const sha256 = digest(bytes);
  const payloadHash = digest(
    JSON.stringify([
      input.operationId,
      input.type,
      input.filename,
      mimeType,
      sha256,
      bytes.length,
    ]),
  );
  return { ...input, bytes, mimeType, sha256, payloadHash };
}

export type LegacyMediaPlan = Awaited<ReturnType<typeof prepareLegacyMedia>>;
