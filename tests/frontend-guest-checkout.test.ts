import { afterEach, beforeEach, expect, it, vi } from "vitest";
import superjson from "superjson";
import { createTRPCClient } from "../apps/frontend/src/shared/api/trpc";
import { cancelSessionRequests } from "../apps/frontend/src/shared/api/request-lifecycle";
import { setPersonalDataOwner } from "../apps/frontend/src/shared/browser/storage";
import {
  GUEST_CHECKOUT_STORAGE_KEY as slot,
  GuestCheckoutJournal,
  checkGuestCheckout,
  createGuestCheckout,
} from "../apps/frontend/src/features/club/guest-normal-checkout";
import { isGuestCheckoutRecoveryEnabled } from "../apps/frontend/src/features/club/payment-mode";

let values: Map<string, string>;
let response: unknown;
let status: number;
const selection = { contactPhone: "+79991234567", email: "guest@example.test", plan: "monthly" as const };
const signal = () => /* Создаёт независимый сигнал пользовательского действия для гостевой покупки. */ new AbortController().signal;
const fetcher = vi.fn(
  async (_url: RequestInfo | URL, _options?: RequestInit) =>
    new Response(
      JSON.stringify(
        status === 200
          ? { result: { data: superjson.serialize(response) } }
          : {
              error: {
                json: {
                  message: "Synthetic refusal",
                  code: -32603,
                  data: { httpStatus: status, code: "INTERNAL_SERVER_ERROR" },
                },
              },
            },
      ),
      {
        status,
        headers: {
          "Content-Type": "application/json",
          ...(status === 429 ? { "Retry-After": "2" } : {}),
        },
      },
    ),
);
// Начальное состояние — подтверждённый гость с пустым журналом и локально заданным pending-ответом; никакой платёжный провайдер не вызывается.
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("window", {
    isSecureContext: true,
    localStorage: {
      getItem: (name: string) => /* Читает синтетический слот гостевого восстановления из памяти. */ values.get(name) ?? null,
      setItem: (name: string, value: string) => /* Сохраняет гостевое намерение в памяти, позволяя проверять порядок перед HTTP. */ values.set(name, value),
      removeItem: (name: string) => /* Удаляет только тестовый слот, не затрагивая другие журналы. */ values.delete(name),
    },
  });
  vi.stubGlobal("navigator", {
    locks: {
      request: async (_name: string, _options: unknown, work: () => unknown) =>
        /* Выполняет работу под имитацией Web Lock без обращения к реальному браузеру. */ work(),
    },
  });
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockClear();
  setPersonalDataOwner(null);
  status = 200;
  response = {
    state: "pending",
    orderId: "guest-order-one",
    url: "https://payments.example.test/guest",
  };
});
afterEach(() => {
  cancelSessionRequests();
  setPersonalDataOwner(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("persists a canonical email, UUID and 32 cryptographic bytes before dispatch; sends separate POSTs without proof in URLs or headers", async () => {
  // Сценарий: Каноническая почта, UUID и секрет из 32 случайных байт сохраняются до отдельных POST; доказательство не попадает в URL/заголовки.

  const journal = new GuestCheckoutJournal(null);
  const intent = await journal.prepare(
    { ...selection, email: " Guest@Example.Test " },
    signal(),
  );
  expect(JSON.parse(values.get(slot)!)).toEqual(intent);
  expect(intent.email).toBe(selection.email);
  expect(Buffer.from(intent.recoveryToken, "base64url")).toHaveLength(32);
  expect(
    Buffer.from(intent.recoveryToken, "base64url").toString("base64url"),
  ).toBe(intent.recoveryToken);
  fetcher.mockImplementationOnce(async (url, options) => {
    expect(JSON.parse(values.get(slot)!)).toEqual(intent);
    expect(String(url)).not.toMatch(/batch|input=|guest%40/);
    expect(String(url)).not.toContain(intent.recoveryToken);
    expect(options?.method).toBe("POST");
    expect(new Headers(options?.headers).has("Idempotency-Key")).toBe(false);
    expect(JSON.parse(String(options?.body))).toEqual({
      json: {
        email: selection.email,
        contactPhone: selection.contactPhone,
        plan: "monthly",
        idempotencyKey: intent.idempotencyKey,
        recoveryToken: intent.recoveryToken,
      },
    });
    return new Response(
      JSON.stringify({ result: { data: superjson.serialize(response) } }),
    );
  });
  await createGuestCheckout(createTRPCClient(), journal, intent, signal());
  expect(values.get(slot)).not.toMatch(/https|expiresAt|session/);
  response = { state: "pending", orderId: "guest-order-one" };
  await checkGuestCheckout(
    createTRPCClient(),
    journal,
    journal.read()!,
    signal(),
  );
  const [url, options] = fetcher.mock.calls[1];
  expect(String(url)).toMatch(/\/club.guestNormalCheckoutStatus$/);
  expect(options?.method).toBe("POST");
  expect(JSON.parse(String(options?.body))).toEqual({
    json: {
      idempotencyKey: intent.idempotencyKey,
      recoveryToken: intent.recoveryToken,
    },
  });
});

it("reload and an unknown network result reuse both keys and the same recipient", async () => {
  // Сценарий: Reload после неопределённого сетевого исхода использует оба прежних ключа и того же получателя.

  const journal = new GuestCheckoutJournal(null);
  const intent = await journal.prepare(selection, signal());
  fetcher.mockRejectedValueOnce(new TypeError("lost response"));
  await expect(
    createGuestCheckout(createTRPCClient(), journal, intent, signal()),
  ).rejects.toThrow();
  const restored = await new GuestCheckoutJournal(null).prepare(
    selection,
    signal(),
  );
  expect(restored).toEqual(intent);
  await createGuestCheckout(createTRPCClient(), journal, restored, signal());
  expect(fetcher.mock.calls[1][1]?.body).toBe(fetcher.mock.calls[0][1]?.body);
});
it.each(["notRecorded", "pending"] as const)(
  "%s never rotates keys or silently changes recipient",
  async (state) => {
    // Сценарий: NotRecorded/pending не меняют ключи, адресата или тариф молча.

    const journal = new GuestCheckoutJournal(null);
    const intent = await journal.prepare(selection, signal());
    response =
      state === "notRecorded"
        ? { state }
        : { state, orderId: "guest-order-one" };
    const before = values.get(slot);
    await expect(
      journal.next(createTRPCClient(), intent, selection, signal()),
    ).rejects.toThrow("ещё не завершена");
    await expect(
      journal.prepare({ ...selection, email: "other@example.test" }, signal()),
    ).rejects.toThrow("менять нельзя");
    await expect(
      journal.prepare({ ...selection, plan: "semiannual" }, signal()),
    ).rejects.toThrow("менять нельзя");
    expect(values.get(slot)).toBe(before);
  },
);
it.each(["succeeded", "failed"] as const)(
  "only an explicit next purchase with fresh %s proof can rotate both keys",
  async (state) => {
    // Сценарий: Только явная следующая покупка со свежим терминальным доказательством меняет оба ключа.

    const journal = new GuestCheckoutJournal(null);
    const intent = await journal.prepare(selection, signal());
    response =
      state === "succeeded"
        ? {
            state,
            orderId: "guest-order-one",
            expiresAt: new Date("2040-11-01"),
          }
        : { state, orderId: "guest-order-one" };
    const next = await journal.next(
      createTRPCClient(),
      intent,
      { email: "second@example.test", plan: "semiannual", contactPhone: "+447700900123" },
      signal(),
    );
    expect(next?.idempotencyKey).not.toBe(intent.idempotencyKey);
    expect(next?.recoveryToken).not.toBe(intent.recoveryToken);
    expect(next?.email).toBe("second@example.test");
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
it.each(["throw", "silent", "insecure", "no-locks", "no-random"])(
  "storage/coordination failure (%s) prevents every network request",
  async (failure) => {
    // Сценарий: Отказ storage, координации или криптографической случайности запрещает сетевую отправку.

    if (failure === "throw")
      window.localStorage.setItem = () => {
        throw new DOMException("quota", "QuotaExceededError");
      };
    if (failure === "silent") window.localStorage.setItem = () => {};
    if (failure === "insecure")
      Object.assign(window, { isSecureContext: false });
    if (failure === "no-locks") vi.stubGlobal("navigator", {});
    if (failure === "no-random") vi.stubGlobal("crypto", {});
    await expect(
      new GuestCheckoutJournal(null).prepare(selection, signal()),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it.each(["broken", JSON.stringify({ version: 1 }), "x".repeat(4097)])(
  "damaged storage is never replaced (%#)",
  async (raw) => {
    // Сценарий: Повреждённый слот не заменяется новым намерением.

    values.set(slot, raw);
    await expect(
      new GuestCheckoutJournal(null).prepare(selection, signal()),
    ).rejects.toThrow();
    expect(values.get(slot)).toBe(raw);
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it.each([409, 412, 500])(
  "HTTP %s preserves the original evidence without fallback",
  async (code) => {
    // Сценарий: HTTP-отказ сохраняет исходное доказательство без fallback.

    const journal = new GuestCheckoutJournal(null);
    const intent = await journal.prepare(selection, signal());
    status = code;
    const before = values.get(slot);
    await expect(
      createGuestCheckout(createTRPCClient(), journal, intent, signal()),
    ).rejects.toThrow();
    expect(values.get(slot)).toBe(before);
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
it("persists Retry-After across reload and blocks both create and status until a manual retry", async () => {
  // Сценарий: Cooldown после 429 переживает reload и блокирует create/status до ручной попытки после срока.

  vi.useFakeTimers();
  const journal = new GuestCheckoutJournal(null);
  const intent = await journal.prepare(selection, signal());
  status = 429;
  await expect(
    createGuestCheckout(createTRPCClient(), journal, intent, signal()),
  ).rejects.toThrow();
  expect(journal.read()?.retryAt).toBe(Date.now() + 2000);
  const restored = new GuestCheckoutJournal(null);
  await expect(
    checkGuestCheckout(
      createTRPCClient(),
      restored,
      restored.read()!,
      signal(),
    ),
  ).rejects.toThrow();
  await expect(
    createGuestCheckout(
      createTRPCClient(),
      restored,
      restored.read()!,
      signal(),
    ),
  ).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(2000);
  expect(fetcher).toHaveBeenCalledTimes(1);
  status = 200;
  response = { state: "notRecorded" };
  await checkGuestCheckout(
    createTRPCClient(),
    restored,
    restored.read()!,
    signal(),
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("persists a cooldown when fresh terminal verification is rate limited", async () => {
  // Сценарий: Квота свежей терминальной проверки сохраняет срок задержки без повторного запроса.

  const journal = new GuestCheckoutJournal(null);
  const intent = await journal.prepare(selection, signal());
  status = 429;
  await expect(
    journal.next(createTRPCClient(), intent, selection, signal()),
  ).rejects.toThrow();
  expect(journal.read()?.retryAt).toBeGreaterThan(Date.now());
  const savedDeadline = journal.read()?.retryAt;
  await expect(
    journal.next(createTRPCClient(), intent, selection, signal()),
  ).rejects.toThrow();
  expect(journal.read()?.retryAt).toBe(savedDeadline);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("a replaced recovery secret is not adopted by an existing purchase operation", async () => {
  // Сценарий: Подменённый секрет восстановления не принимается уже начатой покупкой.

  const journal = new GuestCheckoutJournal(null);
  const intent = await journal.prepare(selection, signal());
  const replacement = Buffer.from(
    crypto.getRandomValues(new Uint8Array(32)),
  ).toString("base64url");
  values.set(slot, JSON.stringify({ ...intent, recoveryToken: replacement }));
  await expect(
    checkGuestCheckout(createTRPCClient(), journal, intent, signal()),
  ).rejects.toThrow("ключ восстановления");
  expect(fetcher).not.toHaveBeenCalled();
  expect(JSON.parse(values.get(slot)!).recoveryToken).toBe(replacement);
});

it("a server refusal preserves the secret without treating it as login or starting another order", async () => {
  // Сценарий: Серверный отказ не стирает секрет и не запускает вход либо новую покупку.

  const journal = new GuestCheckoutJournal(null);
  const intent = await journal.prepare(selection, signal());
  const before = values.get(slot);
  status = 403;
  await expect(
    checkGuestCheckout(createTRPCClient(), journal, intent, signal()),
  ).rejects.toThrow();
  expect(values.get(slot)).toBe(before);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("after login, server-accepted proof binds only the existing purchase to its recipient; logout and other accounts cannot read it", async () => {
  // Сценарий: После входа принятое сервером доказательство связывается только с исходным получателем; другие аккаунты и logout его не читают.

  const intent = await new GuestCheckoutJournal(null).prepare(
    selection,
    signal(),
  );
  setPersonalDataOwner(101);
  const journal = new GuestCheckoutJournal({ id: 101, email: selection.email });
  response = { state: "pending", orderId: "guest-order-one" };
  const reply = await checkGuestCheckout(
    createTRPCClient(),
    journal,
    intent,
    signal(),
  );
  expect(reply.intent.ownerId).toBe(101);
  expect(reply.intent.idempotencyKey).toBe(intent.idempotencyKey);
  expect(reply.intent.recoveryToken).toBe(intent.recoveryToken);
  response = {
    state: "pending",
    orderId: "guest-order-one",
    url: "https://payments.example.test/guest",
  };
  await createGuestCheckout(
    createTRPCClient(),
    journal,
    reply.intent,
    signal(),
  );
  setPersonalDataOwner(102);
  expect(() =>
    new GuestCheckoutJournal({ id: 102, email: selection.email }).read(),
  ).toThrow("другого получателя");
  setPersonalDataOwner(null);
  expect(() => new GuestCheckoutJournal(null).read()).toThrow(
    "другого получателя",
  );
  expect(values.get(slot)).not.toBeNull();
});
it("a different logged-in recipient cannot dispatch the unbound guest proof", async () => {
  // Сценарий: Другой вошедший адресат не отправляет несвязанное гостевое доказательство.

  const intent = await new GuestCheckoutJournal(null).prepare(
    selection,
    signal(),
  );
  setPersonalDataOwner(102);
  await expect(
    checkGuestCheckout(
      createTRPCClient(),
      new GuestCheckoutJournal({ id: 102, email: "other@example.test" }),
      intent,
      signal(),
    ),
  ).rejects.toThrow("другого получателя");
  expect(fetcher).not.toHaveBeenCalled();
});
it("authenticated terminal completion checks fresh proof then clears only the guest slot", async () => {
  // Сценарий: Завершение гостевой операции после входа проверяет свежий статус и очищает только гостевой слот.

  const guest = await new GuestCheckoutJournal(null).prepare(
    selection,
    signal(),
  );
  setPersonalDataOwner(101);
  const journal = new GuestCheckoutJournal({ id: 101, email: selection.email });
  values.set("darcy:user:101:normal-checkout:v1", "preserve");
  response = { state: "failed", orderId: "guest-order-one" };
  expect(
    await journal.next(createTRPCClient(), guest, selection, signal()),
  ).toBeNull();
  expect(values.has(slot)).toBe(false);
  expect(values.get("darcy:user:101:normal-checkout:v1")).toBe("preserve");
});
it("missing/replaced secrets, order mismatch and notRecorded after an acknowledged order cannot erase evidence", async () => {
  // Сценарий: Отсутствие секрета, другой orderId и регресс к notRecorded не стирают подтверждённые сведения о заказе.

  const journal = new GuestCheckoutJournal(null);
  const intent = await journal.prepare(selection, signal());
  await createGuestCheckout(createTRPCClient(), journal, intent, signal());
  response = { state: "pending", orderId: "other-order" };
  await expect(
    checkGuestCheckout(createTRPCClient(), journal, journal.read()!, signal()),
  ).rejects.toThrow();
  response = { state: "notRecorded" };
  await expect(
    checkGuestCheckout(createTRPCClient(), journal, journal.read()!, signal()),
  ).rejects.toThrow();
  values.delete(slot);
  await expect(
    createGuestCheckout(createTRPCClient(), journal, intent, signal()),
  ).rejects.toThrow("ключ восстановления");
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it("a late result from a previous session cannot bind an order or migrate the secret", async () => {
  // Сценарий: Поздний ответ прежней сессии не связывает заказ и не переносит секрет новому аккаунту.

  const journal = new GuestCheckoutJournal(null);
  const intent = await journal.prepare(selection, signal());
  fetcher.mockImplementationOnce(async () => {
    setPersonalDataOwner(102);
    return new Response(
      JSON.stringify({ result: { data: superjson.serialize(response) } }),
    );
  });
  await expect(
    createGuestCheckout(createTRPCClient(), journal, intent, signal()),
  ).rejects.toThrow();
  expect(JSON.parse(values.get(slot)!)).not.toHaveProperty("orderId");
});
it("the guest build opt-in cannot enable either TEST payment mode", () => {
  // Сценарий: Флаг гостевого восстановления не включает TEST-режимы оплаты.

  vi.stubEnv("NEXT_PUBLIC_GUEST_CHECKOUT_RECOVERY_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_PRODAMUS_TEST_ENABLED", "false");
  vi.stubEnv("NEXT_PUBLIC_CLUB_TEST_CHECKOUT", "false");
  expect(isGuestCheckoutRecoveryEnabled()).toBe(true);
  vi.stubEnv("NEXT_PUBLIC_PRODAMUS_TEST_ENABLED", "true");
  expect(isGuestCheckoutRecoveryEnabled()).toBe(false);
  vi.stubEnv("NEXT_PUBLIC_PRODAMUS_TEST_ENABLED", "false");
  vi.stubEnv("NEXT_PUBLIC_CLUB_TEST_CHECKOUT", "true");
  expect(isGuestCheckoutRecoveryEnabled()).toBe(false);
});

it("identifies a foreign recipient without exposing or deleting its saved proof", async () => {
  // Сценарий: Чужой получатель распознаётся без раскрытия или удаления его сохранённого доказательства.

  await new GuestCheckoutJournal(null).prepare(selection, signal());
  const before = values.get(slot);
  setPersonalDataOwner(102);
  try {
    new GuestCheckoutJournal({id:102,email:"other@example.test"}).read();
    throw new Error("foreign journal unexpectedly read");
  } catch (error) {
    expect(error).toMatchObject({name:"GuestCheckoutRecipientError"});
  }
  expect(values.get(slot)).toBe(before);
  expect(fetcher).not.toHaveBeenCalled();
});

it("keeps a canonical contact in the guest intent and rejects a retry with another contact", async () => {
  // Сценарий: Телефон канонизируется в намерении, смена контакта при повторе запрещена.

  const journal = new GuestCheckoutJournal(null);
  const intent = await journal.prepare({ ...selection, contactPhone: "8 (999) 123-45-67" }, signal());
  expect(intent.contactPhone).toBe("+79991234567");
  await expect(journal.prepare({ ...selection, contactPhone: "+447700900123" }, signal())).rejects.toThrow();
  expect(journal.read()).toEqual(intent);
  expect(fetcher).not.toHaveBeenCalled();
});

it.each(["", "   ", "invalid"])("reports invalid phone rather than blaming a valid email (%j)", async (contactPhone) => {
  // Сценарий: Неверный телефон получает собственное пояснение, не ошибку корректной почты.

  const journal = new GuestCheckoutJournal(null);
  await expect(journal.prepare({ ...selection, contactPhone }, signal())).rejects.toThrow("корректный номер телефона");
  expect(values.get(slot)).toBeUndefined();
  expect(fetcher).not.toHaveBeenCalled();
});
