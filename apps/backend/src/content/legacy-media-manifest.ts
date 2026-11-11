/** Подготавливаем проверяемый план переноса старых вложений до изменения файлов и привязок. */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import sharp from "sharp";
import { digest } from "../media/private-upload-object";
import { detectBinaryFileType } from "../media/file-signature";
import { resolveMediaContentType } from "./media-content-type";
import { isDeliverableAttachmentMime } from "../media/private-attachment-mime";
import { privateUploadKey } from "./private-upload-key";
import { legacySource } from "../media/legacy-source";

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
      .refine((url) => Boolean(legacySource(url))),
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
/** Возвращает BAD_REQUEST для неподтверждённого manifest/bytes без исходных путей или содержимого в ответе. */
const invalid = () =>
  new TRPCError({
    code: "BAD_REQUEST",
    message: "Нужен проверенный список переноса и исходные байты",
  });

/** Operator-owned bytes only. No URL/path reads, re-encoding, public upload or ACL changes. */
/** Проверяет operator manifest и точные длину/hash/slot, копирует bytes до await, валидирует полное изображение либо MIME без перекодирования и строит immutable payloadHash. */
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
  return {
    ...input,
    transport: "bytes" as const,
    bytes,
    mimeType,
    sha256,
    payloadHash,
  };
}

const streamManifest = manifest
  .omit({ bytes: true, expectedSourceSha256: true })
  .extend({
    transport: z.literal("s3Stream"),
    type: z.literal("video"),
    expectedSourceBytes: z
      .number()
      .int()
      .positive()
      .max(1024 * 1024 * 1024),
    expectedSourceSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    expectedSourceETag: z
      .string()
      .max(128)
      .regex(/^"[a-zA-Z0-9-]+"$/),
    probe: z.instanceof(Buffer),
  })
  .strict();

/** Допускает только старое postMedia-видео до1 GiB из фиксированного bucket-prefix, проверяет bounded probe/ETag и связывает их с stream-intent. */
async function prepareLegacyStream(raw: unknown) {
  const parsed = streamManifest.safeParse(raw);
  if (!parsed.success) throw invalid();
  const input = parsed.data;
  if (
    input.subject.kind !== "postMedia" ||
    input.probe.length < 16 ||
    input.probe.length > 65536 ||
    input.probe.length > input.expectedSourceBytes ||
    digest(JSON.stringify([input.subject, input.expectedOldUrl])) !==
      input.operationId
  )
    throw invalid();
  const key = legacySource(input.expectedOldUrl)!.key;
  if (!/^(?:feed\/(videos|reels)|club\/tg)\//.test(key)) throw invalid();
  const probe = Buffer.from(input.probe);
  let mimeType: string;
  try {
    mimeType = await resolveMediaContentType("video", "video/mp4", probe);
  } catch {
    throw invalid();
  }
  if (!["video/mp4", "video/webm", "video/quicktime"].includes(mimeType))
    throw invalid();
  const payloadHash = digest(
    JSON.stringify([
      "legacy-stream:v1",
      input.operationId,
      input.type,
      input.filename,
      mimeType,
      input.expectedSourceETag,
      input.expectedSourceSha256,
      input.expectedSourceBytes,
      digest(probe),
    ]),
  );
  return {
    ...input,
    probe,
    mimeType,
    sha256: input.expectedSourceSha256,
    payloadHash,
    transferSource: {
      key,
      etag: input.expectedSourceETag,
      sha256: input.expectedSourceSha256,
    },
  };
}

/** Подготавливаем план до применения изменений; наличие плана само по себе ничего не переносит. */
/** Выбирает явный s3Stream либо проверку предоставленных bytes; подготовка не читает URL/path, не меняет ACL и не переносит файл. */
export async function prepareLegacyMigration(raw: unknown) {
  return z.object({ transport: z.literal("s3Stream") }).safeParse(raw).success
    ? prepareLegacyStream(raw)
    : prepareLegacyMedia(raw);
}
export type LegacyMediaPlan = Awaited<
  ReturnType<typeof prepareLegacyMigration>
>;
