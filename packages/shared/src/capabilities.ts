/** Server-owned release switches; clients may hide features, never grant access. */
export type LaunchCapabilities = {
  smsLogin: boolean;
  penPals: boolean;
  shopOnlinePayment: boolean;
  webPush: boolean;
};
