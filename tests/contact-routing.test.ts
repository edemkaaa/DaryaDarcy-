/** Проверяем согласованный публичный адрес поддержки и default-получателя заказа без отправки писем. */
import { expect, it } from "vitest";
import { PUBLIC_CONTACT_EMAIL } from "../apps/frontend/src/shared/config/contact";
import { managerOrderEmail } from "../apps/frontend/src/domain/product/manager-order-email";
import { defaultLaunchConfiguration } from "../apps/backend/src/launch/settings";
import { protectedProcedure, router } from "../apps/backend/src/_core/trpc";
import type { TrpcContext } from "../apps/backend/src/_core/context";

const recipient = "daryadarcy19@gmail.com";

/** Сверяем только адрес mailto; это не подтверждение доставки заказа. */
it("routes public support and default shop orders to the approved owner", () => {
  expect(new URL(`mailto:${PUBLIC_CONTACT_EMAIL}`).pathname).toBe(recipient);
  const href = managerOrderEmail(
    {
      revision: 0,
      managerEmail: defaultLaunchConfiguration.managerEmail,
      orderMethod: "email-client",
    },
    { id: "synthetic", title: "Test product" },
    "https://app.example.test",
  );
  expect(new URL(href).pathname).toBe(recipient);
});

/** Заблокированный actor получает контакт в отказе, но защищённая операция не выполняется. */
it("gives a blocked account the same support address without allowing the operation", async () => {
  const api = router({ probe: protectedProcedure.query(() => "must not run") });
  const caller = api.createCaller({
    user: { id: 1, blockedAt: new Date() },
  } as TrpcContext);
  await expect(caller.probe()).rejects.toMatchObject({
    code: "FORBIDDEN",
    message: `Аккаунт заблокирован. Напишите на ${recipient}`,
  });
});
