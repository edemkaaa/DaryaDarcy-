/** Ограничение текста учитывает размер UTF-8, соответствующий полю MySQL, а не только число символов. */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

// MySQL TEXT stores at most 65535 UTF-8 bytes, irrespective of character count.
export const POST_TEXT_MAX_BYTES = 65_535;
const message =
  "Текст публикации слишком длинный. Сократите его или разделите на несколько постов";
export const postTextInput = z
  .string()
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= POST_TEXT_MAX_BYTES,
    message,
  );

export function assertPostTextSize(value: string): void {
  if (Buffer.byteLength(value, "utf8") > POST_TEXT_MAX_BYTES)
    throw new TRPCError({ code: "BAD_REQUEST", message });
}
