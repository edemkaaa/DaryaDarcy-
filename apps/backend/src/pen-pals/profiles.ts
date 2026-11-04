import { and, eq, isNull, lt, ne, or } from "drizzle-orm";
import {
  users,
  userConsentEvents,
  penPalProfiles,
  penPalMatches,
  penPalShown,
  type PenPalProfile,
} from "../../../../packages/database/src/schema";
import { getDb } from "../database/connection";
import { requestMatch, respondMatch } from "./match-writes";
import { lockPenPalActor, type PenPalActor } from "./actor";
import {
  PEN_PAL_ADULT_CONSENT_LABEL,
  PEN_PAL_CONSENT_VERSION,
} from "../../../../packages/shared/src/pen-pals";
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type DataWriter =
  | Database
  | Parameters<Parameters<Database["transaction"]>[0]>[0];

function asInterestList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export type PenPalMatchCard = {
  userId: number;
  matchId: number | null;
  name: string | null;
  avatarUrl: string | null;
  fullName: string;
  interests: string[];
  sharedInterests: string[];
  address?: string;
  myConfirmed: boolean;
  theirConfirmed: boolean;
  mutualConfirmed: boolean;
  confirmDeadline: Date | null;
};

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function recordProfileConsent(
  tx: Transaction,
  userId: number,
  status: "granted" | "revoked",
  version: string,
) {
  await tx.insert(userConsentEvents).values({
    userId,
    consentKey: "pen_pals_adult",
    status,
    consentVersion: version,
    consentText: PEN_PAL_ADULT_CONSENT_LABEL,
  });
}

export async function upsertPenPalProfileV2(
  actor: PenPalActor,
  data: {
    fullName: string;
    interests: string[];
    address: string;
    consentVersion: string;
  },
): Promise<PenPalProfile> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    await lockPenPalActor(tx, actor);
    const fields = {
      fullName: data.fullName,
      city: data.fullName,
      interests: data.interests,
      address: data.address,
      adultConsentAt: new Date(),
      consentVersion: data.consentVersion,
      active: true,
    };
    await tx
      .insert(penPalProfiles)
      .values({ userId: actor.id, ...fields })
      .onDuplicateKeyUpdate({ set: fields });
    const [profile] = await tx
      .select()
      .from(penPalProfiles)
      .where(eq(penPalProfiles.userId, actor.id))
      .limit(1);
    if (!profile) throw new Error("Failed to save pen pal profile");
    await recordProfileConsent(tx, actor.id, "granted", data.consentVersion);
    return profile;
  });
}

/** User withdrawal remains available when discovery is disabled. */
export async function withdrawPenPalProfile(actor: PenPalActor): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    await lockPenPalActor(tx, actor);
    await deactivatePenPalProfile(tx, actor.id);
    await recordProfileConsent(
      tx,
      actor.id,
      "revoked",
      PEN_PAL_CONSENT_VERSION,
    );
  });
}

/** Trusted retention/maintenance: no user consent is asserted by this cleanup. */
export async function deactivatePenPalProfileV2(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    await deactivatePenPalProfile(tx, userId);
  });
}

export async function deactivatePenPalProfile(
  db: DataWriter,
  userId: number,
): Promise<void> {
  await db
    .update(penPalProfiles)
    .set({ active: false })
    .where(eq(penPalProfiles.userId, userId));
  await db
    .delete(penPalMatches)
    .where(
      or(
        eq(penPalMatches.userLowId, userId),
        eq(penPalMatches.userHighId, userId),
      ),
    );
}

export async function readOwnPenPalProfile(actor: PenPalActor) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    await lockPenPalActor(tx, actor);
    const [profile] = await tx
      .select()
      .from(penPalProfiles)
      .where(eq(penPalProfiles.userId, actor.id))
      .limit(1);
    if (!profile?.active) return null;
    return {
      fullName: profile.fullName || profile.city,
      interests: asInterestList(profile.interests),
      address: profile.address,
    };
  });
}

async function matchRowForUser(
  row: typeof penPalMatches.$inferSelect,
  userId: number,
) {
  const isLow = row.userLowId === userId;
  return {
    myConfirmed: isLow ? row.userLowConfirmed : row.userHighConfirmed,
    theirConfirmed: isLow ? row.userHighConfirmed : row.userLowConfirmed,
    otherUserId: isLow ? row.userHighId : row.userLowId,
    mutualConfirmed: Boolean(row.mutualConfirmedAt),
    confirmDeadline: row.confirmDeadline,
  };
}

export async function findPenPalCards(actor: PenPalActor, limit = 2) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  return database.transaction(
    async (db) => {
      await lockPenPalActor(db, actor);
      const userId = actor.id;

      const mine = await db
        .select()
        .from(penPalProfiles)
        .where(eq(penPalProfiles.userId, userId))
        .limit(1);
      const profile = mine[0];
      if (!profile?.active)
        return {
          needsProfile: true as const,
          matches: [] as PenPalMatchCard[],
        };

      const now = new Date();
      await db
        .delete(penPalMatches)
        .where(
          and(
            or(
              eq(penPalMatches.userLowId, userId),
              eq(penPalMatches.userHighId, userId),
            ),
            isNull(penPalMatches.mutualConfirmedAt),
            lt(penPalMatches.confirmDeadline, now),
          ),
        );

      const myInterests = asInterestList(profile.interests);
      const matchRows = await db
        .select()
        .from(penPalMatches)
        .where(
          or(
            eq(penPalMatches.userLowId, userId),
            eq(penPalMatches.userHighId, userId),
          ),
        );

      const cards: PenPalMatchCard[] = [];
      const matchedIds = new Set<number>();

      for (const row of matchRows) {
        let info = await matchRowForUser(row, userId);
        matchedIds.add(info.otherUserId);
        // A single current read authorizes the relation and peer together.
        // The initial match list must not retain access after withdrawal.
        const [current] = await db
          .select({
            match: penPalMatches,
            profile: penPalProfiles,
            user: { name: users.name, avatarUrl: users.avatarUrl },
          })
          .from(penPalMatches)
          .innerJoin(
            penPalProfiles,
            eq(penPalProfiles.userId, info.otherUserId),
          )
          .innerJoin(users, eq(users.id, penPalProfiles.userId))
          .where(
            and(
              eq(penPalMatches.id, row.id),
              eq(penPalMatches.userLowId, row.userLowId),
              eq(penPalMatches.userHighId, row.userHighId),
              eq(penPalProfiles.active, true),
              isNull(users.blockedAt),
            ),
          )
          .limit(1);
        if (
          !current ||
          (!current.match.mutualConfirmedAt &&
            current.match.confirmDeadline <= new Date())
        )
          continue;
        info = await matchRowForUser(current.match, userId);
        const interests = asInterestList(current.profile.interests);
        cards.push({
          userId: info.otherUserId,
          matchId: current.match.id,
          name: current.user.name,
          avatarUrl: current.user.avatarUrl,
          fullName: current.profile.fullName || current.profile.city,
          interests,
          sharedInterests: interests.filter((i) => myInterests.includes(i)),
          address: info.mutualConfirmed ? current.profile.address : undefined,
          myConfirmed: info.myConfirmed,
          theirConfirmed: info.theirConfirmed,
          mutualConfirmed: info.mutualConfirmed,
          confirmDeadline: info.confirmDeadline,
        });
      }

      if (cards.length >= limit)
        return { needsProfile: false as const, matches: cards.slice(0, limit) };

      const [others, shownRows] = await Promise.all([
        db
          .select()
          .from(penPalProfiles)
          .where(
            and(
              eq(penPalProfiles.active, true),
              ne(penPalProfiles.userId, userId),
            ),
          ),
        db
          .select({ matchUserId: penPalShown.matchUserId })
          .from(penPalShown)
          .where(eq(penPalShown.userId, userId)),
      ]);
      const shown = new Set(shownRows.map((r) => r.matchUserId));

      const ranked = others
        .filter((p) => !shown.has(p.userId) && !matchedIds.has(p.userId))
        .map((p) => {
          const interests = asInterestList(p.interests);
          const shared = interests.filter((i) => myInterests.includes(i));
          return {
            profile: p,
            interests,
            sharedInterests: shared,
            score: shared.length,
          };
        })
        .filter((r) => r.score >= 1)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit - cards.length);

      for (const row of ranked) {
        const [u] = await db
          .select()
          .from(users)
          .where(eq(users.id, row.profile.userId))
          .limit(1);
        const [currentProfile] = await db
          .select()
          .from(penPalProfiles)
          .where(eq(penPalProfiles.userId, row.profile.userId))
          .limit(1);
        if (!currentProfile?.active || !u || u.blockedAt) continue;
        await db
          .insert(penPalShown)
          .values({ userId, matchUserId: row.profile.userId })
          .onDuplicateKeyUpdate({ set: { matchUserId: row.profile.userId } });
        cards.push({
          userId: row.profile.userId,
          matchId: null,
          name: u?.name ?? null,
          avatarUrl: u?.avatarUrl ?? null,
          fullName: currentProfile.fullName || currentProfile.city,
          interests: row.interests,
          sharedInterests: row.sharedInterests,
          myConfirmed: false,
          theirConfirmed: false,
          mutualConfirmed: false,
          confirmDeadline: null,
        });
      }

      return { needsProfile: false as const, matches: cards };
    },
    { isolationLevel: "read committed" },
  );
}

export async function requestPenPalMatch(
  actor: PenPalActor,
  targetUserId: number,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return requestMatch(db, actor, targetUserId);
}

export async function respondPenPalMatch(
  actor: PenPalActor,
  matchId: number,
  accept: boolean,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await respondMatch(db, actor, matchId, accept);
}
