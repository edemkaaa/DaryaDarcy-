import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { smsCodes } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { sendLoginSms } from "./_core/sms.ru";
import { getDb } from "./db";

const COOLDOWN_MS = 60_000;
const TTL_MS = 5 * 60_000;
const HOUR_MS = 60 * 60_000;
const MAX_PER_HOUR = 5;
const CODE_LEN = 6;

const verifyFails = new Map<string, { n: number; start: number }>();

function hashCode(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}:${ENV.cookieSecret}`).digest("hex");
}

function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function clientIp(req: { ip?: string; headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(",")[0].trim().slice(0, 45);
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim().slice(0, 45);
  }
  return String(req.ip || req.socket?.remoteAddress || "").slice(0, 45);
}

async function countRecent(field: "phone" | "ip", value: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const since = sql`DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR)`;
  const column = field === "phone" ? smsCodes.phone : smsCodes.ip;
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(smsCodes)
    .where(and(eq(column, value), gt(smsCodes.createdAt, since)));
  return Number(rows[0]?.n ?? 0);
}

export async function issueSmsCode(phone: string, ip: string): Promise<{ retryAfterSec: number }> {
  const db = await getDb();
  if (!db) throw new Error("База недоступна");
  if (!ENV.cookieSecret) throw new Error("Вход по SMS временно недоступен");

  const sinceMinute = sql`DATE_SUB(UTC_TIMESTAMP(), INTERVAL 60 SECOND)`;
  const recent = await db
    .select({ id: smsCodes.id, createdAt: smsCodes.createdAt })
    .from(smsCodes)
    .where(and(eq(smsCodes.phone, phone), gt(smsCodes.createdAt, sinceMinute)))
    .limit(1);

  if (recent.length > 0) {
    const wait = Math.ceil((recent[0].createdAt.getTime() + COOLDOWN_MS - Date.now()) / 1000);
    const error = new Error("Код уже отправлен. Подождите минуту.");
    (error as Error & { retryAfterSec?: number }).retryAfterSec = Math.max(1, wait);
    throw error;
  }

  const [byPhone, byIp] = await Promise.all([countRecent("phone", phone), countRecent("ip", ip || "unknown")]);
  if (byPhone >= MAX_PER_HOUR || byIp >= MAX_PER_HOUR) {
    throw new Error("Слишком много попыток. Попробуйте позже.");
  }

  const code = String(randomInt(0, 10 ** CODE_LEN)).padStart(CODE_LEN, "0");

  await db
    .update(smsCodes)
    .set({ usedAt: sql`UTC_TIMESTAMP()` })
    .where(and(eq(smsCodes.phone, phone), isNull(smsCodes.usedAt)));

  await db.insert(smsCodes).values({
    phone,
    codeHash: hashCode(phone, code),
    ip: ip || "",
    createdAt: sql`UTC_TIMESTAMP()`,
    expiresAt: sql`DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)`,
  });

  try {
    await sendLoginSms(phone, code, ip);
  } catch (error) {
    await db.delete(smsCodes).where(and(eq(smsCodes.phone, phone), gt(smsCodes.createdAt, sinceMinute)));
    throw error;
  }

  return { retryAfterSec: 60 };
}

export async function consumeSmsCode(phone: string, code: string, ip: string): Promise<void> {
  const failKey = `${phone}|${ip}`;
  const fail = verifyFails.get(failKey);
  if (fail && Date.now() - fail.start < 15 * 60_000 && fail.n >= 10) {
    throw new Error("Слишком много попыток. Попробуйте позже.");
  }

  const db = await getDb();
  if (!db) throw new Error("База недоступна");

  const rows = await db
    .select()
    .from(smsCodes)
    .where(
      and(eq(smsCodes.phone, phone), isNull(smsCodes.usedAt), gt(smsCodes.expiresAt, sql`UTC_TIMESTAMP()`)),
    );

  const match = rows.find((row) => hashesEqual(row.codeHash, hashCode(phone, code.trim())));
  if (!match) {
    const current = verifyFails.get(failKey);
    if (!current || Date.now() - current.start >= 15 * 60_000) {
      verifyFails.set(failKey, { n: 1, start: Date.now() });
    } else {
      current.n += 1;
    }
    throw new Error("Неверный или устаревший код");
  }

  verifyFails.delete(failKey);
  await db.update(smsCodes).set({ usedAt: sql`UTC_TIMESTAMP()` }).where(eq(smsCodes.id, match.id));
  await db
    .update(smsCodes)
    .set({ usedAt: sql`UTC_TIMESTAMP()` })
    .where(and(eq(smsCodes.phone, phone), isNull(smsCodes.usedAt)));
}
