import type { MySql2Database } from "drizzle-orm/mysql2";
import { and, eq, ne, sql } from "drizzle-orm";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  adminAuditLog,
  memberEmailBindings,
  memberEmailBindingOutbox,
  users,
  type User,
} from "../../../../packages/database/src/schema";
import { isValidEmail, normalizeEmail } from "../_core/password";

const userIdSchema = z.number().int().min(1).max(2147483647);
export const emailBindingActorSchema = z
  .object({
    userId: userIdSchema,
    sessionVersion: z.number().int().min(0).max(2147483647),
  })
  .strict();
export const emailBindingRequestKeySchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
);
const requestSchema = z
  .object({
    userId: userIdSchema,
    email: z
      .string()
      .max(1024)
      .transform(normalizeEmail)
      .refine((email) => email.length <= 320 && isValidEmail(email)),
    requestKey: emailBindingRequestKeySchema,
  })
  .strict();
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export type EmailBindingRequest = {
  userId: number;
  email: string;
  requestKey: string;
};
export type EmailBindingActor = { userId: number; sessionVersion: number };
export type EmailBindingReceipt = {
  requestKey: string;
  state: "pending" | "confirmed" | "expired" | "cancelled";
};
export class EmailBindingError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "forbidden"
      | "recipient_unavailable"
      | "conflict"
      | "unavailable",
  ) {
    super(`Email binding: ${code}`);
  }
}

export function isEmailBindingDuplicate(error: unknown): boolean {
  let current = error;
  for (
    let depth = 0;
    depth < 4 && current && typeof current === "object";
    depth++
  ) {
    const detail = current as { code?: string; cause?: unknown };
    if (detail.code === "ER_DUP_ENTRY") return true;
    current = detail.cause;
  }
  return false;
}

function encryptedProof(requestKey: string, payloadHash: string) {
  const raw = process.env.AUTH_LINK_ENCRYPTION_KEY || "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32 || key.toString("base64") !== raw)
    throw new EmailBindingError("unavailable");
  const token = randomBytes(32).toString("base64url");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  // Purpose and immutable intent are authenticated: a cipher copied from
  // another request or from password mail cannot become a binding proof.
  cipher.setAAD(Buffer.from(`email-binding:v1:${requestKey}:${payloadHash}`));
  const tokenCipher = Buffer.concat([
    iv,
    cipher.update(token, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
  return { tokenCipher, proofHash: digest(`email-binding:v1:${token}`) };
}

/** Internal-only until confirmation, delivery and retention gates are accepted. */
export async function requestMemberEmailBinding(
  database: MySql2Database,
  actor: EmailBindingActor,
  input: EmailBindingRequest,
): Promise<EmailBindingReceipt> {
  const parsedActor = emailBindingActorSchema.safeParse(actor);
  const parsedRequest = requestSchema.safeParse(input);
  if (!parsedActor.success || !parsedRequest.success)
    throw new EmailBindingError("invalid_input");
  const principal = parsedActor.data;
  const request = parsedRequest.data;
  const payloadHash = digest(
    JSON.stringify([
      "email-binding:v1",
      principal.userId,
      request.userId,
      request.email,
    ]),
  );
  try {
    return await database.transaction(async (tx) => {
      // Lock current actor and recipient in one stable order before claiming
      // an intent. Shared user locks serialize competing first bindings.
      const locked = new Map<number, User>();
      for (const id of [...new Set([principal.userId, request.userId])].sort(
        (a, b) => a - b,
      )) {
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, id))
          .for("update");
        if (user) locked.set(id, user);
      }
      const administrator = locked.get(principal.userId);
      if (
        !administrator ||
        administrator.role !== "admin" ||
        administrator.blockedAt ||
        administrator.accountDeletionRequestedAt ||
        administrator.openId.startsWith("deleted-") ||
        administrator.sessionVersion !== principal.sessionVersion
      )
        throw new EmailBindingError("forbidden");

      let claimed = true;
      try {
        // Only the primary key can conflict in this initial claim: no proof
        // or recipient PII exists until the claim is accepted in this tx.
        await tx.insert(memberEmailBindings).values({
          requestKey: request.requestKey,
          payloadHash,
          actorUserId: principal.userId,
          userId: request.userId,
          expiresAt: new Date(Date.now() + 86400000),
        });
      } catch (error) {
        if (!isEmailBindingDuplicate(error)) throw error;
        claimed = false;
      }
      const [binding] = await tx
        .select()
        .from(memberEmailBindings)
        .where(eq(memberEmailBindings.requestKey, request.requestKey))
        .for("update");
      if (
        !binding ||
        binding.payloadHash !== payloadHash ||
        binding.actorUserId !== principal.userId ||
        binding.userId !== request.userId
      )
        throw new EmailBindingError("conflict");
      // Replays do not recreate PII/proofs or need a currently configured key.
      if (!claimed)
        return { requestKey: binding.requestKey, state: binding.state };

      const recipient = locked.get(request.userId);
      if (
        !recipient ||
        recipient.role !== "user" ||
        recipient.blockedAt ||
        recipient.accountDeletionRequestedAt ||
        recipient.openId.startsWith("deleted-") ||
        !recipient.phone?.trim() ||
        (recipient.email !== null && recipient.email !== "")
      )
        throw new EmailBindingError("recipient_unavailable");
      const [pending] = await tx
        .select({ requestKey: memberEmailBindings.requestKey })
        .from(memberEmailBindings)
        .where(
          and(
            eq(memberEmailBindings.userId, request.userId),
            eq(memberEmailBindings.state, "pending"),
            ne(memberEmailBindings.requestKey, request.requestKey),
          ),
        )
        .limit(1)
        .for("update");
      if (pending) throw new EmailBindingError("conflict");
      const [occupied] = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`NULLIF(LOWER(TRIM(${users.email})), '') = ${request.email}`)
        .limit(1);
      if (occupied) throw new EmailBindingError("conflict");

      const proof = encryptedProof(request.requestKey, payloadHash);
      await tx
        .update(memberEmailBindings)
        .set({
          email: request.email,
          proofHash: proof.proofHash,
        })
        .where(eq(memberEmailBindings.requestKey, request.requestKey));
      await tx.insert(memberEmailBindingOutbox).values({
        requestKey: request.requestKey,
        tokenCipher: proof.tokenCipher,
      });
      await tx.insert(adminAuditLog).values({
        actorUserId: principal.userId,
        action: "request_member_email_binding",
        targetType: "user",
        targetId: request.userId,
      });
      return { requestKey: request.requestKey, state: "pending" };
    });
  } catch (error) {
    if (error instanceof EmailBindingError) throw error;
    // Drizzle errors may contain bound SQL values. Keep PII/proofs out of the
    // caller's logs/response and never retry an uncertain intent with a new key.
    throw new EmailBindingError("unavailable");
  }
}
