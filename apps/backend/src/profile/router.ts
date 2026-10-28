import { router, protectedProcedure } from "../_core/trpc";
import { photoInput } from "../media/photos";
import { avatarReceiptInput, publicPhotoStatusInput, uploadPublicPhoto, publicPhotoStatus } from "../media/public-photo-receipts";
import { profileUpdateInput } from "./profile-input";
import type { ProfileService } from "./profile.service";
import {
  recoveryExportInput,
  recoveryExportOutput,
} from "../content/recovery-export";

export const createProfileRouter = (profiles: ProfileService) =>
  router({
    uploadAvatarWithReceipt: protectedProcedure.input(avatarReceiptInput)
      .mutation(({ctx,input,signal})=>uploadPublicPhoto(ctx.user,"avatar",input,signal)),
    avatarUploadStatus: protectedProcedure.input(publicPhotoStatusInput)
      .query(({ctx,input})=>publicPhotoStatus(ctx.user,"avatar",input.idempotencyKey)),
    update: protectedProcedure
      .input(profileUpdateInput)
      .mutation(({ ctx, input }) => profiles.update(ctx.user.id, input, ctx.user.sessionVersion)),
    uploadAvatar: protectedProcedure
      .input(photoInput)
      .mutation(({ ctx, input, signal }) =>
        profiles.uploadAvatar(ctx.user.id, input.base64, signal),
      ),
  });

export const createProfileExtrasRouter = (profiles: ProfileService) =>
  router({
    recoveryExport: protectedProcedure
      .input(recoveryExportInput)
      .output(recoveryExportOutput)
      .query(({ ctx, input }) => profiles.recoveryExport(ctx.user, input)),
    requestAccountDeletion: protectedProcedure.mutation(({ ctx }) =>
      profiles.requestAccountDeletion(ctx.user.id),
    ),
  });
