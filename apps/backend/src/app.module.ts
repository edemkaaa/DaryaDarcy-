import { Module } from "@nestjs/common";
import { LaunchModule } from "./launch/launch.module";
import { SystemModule } from "./system/system.module";
import { IdentityModule } from "./identity/identity.module";

@Module({ imports: [SystemModule, LaunchModule, IdentityModule] })
export class AppModule {}
