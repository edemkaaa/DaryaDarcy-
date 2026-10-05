import { Injectable } from "@nestjs/common";
import type { Request } from "express";
import { ONE_YEAR_MS } from "../../../../packages/shared/src/const";
import type { User } from "../../../../packages/database/src/schema";
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
import { createEmailAccount } from "./registration";

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
    } catch {
      return null;
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
  ): Promise<"created" | "duplicate" | "unavailable"> {
    if (await getUserByEmail(email)) return "duplicate";
    const database = await getDb();
    if (!database) return "unavailable";
    const user = await createEmailAccount(database, {
      openId: emailToOpenId(email),
      email,
      name: name || null,
    });
    return user ? "created" : "duplicate";
  }

  async passwordUser(email: string, password: string) {
    const user = await getUserByEmail(email);
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

  findByPhone(phone: string) {
    return getUserByPhone(phone);
  }
  findByOpenId(openId: string) {
    return getUserByOpenId(openId);
  }
  updateUser(input: Parameters<typeof upsertUser>[0]) {
    return upsertUser(input);
  }
}
