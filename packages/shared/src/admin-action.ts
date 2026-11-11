/** Общий контракт ключей и результатов повторяемых административных действий. */
import { z } from "zod";

export const adminActionKey = z.uuidv4();
const userId = z.number().int().positive().safe();
const kind = z.enum(["grantClub", "resendAccessEmail"]);
export const adminActionOutcome = z.union([
  z
    .object({
      state: z.literal("succeeded"),
      kind: z.literal("grantClub"),
      userId,
      expiresAt: z.iso.datetime(),
    })
    .strict(),
  z
    .object({
      state: z.literal("succeeded"),
      kind: z.literal("resendAccessEmail"),
      userId,
      queued: z.literal(true),
    })
    .strict(),
  z
    .object({
      state: z.literal("rejected"),
      kind,
      userId,
      code: z.enum(["NOT_FOUND", "CONFLICT"]),
    })
    .strict(),
]);
export type AdminActionOutcome = z.infer<typeof adminActionOutcome>;
export type AdminActionKind = z.infer<typeof kind>;
