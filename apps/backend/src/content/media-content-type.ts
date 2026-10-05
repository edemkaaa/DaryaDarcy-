import { TRPCError } from "@trpc/server";
import type { MediaUploadInput } from "./media-upload-input";

const DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
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
