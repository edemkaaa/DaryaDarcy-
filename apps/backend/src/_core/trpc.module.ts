import { Module } from "@nestjs/common";
import { ContentModule } from "../content/content.module";
import { IdentityModule } from "../identity/identity.module";
import { TrpcService } from "./trpc.service";

@Module({
  imports: [ContentModule, IdentityModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
