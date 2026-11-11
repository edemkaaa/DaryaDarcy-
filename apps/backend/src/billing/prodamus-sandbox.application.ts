/** Собирает отдельное диагностическое приложение без рабочей identity, БД и фоновых задач. */
import "reflect-metadata";
import { Module, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import type { Express } from "express";
import { registerHttpSecurity } from "../_core/http-security";
import { ProdamusSandboxController } from "./prodamus-sandbox.controller";
import { ProdamusSandboxService } from "./prodamus-sandbox.service";
import {
  prodamusSandboxPath,
  registerProdamusSandboxBody,
} from "./prodamus-sandbox.ingress";

@Module({
  controllers: [ProdamusSandboxController],
  providers: [
    {
      provide: ProdamusSandboxService,
      /** Создаёт единственный sandbox-сервис из process.env без рабочего AppModule и SQL-портов. */
      useFactory: () => new ProdamusSandboxService(process.env),
    },
  ],
})
class ProdamusSandboxModule {}

/** Только диагностическая сборка без импорта AppModule, БД, identity и workers. */
export async function createProdamusSandboxApplication(): Promise<INestApplication> {
  const adapter = new ExpressAdapter();
  const http = adapter.getInstance<Express>();
  http.set("trust proxy", "loopback");
  registerHttpSecurity(http);
  http.use((req, res, next) => {
    if (req.method !== "POST" || req.path !== prodamusSandboxPath) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    next();
  });
  registerProdamusSandboxBody(http);
  const application = await NestFactory.create(ProdamusSandboxModule, adapter, {
    bodyParser: false,
    logger: false,
    abortOnError: false,
  });
  try {
    await application.init();
    return application;
  } catch (error) {
    await application.close();
    throw error;
  }
}
