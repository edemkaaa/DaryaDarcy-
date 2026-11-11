/** Отдельная точка запуска диагностического приёмника Prodamus. */
import { createProdamusSandboxApplication } from "./prodamus-sandbox.application";
import { ProdamusSandboxService } from "./prodamus-sandbox.service";

async function start(): Promise<void> {
  // Выключенная или неполная конфигурация отклоняется до открытия listener.
  new ProdamusSandboxService(process.env).buildLink();
  const application = await createProdamusSandboxApplication();
  try {
    application.enableShutdownHooks(["SIGINT", "SIGTERM"]);
    await application.listen(3000, "0.0.0.0");
  } catch (error) {
    await application.close();
    throw error;
  }
}

void start().catch(() => {
  console.error("Prodamus sandbox startup failed");
  process.exitCode = 1;
});
