import { TRPCError } from "@trpc/server";

// Matches the existing media JSON ceiling in _core/request-bodies.ts. The HTTP
// limit also includes JSON metadata, so this does not increase accepted body size.
const MAX_ENCODED_MEDIA_LENGTH = 50 * 1024 * 1024;

/** Encoding integrity only: this does not validate the file format or MIME. */
export function decodeMediaBase64(base64: string): Buffer {
  if (
    !base64.length ||
    base64.length > MAX_ENCODED_MEDIA_LENGTH ||
    base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Некорректные данные файла",
    });
  }
  const bytes = Buffer.from(base64, "base64");
  // Buffer.from tolerates invalid padding bits; require the canonical encoding.
  if (bytes.toString("base64") !== base64) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Некорректные данные файла",
    });
  }
  return bytes;
}
