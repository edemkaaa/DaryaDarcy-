/** Собирает сервисы и HTTP-контроллеры identity внутри одного Nest-приложения. */
import { Module } from "@nestjs/common";
import { PasswordController } from "./password.controller";
import { PasswordService } from "./password.service";
import { SessionController } from "./session.controller";
import { SessionService } from "./session.service";
import { EmailBindingController } from "./email-binding.controller";
import { EmailBindingService } from "./email-binding.service";
import {
  AccessEmailStaffGuard,
  AdministratorGuard,
  SessionAccessFilter,
} from "./http-access";

@Module({
  controllers: [PasswordController, SessionController, EmailBindingController],
  providers: [
    PasswordService,
    SessionService,
    EmailBindingService,
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
