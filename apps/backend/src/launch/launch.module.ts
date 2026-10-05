import { Controller, Get, Header, Module } from "@nestjs/common";
import { getCapabilities } from "./capabilities";
import { LaunchController } from "./launch.controller";
import { LaunchService } from "./launch.service";

@Controller("api/capabilities")
class CapabilitiesController {
  @Get()
  @Header("Cache-Control", "no-store")
  capabilities() {
    return getCapabilities();
  }
}

@Module({
  controllers: [CapabilitiesController, LaunchController],
  providers: [LaunchService],
})
export class LaunchModule {}
