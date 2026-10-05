import { Module } from "@nestjs/common";
import { ContentReadService } from "./content-read.service";
import { ContentWriteService } from "./content-write.service";
import { ContentCommentService } from "./content-comment.service";

@Module({
  providers: [ContentReadService, ContentWriteService, ContentCommentService],
  exports: [ContentReadService, ContentWriteService, ContentCommentService],
})
export class ContentModule {}
