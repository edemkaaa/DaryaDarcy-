import { Inject, Injectable } from "@nestjs/common";
import { IntervalJobs, type PendingJob } from "./interval-jobs";
import { WORKER_OPERATIONS, type WorkerOperations } from "./worker-operations";

@Injectable()
export class WorkerJobs {
  private readonly jobs: IntervalJobs;

  constructor(
    @Inject(WORKER_OPERATIONS) private readonly operations: WorkerOperations,
  ) {
    this.jobs = new IntervalJobs([
      { name: "publication", intervalMs: 60_000, run: () => this.publish() },
      { name: "billing", intervalMs: 30_000, run: () => this.bill() },
      {
        name: "maintenance",
        intervalMs: 5 * 60_000,
        run: () => this.maintain(),
      },
      {
        name: "backup",
        intervalMs: 6 * 60 * 60_000,
        run: async () => {
          await this.operations.runMysqlBackupIfDue();
        },
      },
    ]);
  }

  /** Activation belongs to the executable after a successful listen, not init. */
  start(): void {
    this.jobs.start();
  }

  stop(): readonly PendingJob[] {
    return this.jobs.stop();
  }

  private async publish(): Promise<void> {
    const published = await this.operations.publishDueScheduledPosts();
    for (const post of published) {
      console.log(`[schedule] published post #${post.id}`);
      // Preserve the existing detached send; this is not a publication outbox.
      void this.operations.sendMarketingPostNotification(
        post.text,
        post.id,
        post.target,
      );
    }
  }

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

  private async maintain(): Promise<void> {
    await this.operations.processPendingShopDeliveryEmails();
    await this.operations.runDataRetentionMaintenance();
  }
}
