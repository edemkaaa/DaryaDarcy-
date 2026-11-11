/** Проверяем канонический Base64 и ограничиваем декодирование до выделения больших буферов. */
import { TRPCError } from "@trpc/server";

// Matches the existing media JSON ceiling in _core/request-bodies.ts. The HTTP
// limit also includes JSON metadata, so this does not increase accepted body size.
const MAX_ENCODED_MEDIA_LENGTH = 50 * 1024 * 1024;
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const invalidEncoding = () => new TRPCError({
  code: "BAD_REQUEST",
  message: "Некорректные данные файла",
});

/** Strict canonical encoding and decoded-size check without allocating a media buffer. */
export function validateMediaBase64(base64: string, maxDecodedBytes?: number): void {
  if (
    !base64.length ||
    base64.length > MAX_ENCODED_MEDIA_LENGTH ||
    base64.length % 4 !== 0 ||
    /[^A-Za-z0-9+/=]/.test(base64)
  ) {
    throw invalidEncoding();
  }
  const firstPadding = base64.indexOf("=");
  const padding = firstPadding < 0 ? 0 : base64.length - firstPadding;
  if (padding > 2 || (padding === 2 && base64[base64.length - 1] !== "=")) {
    throw invalidEncoding();
  }
  // Buffer.from accepts nonzero unused bits. Check only the final sextet instead
  // of allocating another complete Base64 string to compare with the input.
  if (padding) {
    const lastSextet = BASE64_ALPHABET.indexOf(base64[base64.length - padding - 1]!);
    if (lastSextet & (padding === 2 ? 15 : 3)) throw invalidEncoding();
  }
  const decodedLength = (base64.length / 4) * 3 - padding;
  if (maxDecodedBytes !== undefined && decodedLength > maxDecodedBytes) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE" });
  }
}

/** Strict canonical encoding; an optional decoded ceiling is checked before allocation. */
export function decodeMediaBase64(base64: string, maxDecodedBytes?: number): Buffer {
  validateMediaBase64(base64, maxDecodedBytes);
  return Buffer.from(base64, "base64");
}
