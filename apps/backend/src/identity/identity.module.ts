import { Module } from "@nestjs/common";
import { PasswordController } from "./password.controller";
import { PasswordService } from "./password.service";
import { SessionController } from "./session.controller";
import { SessionService } from "./session.service";
import {
  AccessEmailStaffGuard,
  AdministratorGuard,
  SessionAccessFilter,
} from "./http-access";

@Module({
  controllers: [PasswordController, SessionController],
  providers: [
    PasswordService,
    SessionService,
    AccessEmailStaffGuard,
    AdministratorGuard,
    SessionAccessFilter,
  ],
  exports: [
    SessionService,
    AccessEmailStaffGuard,
    AdministratorGuard,
    SessionAccessFilter,
  ],
})
export class IdentityModule {}
