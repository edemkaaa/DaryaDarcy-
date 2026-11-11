/** Регистрирует сервис профиля и его зависимость от актуальной identity. */
import { Module } from "@nestjs/common";
import { ProfileService } from "./profile.service";

@Module({
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
