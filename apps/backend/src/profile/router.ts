import { router, protectedProcedure } from "../_core/trpc";
import { photoInput } from "../media/photos";
import { profileUpdateInput } from "./profile-input";
import type { ProfileService } from "./profile.service";

export const createProfileRouter = (profiles: ProfileService) =>
  router({
    update: protectedProcedure
      .input(profileUpdateInput)
      .mutation(({ ctx, input }) => profiles.update(ctx.user.id, input)),
    uploadAvatar: protectedProcedure
      .input(photoInput)
      .mutation(({ ctx, input }) =>
        profiles.uploadAvatar(ctx.user.id, input.base64),
      ),
  });

export const createProfileExtrasRouter = (profiles: ProfileService) =>
  router({
    requestAccountDeletion: protectedProcedure.mutation(({ ctx }) =>
      profiles.requestAccountDeletion(ctx.user.id),
    ),
  });
