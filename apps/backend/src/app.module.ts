import { Module } from "@nestjs/common";
import { LaunchModule } from "./launch/launch.module";
import { SystemModule } from "./system/system.module";
import { IdentityModule } from "./identity/identity.module";
import { TrpcModule } from "./_core/trpc.module";

@Module({ imports: [SystemModule, LaunchModule, IdentityModule, TrpcModule] })
export class AppModule {}
