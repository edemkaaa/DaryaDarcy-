import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import * as platformDb from "../platform-db";
import { photoInput, uploadPhoto } from "../media/photos";

export const profileRouter = router({
  update: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        gender: z.enum(["female", "male"]).optional(),
        avatarUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.updateUserProfile(ctx.user.id, input);
      return { success: true };
    }),
  uploadAvatar: protectedProcedure
    .input(photoInput)
    .mutation(async ({ ctx, input }) => {
      const result = await uploadPhoto(input.base64, `avatars/${ctx.user.id}`);
      // Also update the user's avatarUrl in DB
      await db.updateUserProfile(ctx.user.id, { avatarUrl: result.url });
      return { url: result.url };
    }),
});

export const profileExtrasRouter = router({
  requestAccountDeletion: protectedProcedure.mutation(async ({ ctx }) => {
    await platformDb.requestAccountDeletion(ctx.user.id);
    return { ok: true as const };
  }),
});
