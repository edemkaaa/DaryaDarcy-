/** Объединяет расписание с распределённым владением задачами публикации, оплаты, очистки и бэкапа. */
import { Inject, Injectable } from "@nestjs/common";
import {
  IntervalJobs,
  type PendingJob,
  type IntervalJob,
} from "./interval-jobs";
import { WORKER_OPERATIONS, type WorkerOperations } from "./worker-operations";

@Injectable()
export class WorkerJobs {
  private readonly jobs: IntervalJobs;

  /** Собираем четыре локальных интервала и оборачиваем каждый в распределённое исключительное владение; создание сервиса ещё не запускает расписание. */
  constructor(
    @Inject(WORKER_OPERATIONS) private readonly operations: WorkerOperations,
  ) {
    const definitions: IntervalJob[] = [
      { name: "publication", intervalMs: 60_000, /** Запускаем цикл наступивших публикаций под именем задачи publication. */ run: () => this.publish() },
      { name: "billing", intervalMs: 30_000, /** Запускаем обработку отмен, писем доступа и привязки почты под именем billing. */ run: () => this.bill() },
      {
        name: "maintenance",
        intervalMs: 5 * 60_000,
        /** Запускаем очередь цифровой доставки и регламентную очистку под именем maintenance. */
        run: () => this.maintain(),
      },
      {
        name: "backup",
        intervalMs: 6 * 60 * 60_000,
        /** Вызываем проверку наступившего бэкапа только внутри исключительной фоновой задачи backup. */
        run: async () => {
          await this.operations.runMysqlBackupIfDue();
        },
      },
    ];
    this.jobs = new IntervalJobs(
      definitions.map((job) => ({
        ...job,
        /** Согласуем локальный тик с общей блокировкой данного имени, чтобы разные API не выполняли его одновременно. */
        run: () =>
          this.operations.runExclusiveJob(job.name, async () => {
            await job.run();
          }),
      })),
    );
  }

  /** Расписание включает точка запуска после успешного listen, а не инициализация Nest-модуля. */
  start(): void {
    this.jobs.start();
  }

  /** Останавливаем новые локальные тики и возвращаем незавершённые Promise вызывающему shutdown без принудительной отмены операций. */
  stop(): readonly PendingJob[] {
    return this.jobs.stop();
  }

  /** После коммита отложенных постов включаем best-effort push в Promise задачи, чтобы shutdown мог дождаться отправки; гарантированный outbox здесь не создаётся. */
  private async publish(): Promise<void> {
    const published = await this.operations.publishDueScheduledPosts();
    for (const post of published) {
      console.log(`[schedule] published post #${post.id}`);
      // Включаем отправку в Promise задачи, чтобы shutdown мог её дождаться.
      // Это не добавляет долговечный outbox для уведомлений о публикации.
      await this.operations.sendMarketingPostNotification(
        post.text,
        post.id,
        post.target,
      );
    }
  }

  /** При доступной БД независимо запускаем три обработчика через allSettled: сбой отмены, почты доступа или привязки не отменяет остальные. */
  private async bill(): Promise<void> {
    const database = await this.operations.getDb();
    if (!database) return;
    await Promise.allSettled([
      this.operations
        .processCancellations(
          database,
          this.operations.cancelProdamusSubscription,
        )
        .catch(() => console.warn("[billing] cancellation worker failed")),
      this.operations
        .processAccessEmails(database, this.operations.sendTransactionalEmail)
        .catch(() => console.warn("[billing] email worker failed")),
      this.operations
        .processMemberEmailBindingJobs(
          database,
          this.operations.sendTransactionalEmail,
        )
        .catch(() => console.warn("[billing] binding worker failed")),
    ]);
  }

  /** Последовательно обрабатываем отложенную доставку магазина и регламентную очистку персональных данных. */
  private async maintain(): Promise<void> {
    await this.operations.processPendingShopDeliveryEmails();
    await this.operations.runDataRetentionMaintenance();
  }
}
