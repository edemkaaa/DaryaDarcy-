import type * as db from "../db";
import type { processCancellations } from "../billing/cancellation";
import type { cancelProdamusSubscription } from "../prodamus";
import type { processAccessEmails } from "../identity/access";
import type { sendTransactionalEmail } from "../_core/email";
import type { sendMarketingPostNotification } from "../push";
import type { processPendingShopDeliveryEmails } from "../shop-delivery";
import type { runDataRetentionMaintenance } from "../platform-db";
import type { runMysqlBackupIfDue } from "../_core/backup";
import type { processMemberEmailBindingJobs } from "../identity/email-binding-worker";

export const WORKER_OPERATIONS = Symbol("WORKER_OPERATIONS");

/** Existing domain boundaries; constructing this binding must not call them. */
export type WorkerOperations = Readonly<{
  runExclusiveJob(name: string, run: () => Promise<void>): Promise<void>;
  publishDueScheduledPosts: typeof db.publishDueScheduledPosts;
  sendMarketingPostNotification: typeof sendMarketingPostNotification;
  getDb: typeof db.getDb;
  processCancellations: typeof processCancellations;
  cancelProdamusSubscription: typeof cancelProdamusSubscription;
  processAccessEmails: typeof processAccessEmails;
  processMemberEmailBindingJobs: typeof processMemberEmailBindingJobs;
  sendTransactionalEmail: typeof sendTransactionalEmail;
  processPendingShopDeliveryEmails: typeof processPendingShopDeliveryEmails;
  runDataRetentionMaintenance: typeof runDataRetentionMaintenance;
  runMysqlBackupIfDue: typeof runMysqlBackupIfDue;
}>;
