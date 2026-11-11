/** Связывает фоновые порты с существующими доменами; сам импорт модуля расписание не запускает. */
import { runExclusiveWorker } from "../database/coordination";
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
import { processMemberEmailBindingJobs } from "../identity/email-binding-worker";
import { WORKER_OPERATIONS, type WorkerOperations } from "./worker-operations";

@Module({
  providers: [
    {
      provide: WORKER_OPERATIONS,
      // Каждое приложение получает свой binding без вызова доменных операций при сборке.
      useFactory: (): WorkerOperations => ({
        runExclusiveJob: runExclusiveWorker,
        publishDueScheduledPosts,
        sendMarketingPostNotification,
        getDb,
        processCancellations,
        cancelProdamusSubscription,
        processAccessEmails,
        processMemberEmailBindingJobs,
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
