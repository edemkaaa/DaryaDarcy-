import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../_core/application";
import { requireProdamusTestConfiguration } from "./prodamus-test-club.service";

async function start(): Promise<void> {
  requireProdamusTestConfiguration();
  const port = Number(process.env.PORT ?? "3000");
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("Invalid port");
  const app = await createBackendApplication({
    allowedPostPaths: [
      "/api/trpc/club.createCheckout",
      "/api/prodamus/test/webhook",
    ],
  });
  try {
    app.enableShutdownHooks(["SIGINT", "SIGTERM"]);
    // Do not activate WorkerJobs. The existing dev API delivers the durable outbox.
    await app.listen(port, "0.0.0.0");
    console.info(
      `Prodamus TEST listening on ${(app.getHttpServer().address() as AddressInfo).port}`,
    );
  } catch (error) {
    await app.close();
    throw error;
  }
}
void start().catch(() => {
  console.error("Prodamus test startup failed");
  process.exitCode = 1;
});
