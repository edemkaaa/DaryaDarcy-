/** Signed cancellation notification проверяет merchant binding и durable ACK без настоящего SQL/провайдера. */
import { createHmac } from "node:crypto";
import { expect, it, vi } from "vitest";
import {
  processProdamusCancellationNotification as processCancellation,
  type ProdamusCancellationNotificationPorts,
} from "../apps/backend/src/billing/prodamus-cancellation-notification";

// Hand-sorted canonical payload, independent of production signing helpers.
const raw =
  '{"domain":"FIXTURE.payform.ru","subscription":{"action_code":"deactivation","id":"7","profile_id":"23"}}';
/** Подписываем независимо отсортированный frozen payload и создаём явные secret/binding/confirm ports. */
function fixture(payload = raw, key = "cancellation-fixture-key") {
  const body = JSON.parse(payload) as Record<string, unknown>;
  Object.freeze(body.subscription);
  Object.freeze(body);
  const signature = createHmac("sha256", key).update(payload).digest("hex");
  const secret = vi.fn(() => "cancellation-fixture-key");
  const binding = vi.fn(() => ({
    domain: "fixture.payform.ru",
    subscriptionId: "7",
  }));
  const confirm = vi
    .fn<ProdamusCancellationNotificationPorts["confirm"]>()
    .mockResolvedValue(true);
  return { body, signature, ports: { secret, binding, confirm } };
}

/** Корректный proof вызывает confirm ровно один раз до ответа cancelled. */
it("confirms the bound profile once before acknowledging cancellation", async () => {
  const f = fixture();
  expect(await processCancellation(f.body, f.signature, f.ports)).toEqual({
    status: 200,
    body: "cancelled",
  });
  expect(f.ports.confirm).toHaveBeenCalledExactlyOnceWith({
    domain: "fixture.payform.ru",
    subscriptionId: "7",
    profileId: "23",
  });
});

/** Неуспешная подпись останавливает даже чтение merchant configuration. */
it.each(["", "wrong-fixture-key"])(
  "rejects selected key %j before evaluating merchant binding",
  async (key) => {
    const f = fixture();
    f.ports.secret.mockReturnValue(key);
    f.ports.binding.mockImplementation(() => {
      throw new Error("Configuration must not be evaluated");
    });
    expect(await processCancellation(f.body, f.signature, f.ports)).toEqual({
      status: 422,
      body: "profile binding invalid",
    });
    expect(f.ports.binding).not.toHaveBeenCalled();
    expect(f.ports.confirm).not.toHaveBeenCalled();
  },
);

/** Подписанный чужой merchant/тариф или пустой profile не допускается к confirm. */
it.each([
  raw.replace("FIXTURE.payform.ru", "foreign.payform.ru"),
  raw.replace('"id":"7"', '"id":"8"'),
  raw.replace('"profile_id":"23"', '"profile_id":""'),
])(
  "rejects an unbound cancellation without durable effects: %s",
  async (payload) => {
    const f = fixture(payload);
    expect(await processCancellation(f.body, f.signature, f.ports)).toEqual({
      status: 422,
      body: "profile binding invalid",
    });
    expect(f.ports.confirm).not.toHaveBeenCalled();
  },
);

/** False от транзакционного порта остаётся 422, а не успехом webhook. */
it("does not acknowledge a refused durable confirmation", async () => {
  const f = fixture();
  f.ports.confirm.mockResolvedValue(false);
  expect(await processCancellation(f.body, f.signature, f.ports)).toEqual({
    status: 422,
    body: "profile binding invalid",
  });
  expect(f.ports.confirm).toHaveBeenCalledTimes(1);
});

/** SQL-ошибка передаётся вызывающему коду без повторной отмены и ACK. */
it("propagates durable failure without retrying or acknowledging", async () => {
  const f = fixture();
  const error = new Error("Synthetic durable failure");
  f.ports.confirm.mockRejectedValue(error);
  await expect(processCancellation(f.body, f.signature, f.ports)).rejects.toBe(
    error,
  );
  expect(f.ports.confirm).toHaveBeenCalledTimes(1);
});

/** Ошибка доверенной конфигурации возникает только для проверенного подписанного сообщения. */
it("propagates configuration failure only after signature verification", async () => {
  const f = fixture();
  const error = new Error("Synthetic configuration failure");
  f.ports.binding.mockImplementation(() => {
    throw error;
  });
  await expect(processCancellation(f.body, f.signature, f.ports)).rejects.toBe(
    error,
  );
  expect(f.ports.confirm).not.toHaveBeenCalled();
});

/** Пока confirm promise не завершён, webhook не подтверждает сохранение. */
it("waits for pending durable confirmation before returning success", async () => {
  const f = fixture();
  let resolve!: (confirmed: boolean) => void;
  f.ports.confirm.mockReturnValue(
    new Promise<boolean>((done) => {
      resolve = done;
    }),
  );
  let acknowledged = false;
  const result = processCancellation(f.body, f.signature, f.ports).then(
    (value) => {
      acknowledged = true;
      return value;
    },
  );
  await Promise.resolve();
  expect(f.ports.confirm).toHaveBeenCalledTimes(1);
  expect(acknowledged).toBe(false);
  resolve(true);
  expect(await result).toEqual({ status: 200, body: "cancelled" });
});
