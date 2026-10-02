import { expect, it } from "vitest";
import { clientIp } from "../apps/backend/src/sms-auth";
it("rate limits the proxy-validated client IP, not attacker-supplied forwarded headers", () => {
  expect(clientIp({ ip: "203.0.113.2", headers: { "x-forwarded-for": "198.51.100.7,203.0.113.2", "x-real-ip": "198.51.100.8" } })).toBe("203.0.113.2");
  expect(clientIp({ socket: { remoteAddress: "127.0.0.1" }, headers: { "x-forwarded-for": "fake" } })).toBe("127.0.0.1");
});
