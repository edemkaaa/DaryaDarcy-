import { Module } from "@nestjs/common";
import { PasswordController } from "./password.controller";
import { PasswordService } from "./password.service";
import { SessionController } from "./session.controller";
import { SessionService } from "./session.service";

@Module({
  controllers: [PasswordController, SessionController],
  providers: [PasswordService, SessionService],
  exports: [SessionService],
})
export class IdentityModule {}
