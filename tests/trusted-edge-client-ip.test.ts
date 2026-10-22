import { createRequire } from "node:module";
import { expect, it } from "vitest";
import { createBackendApplication } from "../apps/backend/src/_core/application";

const expressRequire = createRequire(require.resolve("express"));
const proxyAddress = expressRequire("proxy-addr") as (
  request: { socket: { remoteAddress: string }; headers: Record<string, string> },
  trust: (address: string, hop: number) => boolean,
) => string;

it("uses the client's address after the private edge, not the shared edge address", async () => {
  const application = await createBackendApplication();
  try {
    const expressApp = application.getHttpAdapter().getInstance();
    const trust = expressApp.get("trust proxy fn") as (
      address: string,
      hop: number,
    ) => boolean;
    const request = {
      socket: { remoteAddress: "172.26.0.5" },
      headers: { "x-forwarded-for": "198.51.100.66, 203.0.113.44" },
    };
    expect(proxyAddress(request, trust)).toBe("203.0.113.44");
  } finally {
    await application.close();
  }
});
