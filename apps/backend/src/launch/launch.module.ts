import { Controller, Get, Header, Module } from "@nestjs/common";
import { getCapabilities } from "./capabilities";

@Controller("api/capabilities")
class CapabilitiesController {
  @Get()
  @Header("Cache-Control", "no-store")
  capabilities() {
    return getCapabilities();
  }
}

@Module({ controllers: [CapabilitiesController] })
export class LaunchModule {}
