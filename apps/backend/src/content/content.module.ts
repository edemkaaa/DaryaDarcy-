import { Module } from "@nestjs/common";
import { ContentReadService } from "./content-read.service";

@Module({ providers: [ContentReadService], exports: [ContentReadService] })
export class ContentModule {}
