/** Проверяем состав и происхождение файлов Библиотеки при подготовке и осмотре плана переноса. */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import sharp from "sharp";
import { digest } from "../media/private-upload-object";
import { privateUploadKey } from "./private-upload-key";
import { libraryMaterialKeys } from "./library-material-keys";
import {
  normalizeMediaContentType,
  resolveMediaContentType,
} from "./media-content-type";

const entry = z
  .object({
    fileKey: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    filename: z
      .string()
      .min(1)
      .max(512)
      .refine((value) => !/[\x00-\x1f\x7f/\\]/.test(value)),
    mimeType: z.string().min(1).max(128),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.instanceof(Buffer),
    sortOrder: z.number().int().nonnegative().max(2147483646),
    expectedRevision: z.number().int().nonnegative().max(2147483646),
  })
  .strict();
const manifest = z
  .object({
    materialKey: z.enum(libraryMaterialKeys),
    idempotencyKey: privateUploadKey,
    files: z.array(entry).min(1).max(100),
  })
  .strict();
const invalid = () =>
  new TRPCError({
    code: "BAD_REQUEST",
    message: "Некорректный список переноса",
  });

/** Own operator-provided bytes only: no path, URL, env file or network reading. */
export async function prepareLibraryMigration(raw: unknown) {
  const parsed = manifest.safeParse(raw);
  if (!parsed.success) throw invalid();
  const input = parsed.data;
  if (
    new Set(input.files.map((file) => file.fileKey)).size !== input.files.length
  )
    throw invalid();
  if (
    input.files.reduce((total, file) => total + file.bytes.length, 0) >
    64 * 1024 * 1024
  )
    throw invalid();
  const files = [];
  for (const file of input.files.sort((a, b) =>
    a.fileKey.localeCompare(b.fileKey),
  )) {
    // Copy before the first await so later caller mutation cannot change verified bytes.
    const bytes = Buffer.from(file.bytes);
    if (digest(bytes) !== file.sha256 || !bytes.length) throw invalid();
    let mimeType: string, usage: "libraryPhoto" | "libraryDocument";
    if (file.mimeType.startsWith("image/")) {
      if (bytes.length > 4 * 1024 * 1024) throw invalid();
      const signatures = new Map([
        [
          "image/jpeg",
          bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
        ],
        [
          "image/png",
          bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        ],
        [
          "image/webp",
          bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP",
        ],
      ]);
      if (!signatures.get(file.mimeType)) throw invalid();
      try {
        const image = sharp(bytes, {
          failOn: "warning",
          limitInputPixels: 20_000_000,
        });
        const meta = await image.metadata();
        if (
          (meta.pages ?? 1) !== 1 ||
          meta.exif ||
          meta.xmp ||
          meta.iptc ||
          !meta.width ||
          !meta.height
        )
          throw invalid();
        await image.raw().timeout({ seconds: 10 }).toBuffer();
      } catch {
        throw invalid();
      }
      mimeType = file.mimeType;
      usage = "libraryPhoto";
    } else {
      if (bytes.length > 32 * 1024 * 1024) throw invalid();
      const declared = normalizeMediaContentType("document", file.mimeType);
      if (
        ![
          "application/pdf",
          "text/plain",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ].includes(declared.split(";")[0])
      )
        throw invalid();
      mimeType = await resolveMediaContentType("document", declared, bytes);
      usage = "libraryDocument";
    }
    files.push({ ...file, bytes, mimeType, usage });
  }
  const payloadHash = digest(
    JSON.stringify([
      input.materialKey,
      files.map(({ bytes, ...file }) => ({ ...file, size: bytes.length })),
    ]),
  );
  return { ...input, files, payloadHash };
}

/** Проверяем состояние переноса без подмены его новым применением. */
export async function inspectLibraryMigration(input: unknown) {
  const plan = await prepareLibraryMigration(input);
  return {
    materialKey: plan.materialKey,
    files: plan.files.length,
    totalBytes: plan.files.reduce(
      (total, file) => total + file.bytes.length,
      0,
    ),
    payloadHash: plan.payloadHash,
  };
}
