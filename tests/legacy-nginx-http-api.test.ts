import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("does not proxy API credentials over HTTP in the legacy nginx config", () => {
  const config = readFileSync(resolve("infrastructure/deploy/nginx-daryadarcy.conf"), "utf8");
  const httpServer = config.split(/\nserver \{/)[1];
  expect(httpServer).toMatch(/location \^~ \/api\/ \{\s*return 403;\s*\}/);
  expect(httpServer).not.toMatch(/location \/api\/ \{\s*proxy_pass/);
});
