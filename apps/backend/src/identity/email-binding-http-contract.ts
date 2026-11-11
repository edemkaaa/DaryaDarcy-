/** Публичные ответы привязки содержат состояние операции без proof, cipher и адреса; подтверждение имеет отдельный вход. */
import { z } from "zod";
import { emailBindingRequestKeySchema } from "./email-binding";

export const emailBindingReceiptSchema = z
  .object({
    requestKey: emailBindingRequestKeySchema,
    state: z.enum(["pending", "confirmed", "expired", "cancelled"]),
  })
  .strict();
export const emailBindingStatusSchema = emailBindingReceiptSchema
  .extend({
    userId: z.number().int().min(1).max(2147483647),
    delivery: z.enum(["queued", "sent", "unavailable"]),
    expiresAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
  })
  .strict();
export const emailBindingConfirmationSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();
