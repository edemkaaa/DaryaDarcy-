import type { Express } from "express";
import { TRPCError } from "@trpc/server";

/** Server-owned release policy, not client visibility flags. */
export function getCapabilities() {
  return {
    smsLogin: process.env.ENABLE_SMS_LOGIN === "true",
    penPals: process.env.ENABLE_PEN_PALS === "true",
    // No opt-in until shop has its own validated, atomic settlement/outbox.
    shopOnlinePayment: false,
    webPush: false,
  } as const;
}

export function requireCapability(name: keyof ReturnType<typeof getCapabilities>): void {
  if (!getCapabilities()[name]) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Функция пока недоступна" });
  }
}

export function registerCapabilityRoutes(app: Express): void {
  app.get("/api/capabilities", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(getCapabilities());
  });
}
