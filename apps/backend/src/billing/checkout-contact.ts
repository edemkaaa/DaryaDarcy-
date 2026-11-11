/** Нормализует контактный телефон оплаты и сохраняет совместимость хеша старых заказов без номера. */
import { TRPCError } from "@trpc/server";
import { contactPhoneSchema } from "../../../../packages/shared/src/checkout-contact";
import { billingKey } from "./protocol";

export function requireCheckoutContact(value: unknown): string {
  const parsed = contactPhoneSchema.safeParse(value);
  if (!parsed.success)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Укажите корректный номер телефона с кодом страны",
    });
  return parsed.data;
}
/** NULL сохраняет пригодность хеша старых заказов без контактного номера. */
export function checkoutRequestHash(
  plan: string,
  email: string,
  phone?: string | null,
) {
  return billingKey(phone ? ["v2", plan, email, phone] : ["v1", plan, email]);
}
