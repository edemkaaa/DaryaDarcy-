/** Системные HTTP-границы доступности приложения и описания возможностей сервера. */
import { Controller, Get, Module } from "@nestjs/common";

@Controller("api/health")
class HealthController {
  /** Возвращаем признак жизни HTTP-процесса и текущую метку времени без обращения к БД; этот маршрут не доказывает готовность внешних зависимостей. */
  @Get()
  health() {
    return { ok: true, timestamp: Date.now() };
  }
}

@Module({ controllers: [HealthController] })
export class SystemModule {}
