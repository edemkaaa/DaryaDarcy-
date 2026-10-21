import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import * as platformDb from "../platform-db";
import { requireCapability } from "../launch/capabilities";
import {
  PEN_PAL_INTEREST_SET,
  PEN_PAL_CONSENT_VERSION,
  PEN_PAL_ADULT_CONSENT_LABEL,
} from "../../../../packages/shared/src/pen-pals";

const penPalProcedure = protectedProcedure.use(({ next }) => {
  requireCapability("penPals");
  return next();
});

export const penPalsRouter = router({
  me: penPalProcedure.query(async ({ ctx }) => {
    const profile = await db.getPenPalProfile(ctx.user.id);
    if (!profile || !profile.active) return null;
    return {
      fullName: profile.fullName || profile.city,
      interests: Array.isArray(profile.interests) ? profile.interests : [],
      address: profile.address,
    };
  }),
  upsert: penPalProcedure
    .input(
      z.object({
        fullName: z.string().trim().min(2).max(128),
        interests: z.array(z.string()).min(2).max(3),
        address: z.string().trim().min(5).max(1000),
        adultConsent: z.literal(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const unique = [...new Set(input.interests)];
      if (
        unique.length < 2 ||
        unique.some((interest) => !PEN_PAL_INTEREST_SET.has(interest))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Выберите 2–3 темы из списка",
        });
      }
      const profile = await platformDb.upsertPenPalProfileV2(ctx.user.id, {
        fullName: input.fullName,
        interests: unique,
        address: input.address,
        consentVersion: PEN_PAL_CONSENT_VERSION,
      });
      await platformDb.logUserConsent(
        ctx.user.id,
        "pen_pals_adult",
        "granted",
        PEN_PAL_CONSENT_VERSION,
        PEN_PAL_ADULT_CONSENT_LABEL,
      );
      return {
        fullName: profile.fullName || profile.city,
        interests: unique,
        address: profile.address,
      };
    }),
  find: penPalProcedure.mutation(async ({ ctx }) => {
    const profile = await db.getPenPalProfile(ctx.user.id);
    if (!profile || !profile.active) {
      return {
        needsProfile: true as const,
        matches: [] as platformDb.PenPalMatchCard[],
      };
    }
    const matches = await platformDb.listPenPalCards(ctx.user.id, 4);
    return { needsProfile: false as const, matches };
  }),
  requestMatch: penPalProcedure
    .input(z.object({ targetUserId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const matchId = await platformDb.requestPenPalMatch(
        ctx.user.id,
        input.targetUserId,
      );
      return { matchId };
    }),
  respondMatch: penPalProcedure
    .input(z.object({ matchId: z.number().int().positive().max(2147483647), accept: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await platformDb.respondPenPalMatch(
        ctx.user.id,
        input.matchId,
        input.accept,
      );
      return { ok: true as const };
    }),
  remove: protectedProcedure.mutation(async ({ ctx }) => {
    await platformDb.deactivatePenPalProfileV2(ctx.user.id);
    await platformDb.logUserConsent(
      ctx.user.id,
      "pen_pals_adult",
      "revoked",
      PEN_PAL_CONSENT_VERSION,
      PEN_PAL_ADULT_CONSENT_LABEL,
    );
    return { success: true as const };
  }),
  consentLabel: publicProcedure.query(() => ({
    label: PEN_PAL_ADULT_CONSENT_LABEL,
    version: PEN_PAL_CONSENT_VERSION,
  })),
});
