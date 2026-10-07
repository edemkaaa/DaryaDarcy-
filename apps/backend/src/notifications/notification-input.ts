import { z } from "zod";

// Existing wire contracts; service types describe their validated outputs.
export const registerTokenInput = z.object({
  token: z.string().min(1),
  platform: z.string().optional(),
});

export const setMarketingConsentInput = z.object({
  enabled: z.boolean(),
  platform: z.string().optional(),
});

export type RegisterTokenInput = z.output<typeof registerTokenInput>;
export type SetMarketingConsentInput = z.output<
  typeof setMarketingConsentInput
>;
