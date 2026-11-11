/** Оркестрация подтверждения отмены проверяется через непрозрачные порты БД без выполнения SQL. */
import { expect, it, vi } from "vitest";
import {
  ClubCancellationService,
  type ClubCancellationPorts,
} from "../apps/backend/src/billing/club-cancellation.service";

const profile = Object.freeze({
  domain: "fixture.payform.ru",
  subscriptionId: "7",
  profileId: "23",
});
// Opaque SQL boundary; no query is run by these orchestration tests.
const database = {} as NonNullable<
  Awaited<ReturnType<ClubCancellationPorts["getDb"]>>
>;

/** Сервис лениво получает handle и передаёт полный provider profile; возвращает ровно сохранённое true/false. */
it.each([true, false])(
  "retains durable cancellation decision %s and the complete profile",
  async (confirmed) => {
    const getDb = vi.fn(async () => database);
    const confirm = vi.fn<ClubCancellationPorts["confirm"]>(
      async (handle, proof) => {
        expect(handle).toBe(database);
        expect(proof).toEqual({
          domain: "fixture.payform.ru",
          subscriptionId: "7",
          profileId: "23",
        });
        return confirmed;
      },
    );
    const service = new ClubCancellationService({ getDb, confirm });
    expect(getDb).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(await service.confirm(profile)).toBe(confirmed);
    expect(getDb).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledTimes(1);
  },
);

/** Без handle confirmation не вызывается. */
it("fails on missing database before confirming a profile", async () => {
  const confirm = vi.fn<ClubCancellationPorts["confirm"]>();
  const service = new ClubCancellationService({
    getDb: async () => null,
    confirm,
  });
  await expect(service.confirm(profile)).rejects.toThrow(
    "Database unavailable",
  );
  expect(confirm).not.toHaveBeenCalled();
});

/** Ошибка получения БД сохраняется, повторной попытки и confirmation нет. */
it("propagates acquisition failure without confirming or retrying", async () => {
  const failure = new Error("synthetic acquisition failure");
  const getDb = vi.fn(async () => {
    throw failure;
  });
  const confirm = vi.fn<ClubCancellationPorts["confirm"]>();
  const service = new ClubCancellationService({ getDb, confirm });
  await expect(service.confirm(profile)).rejects.toBe(failure);
  expect(getDb).toHaveBeenCalledTimes(1);
  expect(confirm).not.toHaveBeenCalled();
});

/** Ошибка сохранения решения не маскируется успехом и не вызывает слепой повтор. */
it("propagates durable failure without retry or acknowledgement", async () => {
  const failure = new Error("synthetic confirmation failure");
  const confirm = vi.fn<ClubCancellationPorts["confirm"]>(async () => {
    throw failure;
  });
  const service = new ClubCancellationService({
    getDb: async () => database,
    confirm,
  });
  await expect(service.confirm(profile)).rejects.toBe(failure);
  expect(confirm).toHaveBeenCalledTimes(1);
});

/** Ответ caller появляется только после завершения promise долговечного подтверждения. */
it("waits for durable completion before reporting a decision", async () => {
  let complete!: (confirmed: boolean) => void;
  const pending = new Promise<boolean>((resolve) => {
    complete = resolve;
  });
  const service = new ClubCancellationService({
    getDb: async () => database,
    confirm: async () => pending,
  });
  let reported = false;
  const result = service.confirm(profile).then((confirmed) => {
    reported = true;
    return confirmed;
  });
  try {
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(reported).toBe(false);
  } finally {
    complete(true);
  }
  expect(await result).toBe(true);
});
