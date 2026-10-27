import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { Request } from "express";
import { and, eq, sql } from "drizzle-orm";
import { ONE_YEAR_MS } from "../../../../packages/shared/src/const";
import { users, type User } from "../../../../packages/database/src/schema";
import { HttpError } from "../../../../packages/shared/src/_core/errors";
import {
  emailToOpenId,
  getDb,
  getUserByEmail,
  getUserByOpenId,
  getUserByPhone,
  isOwnerAccount,
  upsertUser,
} from "../db";
import { verifyPassword } from "../_core/password";
import { sdk } from "../_core/sdk";
import { createEmailAccount, retryEmailRegistration } from "./registration";

export function publicUser(user: User) {
  return {
    id: user.id ?? null,
    openId: user.openId ?? null,
    name: user.name ?? null,
    email: user.email ?? null,
    phone: user.phone ?? null,
    loginMethod: user.loginMethod ?? null,
    gender: user.gender ?? null,
    avatarUrl: user.avatarUrl ?? null,
    lastSignedIn: (user.lastSignedIn ?? new Date()).toISOString(),
    role: user.role ?? "user",
  };
}

@Injectable()
export class SessionService {
  // Do not retain actors between requests: revocation and roles come from MySQL.
  authenticateRequest(request: Request): Promise<User> {
    return sdk.authenticateRequest(request);
  }

  async optionalUser(request: Request): Promise<User | null> {
    try {
      return await this.authenticateRequest(request);
    } catch (error) {
      // Only a confirmed authentication denial means guest. Infrastructure
      // failures must not make clients discard an authenticated user's state.
      if (error instanceof HttpError && [401, 403].includes(error.statusCode))
        return null;
      throw new ServiceUnavailableException({
        error: "Проверка сессии временно недоступна",
      });
    }
  }

  isAdministrator(user: Pick<User, "role">) {
    return isOwnerAccount(user);
  }

  isStaff(user: Pick<User, "role" | "email" | "openId">) {
    return this.isAdministrator(user) || user.role === "moderator";
  }

  async register(
    email: string,
    name: string,
  ): Promise<"created" | "pending" | "duplicate" | "unavailable"> {
    const existing = await getUserByEmail(email);
    const database = await getDb();
    if (!database) return "unavailable";
    if (existing)
      return (await retryEmailRegistration(database, email))
        ? "pending"
        : "duplicate";
    const user = await createEmailAccount(database, {
      openId: emailToOpenId(email),
      email,
      name: name || null,
    });
    if (user) return "created";
    return (await retryEmailRegistration(database, email))
      ? "pending"
      : "duplicate";
  }

  async passwordUser(user: User | undefined, password: string) {
    if (
      !user?.passwordHash ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      return null;
    }
    // Blocked credentials must fail before updating lastSignedIn or minting a
    // JWT, with the same public response as any other invalid credentials.
    return user.blockedAt ? null : user;
  }

  async issueSession(user: User) {
    if (user.blockedAt) throw new Error("Account unavailable");
    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: user.name || user.email || user.phone || "",
      expiresInMs: ONE_YEAR_MS,
      sessionVersion: user.sessionVersion,
    });
    return { sessionToken, user: publicUser(user) };
  }

  /** Logout ends all sessions of this account. Replays cannot revoke a later login. */
  async revokeSessions(user: User | null): Promise<void> {
    if (!user) return;
    try {
      const database = await getDb();
      if (!database) throw new Error("Database unavailable");
      await database
        .update(users)
        .set({ sessionVersion: sql`${users.sessionVersion}+1` })
        .where(
          and(
            eq(users.id, user.id),
            eq(users.openId, user.openId),
            eq(users.sessionVersion, user.sessionVersion),
          ),
        );
    } catch {
      throw new ServiceUnavailableException({
        error: "Не удалось завершить сессии",
      });
    }
  }

  findByPhone(phone: string) {
    return getUserByPhone(phone);
  }
  findByEmail(email: string) {
    return getUserByEmail(email);
  }
  findByOpenId(openId: string) {
    return getUserByOpenId(openId);
  }
  updateUser(input: Parameters<typeof upsertUser>[0]) {
    return upsertUser(input);
  }
}
