/** Системные HTTP-границы доступности приложения и описания возможностей сервера. */
import { Controller, Get, Module } from "@nestjs/common";

@Controller("api/health")
class HealthController {
  @Get()
  health() {
    return { ok: true, timestamp: Date.now() };
  }
}

@Module({ controllers: [HealthController] })
export class SystemModule {}
