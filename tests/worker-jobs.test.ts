import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as db from "../apps/backend/src/db";
import { WorkerJobs } from "../apps/backend/src/workers/worker-jobs.service";
import type { WorkerOperations } from "../apps/backend/src/workers/worker-operations";
import { processMemberEmailBindingJobs } from "../apps/backend/src/identity/email-binding-worker";

// SQL stays below a doubled boundary. This opaque handle is never queried.
const database = {} as NonNullable<Awaited<ReturnType<typeof db.getDb>>>;
/** Создаёт управляемое ожидание для удержания отдельной стадии фоновой задачи. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

/** Создаёт независимые WorkerOperations-double и журнал порядка доменных действий. */
function fixture() {
  const events: string[] = [];
  const operations: WorkerOperations = {
    /** В базовом fixture сразу допускает callback без настоящей распределённой блокировки. */
    runExclusiveJob: async (_, run) => { await run(); },
    /** Записывает запуск публикации и возвращает отсутствие новых опубликованных строк. */
    publishDueScheduledPosts: async () => {
      events.push("publication");
      return [];
    },
    /** Записывает исходные ID, target и текст уведомления без внешней отправки. */
    sendMarketingPostNotification: async (text, id, target) => {
      events.push(`announce:${id}:${target}:${text}`);
    },
    /** Фиксирует получение БД и возвращает её отсутствие для независимой проверки расписания. */
    getDb: async () => {
      events.push("database");
      return null;
    },
    /** Записывает запуск отмен подписок без провайдера и SQL. */
    processCancellations: async () => {
      events.push("cancellation");
    },
    /** Возвращает неподтверждённый результат внешней отмены без обращения к провайдеру. */
    cancelProdamusSubscription: async () => false,
    /** Записывает запуск очереди писем доступа без внешней отправки. */
    processAccessEmails: async () => {
      events.push("email");
    },
    /** Имитирует пустую очередь привязки email без SQL. */
    processMemberEmailBindingJobs: async () => {},
    /** Не выполняет SMTP и возвращает отрицательный результат отправки. */
    sendTransactionalEmail: async () => false,
    /** Записывает обработку писем магазина для проверки порядка maintenance. */
    processPendingShopDeliveryEmails: async () => {
      events.push("shop");
    },
    /** Записывает обслуживание retention после завершения предшествующих стадий. */
    runDataRetentionMaintenance: async () => {
      events.push("retention");
    },
    /** Записывает запуск отдельного расписания резервного копирования без mysqldump. */
    runMysqlBackupIfDue: async () => {
      events.push("backup");
    },
  };
  return { operations, events };
}

/** Включает управляемое время и изолирует журнальные сообщения перед сценарием. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
/** Очищает таймеры, spies и переменные окружения после каждой проверки оркестрации. */
afterEach(() => {
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** Проверяет явный запуск, допуск, расписания и независимость ошибок доменных фоновых задач. */
describe("explicit worker job orchestration", () => {
  /** Все плановые callbacks проходят общий допуск до любых доменных действий. */
  it("passes every scheduled callback through the shared admission before domain work", async () => {
    const { operations, events } = fixture();
    const names: string[] = [];
    let admitted = false;
    const jobs = new WorkerJobs({ ...operations, /** Регистрирует имя задачи и запускает callback только после изменения управляемого флага допуска. */ runExclusiveJob: async (name, run) => {
      names.push(name); if (admitted) await run();
    } });
    jobs.start(); await vi.advanceTimersByTimeAsync(0);
    expect(new Set(names)).toEqual(new Set(["publication", "billing", "maintenance", "backup"]));
    expect(events).toEqual([]);
    admitted = true; await vi.advanceTimersByTimeAsync(60_000);
    expect(events).toContain("publication"); expect(events).toContain("database"); jobs.stop();
  });
  /** Выключенный флаг привязки email не допускает ни SQL, ни отправку письма. */
  it.each(["", "false", "1"])(
    "disabled binding flag=%s performs no SQL or mail work",
    async (flag) => {
      vi.stubEnv("MEMBER_EMAIL_BINDING_ENABLED", flag);
      const unavailable = new Proxy(database, {
        /** Немедленно выявляет любое случайное обращение к непрозрачному DB handle при выключенном флаге. */
        get() {
          throw new Error("SQL must not be touched");
        },
      });
      await expect(
        processMemberEmailBindingJobs(unavailable, async () => {
          throw new Error("SMTP must not be touched");
        }),
      ).resolves.toBeUndefined();
    },
  );
  /** Конструирование WorkerJobs само не вызывает доменные операции и не создаёт таймеры. */
  it("does not touch domain boundaries or schedule timers during construction", async () => {
    const { operations, events } = fixture();
    new WorkerJobs(operations);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(events).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  /** Повторный start не дублирует четыре расписания и stop снимает их таймеры. */
  it("preserves the four fixed cadences after a single explicit start", async () => {
    const { operations, events } = fixture();
    const jobs = new WorkerJobs(operations);
    jobs.start();
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toEqual([
      "publication",
      "database",
      "shop",
      "backup",
      "retention",
    ]);
    await vi.advanceTimersByTimeAsync(6 * 60 * 60_000);
    expect({
      publication: events.filter((event) => event === "publication").length,
      billing: events.filter((event) => event === "database").length,
      maintenance: events.filter((event) => event === "retention").length,
      backup: events.filter((event) => event === "backup").length,
    }).toEqual({ publication: 361, billing: 721, maintenance: 73, backup: 2 });
    jobs.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  /** Отправляет уведомления только по возвращённым опубликованным строкам с исходным target. */
  it("announces only returned published rows with their original targets", async () => {
    const { operations, events } = fixture();
    const jobs = new WorkerJobs({
      ...operations,
      /** Возвращает синтетические опубликованные feed/club/both строки для проверки маршрутизации уведомлений. */
      publishDueScheduledPosts: async () => [
        { id: 11, text: "feed fixture", target: "feed" },
        { id: 12, text: "club fixture", target: "club" },
        { id: 13, text: "both fixture", target: "both" },
      ],
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events.filter((event) => event.startsWith("announce:"))).toEqual([
      "announce:11:feed:feed fixture",
      "announce:12:club:club fixture",
      "announce:13:both:both fixture",
    ]);
    jobs.stop();
  });

  /** Передаёт обоим billing workers один DB handle и исходные функции внешней отправки. */
  it("passes the same database and original sender bindings to both billing workers", async () => {
    const { operations, events } = fixture();
    const jobs = new WorkerJobs({
      ...operations,
      /** Возвращает непрозрачный тестовый handle вместо настоящего соединения. */
      getDb: async () => database,
      /** Проверяет исходный sender отмены и отсутствие адресного userId, затем фиксирует запуск. */
      processCancellations: async (handle, sender, userId) => {
        expect(handle).toBe(database);
        expect(sender).toBe(operations.cancelProdamusSubscription);
        expect(userId).toBeUndefined();
        events.push("cancellation");
      },
      /** Проверяет исходный SMTP sender и отсутствие адресного userId, затем фиксирует запуск. */
      processAccessEmails: async (handle, sender, userId) => {
        expect(handle).toBe(database);
        expect(sender).toBe(operations.sendTransactionalEmail);
        expect(userId).toBeUndefined();
        events.push("email");
      },
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(
      events.filter((event) => ["cancellation", "email"].includes(event)),
    ).toEqual(["cancellation", "email"]);
    jobs.stop();
  });

  /** Ошибка worker отмен не останавливает независимую обработку писем доступа. */
  it("keeps email processing independent of a failed cancellation worker", async () => {
    const { operations, events } = fixture();
    const jobs = new WorkerJobs({
      ...operations,
      /** Возвращает DB handle для проверки локализованного отказа worker отмен. */
      getDb: async () => database,
      /** Инъецирует исключение отмены, которое должно дать безопасный журнал без срыва email worker. */
      processCancellations: async () => {
        throw new Error("private-cancellation-fixture");
      },
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toContain("email");
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      "[billing] cancellation worker failed",
    );
    jobs.stop();
  });

  /** Ошибка worker писем не останавливает независимую обработку отмен. */
  it("keeps cancellation processing independent of a failed email worker", async () => {
    const { operations, events } = fixture();
    const jobs = new WorkerJobs({
      ...operations,
      /** Возвращает DB handle для проверки локализованного отказа email worker. */
      getDb: async () => database,
      /** Инъецирует исключение писем, не препятствующее worker отмен. */
      processAccessEmails: async () => {
        throw new Error("private-email-fixture");
      },
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toContain("cancellation");
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      "[billing] email worker failed",
    );
    jobs.stop();
  });

  /** Ошибка привязки email изолирована и повторяется только следующим billing cadence. */
  it("isolates binding failure and retries it on the next billing cadence", async () => {
    const { operations, events } = fixture();
    const jobs = new WorkerJobs({
      ...operations,
      /** Возвращает общий DB handle для проверки повторяемости binding worker. */
      getDb: async () => database,
      /** Проверяет handle/sender привязки и инъецирует отказ с приватной диагностикой. */
      processMemberEmailBindingJobs: async (handle, send) => {
        expect(handle).toBe(database);
        expect(send).toBe(operations.sendTransactionalEmail);
        events.push("binding");
        throw new Error("PRIVATE_BINDING_PROOF");
      },
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(events.filter((event) => event === "binding")).toHaveLength(2);
    expect(events.filter((event) => event === "email")).toHaveLength(2);
    expect(events.filter((event) => event === "cancellation")).toHaveLength(2);
    expect(events).toContain("retention");
    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(
      "[billing] binding worker failed",
    );
    jobs.stop();
  });

  /** Удерживает single-flight billing до завершения binding delivery, не создавая перекрывающийся проход. */
  it("holds billing single-flight while binding delivery is still pending", async () => {
    const { operations, events } = fixture();
    const pending = deferred();
    let acquisitions = 0;
    const jobs = new WorkerJobs({
      ...operations,
      /** Считает попытки получения DB handle для выявления повторного billing прохода. */
      getDb: async () => {
        acquisitions++;
        return database;
      },
      /** Удерживает binding delivery управляемым Promise и фиксирует единственный запуск. */
      processMemberEmailBindingJobs: async () => {
        events.push("binding");
        return pending.promise;
      },
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(acquisitions).toBe(1);
    expect(events.filter((event) => event === "binding")).toHaveLength(1);
    pending.resolve();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(acquisitions).toBe(2);
    expect(events.filter((event) => event === "binding")).toHaveLength(2);
    jobs.stop();
  });

  /** Удерживает single-flight billing до завершения обеих независимых задач. */
  it("holds billing single-flight until both settled workers finish", async () => {
    const { operations, events } = fixture();
    const pending = deferred();
    let acquisitions = 0;
    const jobs = new WorkerJobs({
      ...operations,
      /** Считает получения DB handle, пока worker отмен ещё ожидает завершения. */
      getDb: async () => {
        acquisitions++;
        return database;
      },
      /** Удерживает worker отмен Promise, позволяя проверить параллельно завершившийся email worker. */
      processCancellations: async () => {
        events.push("cancellation");
        return pending.promise;
      },
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(acquisitions).toBe(1);
    expect(events.filter((event) => event === "email")).toHaveLength(1);
    pending.resolve();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(acquisitions).toBe(2);
    jobs.stop();
  });

  /** Отказ получения БД локализуется и следующий billing cadence восстанавливает работу. */
  it("catches database acquisition failure and recovers on the next billing cadence", async () => {
    const { operations, events } = fixture();
    let acquisitions = 0;
    const jobs = new WorkerJobs({
      ...operations,
      /** Первое получение handle отклоняет, а последующие возвращают тестовый объект без SQL. */
      getDb: async () => {
        acquisitions++;
        if (acquisitions === 1) throw new Error("private-database-fixture");
        return database;
      },
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      "[workers] billing failed",
    );
    expect(events).not.toContain("email");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(events).toContain("email");
    jobs.stop();
  });

  /** Maintenance дожидается штатного helper писем магазина до retention. */
  it("waits for the existing shop helper before retention maintenance", async () => {
    const { operations, events } = fixture();
    const shop = deferred();
    const jobs = new WorkerJobs({
      ...operations,
      /** Удерживает обработку писем магазина Promise, чтобы проверить последовательность retention. */
      processPendingShopDeliveryEmails: async () => {
        events.push("shop");
        return shop.promise;
      },
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toContain("shop");
    expect(events).not.toContain("retention");
    shop.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toContain("retention");
    jobs.stop();
  });
});
