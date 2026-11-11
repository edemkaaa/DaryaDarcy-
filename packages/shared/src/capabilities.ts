/** Общий тип доступных возможностей сервера; наличие элемента интерфейса не включает функцию. */
/** Server-owned release switches; clients may hide features, never grant access. */
export type LaunchCapabilities = {
  smsLogin: boolean;
  penPals: boolean;
  shopOnlinePayment: boolean;
  webPush: boolean;
  privateContentUploads: boolean;
  privatePostMediaUploads: boolean;
  privatePostVideoUploads: boolean;
};
