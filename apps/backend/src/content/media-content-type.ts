/** Нормализуем MIME и определяем тип содержимого перед обработкой и выдачей вложения. */
import { TRPCError } from "@trpc/server";
import { detectBinaryFileType } from "../media/file-signature";
import type { MediaUploadInput } from "./media-upload-input";
import { resolveTextContentType } from "./text-content-type";

const DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const BYTE_CHECKED_DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// Bounded ASCII token / quoted-string parameters (RFC 9110 §5.6.6). No controls,
// obs-text or empty parameters; preserve valid charset/codecs rather than discard.
const MIME_ESSENCE = /^[!#$%&'*+.^_`|~a-z0-9-]+\/[!#$%&'*+.^_`|~a-z0-9-]+$/i;
const MIME_PARAMETERS =
  /^(?: *; *[!#$%&'*+.^_`|~a-z0-9-]+=(?:[!#$%&'*+.^_`|~a-z0-9-]+|"(?:[\x20-\x21\x23-\x5b\x5d-\x7e]|\\[\x20-\x7e])*"))* *$/i;

/** Declared header policy only; compatible MIME is not proof of the file's bytes. */
export function normalizeMediaContentType(
  type: MediaUploadInput["type"],
  declared: string,
): string {
  // Match the SQL metadata ceiling and reject header controls before normalization.
  if (declared.length > 128 || /[\x00-\x1f\x7f]/.test(declared)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Некорректный тип файла",
    });
  }
  const separator = declared.indexOf(";");
  const mime = (separator === -1 ? declared : declared.slice(0, separator))
    .trim()
    .toLowerCase();
  const parameters =
    separator === -1 ? "" : declared.slice(separator).trimEnd();
  const compatible =
    mime === "application/octet-stream" ||
    (type === "document"
      ? DOCUMENT_MIMES.has(mime)
      : mime.startsWith(`${type}/`));
  if (
    !MIME_ESSENCE.test(mime) ||
    !MIME_PARAMETERS.test(parameters) ||
    !compatible
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Некорректный тип файла",
    });
  }
  return mime + parameters;
}

/** Expects normalized declared metadata; signatures are not track/playback/safety validation. */
export async function resolveMediaContentType(
  type: MediaUploadInput["type"],
  declared: string,
  bytes: Buffer,
): Promise<string> {
  const semicolon = declared.indexOf(";");
  const declaredEssence =
    semicolon < 0 ? declared : declared.slice(0, semicolon);
  // Legacy DOC needs a Word-specific detector, not generic CFB magic. This one
  // declared type remains unverified; do not claim a complete document boundary.
  if (type === "document" && declaredEssence === "application/msword")
    return declared;
  const detected = await detectBinaryFileType(bytes);
  if (type === "document") {
    if (declaredEssence === "application/octet-stream") {
      if (detected && BYTE_CHECKED_DOCUMENT_MIMES.has(detected.mime))
        return detected.mime;
      if (!detected) return resolveTextContentType("text/plain", bytes);
    }
    if (declaredEssence === "text/plain" && !detected)
      return resolveTextContentType(declared, bytes);
    if (detected?.mime === declaredEssence) return declared;
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Формат файла не соответствует заявленному типу",
    });
  }
  if (!detected)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Не удалось распознать файл",
    });
  // Audio-only WebM and generic MP4 share video container signatures. Do not
  // mistake container branding or retained codec metadata for track inspection.
  const canonical =
    type === "audio" && ["webm", "mp4"].includes(detected.ext)
      ? `audio/${detected.ext}`
      : detected.mime.toLowerCase();
  if (!canonical.startsWith(`${type}/`)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Формат файла не соответствует категории",
    });
  }
  // Keep parameters only for an exact essence match; otherwise the server's
  // detected MIME replaces aliases, picker fallback and wrong same-family labels.
  return declaredEssence === canonical ? declared : canonical;
}
