/** Регистрирует контроллеры настроек и публичный endpoint возможностей выпуска. */
import { Controller, Get, Header, Module } from "@nestjs/common";
import { getCapabilities } from "./capabilities";
import { LaunchController } from "./launch.controller";
import { LaunchService } from "./launch.service";
import { IdentityModule } from "../identity/identity.module";

@Controller("api/capabilities")
class CapabilitiesController {
  /** Публикуем только актуальные серверные возможности без кеширования, чтобы скрытая клиентом функция не считалась серверным разрешением. */
  @Get()
  @Header("Cache-Control", "no-store")
  capabilities() {
    return getCapabilities();
  }
}

@Module({
  imports: [IdentityModule],
  controllers: [CapabilitiesController, LaunchController],
  providers: [LaunchService],
})
export class LaunchModule {}
