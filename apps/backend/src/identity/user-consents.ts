/** Сохраняет событие согласия пользователя с версией и текстом для последующей проверки. */
import { userConsentEvents } from "../../../../packages/database/src/schema";
import { getDb } from "../database/connection";

export async function logUserConsent(
  userId: number,
  consentKey: string,
  status: "granted" | "revoked",
  consentVersion: string,
  consentText?: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(userConsentEvents).values({
    userId,
    consentKey,
    status,
    consentVersion,
    consentText: consentText?.slice(0, 8000) ?? null,
  });
}
