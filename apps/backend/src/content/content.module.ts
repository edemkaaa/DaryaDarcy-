import { Module } from "@nestjs/common";
import { ContentReadService } from "./content-read.service";
import { ContentWriteService } from "./content-write.service";

@Module({
  providers: [ContentReadService, ContentWriteService],
  exports: [ContentReadService, ContentWriteService],
})
export class ContentModule {}
