/** Compatibility exports only. Each feature owns its SQL and transaction helpers. */
// Совместимые экспорты сохраняют прежние импорты; SQL, блокировки и транзакционные границы принадлежат профильным модулям ниже.
export {
  isModeratorAccount,
  isStaffAccount,
  isUserBlocked,
} from "./identity/account-policy";
export { logUserConsent } from "./identity/user-consents";
export { logAdminAction } from "./admin/audit-log";
export {
  dismissCommentReport,
  deleteReportedComment,
  blockUser,
  unblockUser,
} from "./moderation/user-writes";
export {
  requestAccountDeletion,
  anonymizeUserComments,
  processScheduledAccountDeletions,
  purgeStalePenPalData,
  runDataRetentionMaintenance,
} from "./identity/account-retention";
export {
  upsertPenPalProfileV2,
  withdrawPenPalProfile,
  deactivatePenPalProfileV2,
  readOwnPenPalProfile,
  findPenPalCards,
  requestPenPalMatch,
  respondPenPalMatch,
  type PenPalMatchCard,
} from "./pen-pals/profiles";
export {
  queueShopDeliveryEmail,
  isShopDeliveryEmailSent,
  markShopDeliveryEmailSent,
  listPendingShopDeliveryEmails,
} from "./shop/delivery-repository";
