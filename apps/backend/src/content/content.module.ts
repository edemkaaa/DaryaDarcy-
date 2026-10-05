import { Module } from "@nestjs/common";
import { ContentReadService } from "./content-read.service";
import { ContentWriteService } from "./content-write.service";
import { ContentCommentService } from "./content-comment.service";
import { ContentUploadService } from "./content-upload.service";

@Module({
  providers: [
    ContentReadService,
    ContentWriteService,
    ContentCommentService,
    ContentUploadService,
  ],
  exports: [
    ContentReadService,
    ContentWriteService,
    ContentCommentService,
    ContentUploadService,
  ],
})
export class ContentModule {}
