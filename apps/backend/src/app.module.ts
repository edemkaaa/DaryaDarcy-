/** Композиция модулей Nest без запуска HTTP и интервалов при одном импорте. */
import { Module } from "@nestjs/common";
import { LaunchModule } from "./launch/launch.module";
import { SystemModule } from "./system/system.module";
import { IdentityModule } from "./identity/identity.module";
import { TrpcModule } from "./_core/trpc.module";
import { WorkersModule } from "./workers/workers.module";

@Module({
  imports: [
    SystemModule,
    LaunchModule,
    IdentityModule,
    TrpcModule,
    WorkersModule,
  ],
})
export class AppModule {}
