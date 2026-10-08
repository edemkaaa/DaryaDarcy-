import type * as db from "../db";
import type { processCancellations } from "../billing/cancellation";
import type { cancelProdamusSubscription } from "../prodamus";
import type { processAccessEmails } from "../identity/access";
import type { sendTransactionalEmail } from "../_core/email";
import type { sendMarketingPostNotification } from "../push";
import type { processPendingShopDeliveryEmails } from "../shop-delivery";
import type { runDataRetentionMaintenance } from "../platform-db";
import type { runMysqlBackupIfDue } from "../_core/backup";

export const WORKER_OPERATIONS = Symbol("WORKER_OPERATIONS");

/** Existing domain boundaries; constructing this binding must not call them. */
export type WorkerOperations = Readonly<{
  publishDueScheduledPosts: typeof db.publishDueScheduledPosts;
  sendMarketingPostNotification: typeof sendMarketingPostNotification;
  getDb: typeof db.getDb;
  processCancellations: typeof processCancellations;
  cancelProdamusSubscription: typeof cancelProdamusSubscription;
  processAccessEmails: typeof processAccessEmails;
  sendTransactionalEmail: typeof sendTransactionalEmail;
  processPendingShopDeliveryEmails: typeof processPendingShopDeliveryEmails;
  runDataRetentionMaintenance: typeof runDataRetentionMaintenance;
  runMysqlBackupIfDue: typeof runMysqlBackupIfDue;
}>;
