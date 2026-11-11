/** Проверяем параметры текстовой кодировки после нормализации MIME; это не проверка безопасности разметки. */
import { TRPCError } from "@trpc/server";
import { MIMEType } from "node:util";

const TEXT_ENCODINGS = new Set([
  "utf-8",
  "utf-16le",
  "utf-16be",
  "windows-1251",
]);
// Operates only on headers already accepted by normalizeMediaContentType.
// Consume whole quoted parameters so embedded ";charset=..." is not a charset.
const PARAMETERS = /; *([^=; ]+)=(?:"(?:[^"\\]|\\.)*"|[^; ]+)/g;
const NON_TEXT_CONTROLS = /[\x00-\x08\x0b\x0e-\x1f\x7f-\x9f]/;

/** Validates text encoding, not markup, content safety or arbitrary legacy encodings. */
export function resolveTextContentType(
  declared: string,
  bytes: Buffer,
): string {
  try {
    const charsets = [...declared.matchAll(PARAMETERS)].filter(
      (parameter) => parameter[1].toLowerCase() === "charset",
    );
    if (charsets.length > 1) throw new Error("ambiguous charset");
    const charset = new MIMEType(declared).params.get("charset");
    let bom: string | undefined;
    if (bytes[0] === 0xff && bytes[1] === 0xfe) bom = "utf-16le";
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) bom = "utf-16be";
    else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
      bom = "utf-8";
    const decoder = new TextDecoder(charset ?? bom ?? "utf-8", { fatal: true });
    if (
      !TEXT_ENCODINGS.has(decoder.encoding) ||
      (bom && bom !== decoder.encoding)
    )
      throw new Error("unsupported or conflicting encoding");
    const resolved =
      charset === null ? `${declared}; charset=${decoder.encoding}` : declared;
    // Appending the missing charset must not exceed the SQL/header ceiling.
    if (resolved.length > 128) throw new Error("resolved MIME too long");

    // Bounded temporary strings; streaming retains split code points/surrogates.
    // Scan the complete size-bounded file and flush to catch an incomplete tail.
    for (let offset = 0; offset < bytes.length; offset += 16_384) {
      const text = decoder.decode(bytes.subarray(offset, offset + 16_384), {
        stream: true,
      });
      if (NON_TEXT_CONTROLS.test(text)) throw new Error("non-text control");
    }
    if (NON_TEXT_CONTROLS.test(decoder.decode()))
      throw new Error("non-text control");
    return resolved;
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Некорректный текстовый файл или кодировка",
    });
  }
}
