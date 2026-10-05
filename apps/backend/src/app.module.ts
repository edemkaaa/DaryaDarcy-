import { Module } from "@nestjs/common";
import { LaunchModule } from "./launch/launch.module";
import { SystemModule } from "./system/system.module";

@Module({ imports: [SystemModule, LaunchModule] })
export class AppModule {}
