import { Module } from "@nestjs/common";
import { publishDueScheduledPosts, getDb } from "../db";
import { processCancellations } from "../billing/cancellation";
import { cancelProdamusSubscription } from "../prodamus";
import { processAccessEmails } from "../identity/access";
import { sendTransactionalEmail } from "../_core/email";
import { sendMarketingPostNotification } from "../push";
import { processPendingShopDeliveryEmails } from "../shop-delivery";
import { runDataRetentionMaintenance } from "../platform-db";
import { runMysqlBackupIfDue } from "../_core/backup";
import { WorkerJobs } from "./worker-jobs.service";
import { WORKER_OPERATIONS, type WorkerOperations } from "./worker-operations";

@Module({
  providers: [
    {
      provide: WORKER_OPERATIONS,
      // A separate binding per app, with no domain work during construction.
      useFactory: (): WorkerOperations => ({
        publishDueScheduledPosts,
        sendMarketingPostNotification,
        getDb,
        processCancellations,
        cancelProdamusSubscription,
        processAccessEmails,
        sendTransactionalEmail,
        processPendingShopDeliveryEmails,
        runDataRetentionMaintenance,
        runMysqlBackupIfDue,
      }),
    },
    WorkerJobs,
  ],
  exports: [WorkerJobs],
})
export class WorkersModule {}
