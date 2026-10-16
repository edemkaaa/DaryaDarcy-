import { Module } from "@nestjs/common";
import { ContentReadService } from "./content-read.service";
import { ContentWriteService } from "./content-write.service";
import { ContentCommentService } from "./content-comment.service";
import { ContentUploadService } from "./content-upload.service";
import { IdentityModule } from "../identity/identity.module";
import { VideoUploadController } from "./video-upload.controller";
import { PrivateVideoUploadController } from "./private-video-upload.controller";
import { PrivateFilesController } from "./private-files.controller";
import { PrivateFilesService } from "./private-files.service";
import { PrivateContentFilesController } from "./private-content-files.controller";
import { PrivateContentFilesService } from "./private-content-files.service";

@Module({
  imports: [IdentityModule],
  controllers: [VideoUploadController, PrivateVideoUploadController, PrivateFilesController, PrivateContentFilesController],
  providers: [
    ContentReadService,
    ContentWriteService,
    ContentCommentService,
    ContentUploadService,
    PrivateFilesService,
    PrivateContentFilesService,
  ],
  exports: [
    ContentReadService,
    ContentWriteService,
    ContentCommentService,
    ContentUploadService,
  ],
})
export class ContentModule {}
