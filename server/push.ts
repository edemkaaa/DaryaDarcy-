import type { PushConsentType } from "../shared/push-consent";
import * as db from "./db";

export type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

/** Send push via Expo Push API. Service vs marketing audiences are filtered in db helpers. */
export async function sendExpoPushBatch(
  category: PushConsentType,
  messages: ExpoPushMessage[],
  target: "feed" | "club" | "both" = "feed",
): Promise<number> {
  if (messages.length === 0) return 0;

  const allowed =
    category === "marketing"
      ? new Set(await db.getMarketingPushTokens(target))
      : new Set(await db.getServicePushTokens(target));

  const filtered = messages.filter((m) => allowed.has(m.to));
  if (filtered.length === 0) return 0;

  for (let i = 0; i < filtered.length; i += 100) {
    const batch = filtered.slice(i, i + 100);
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    }).catch((err) => console.warn("[Push] Failed to send batch:", err));
  }

  return filtered.length;
}

/** Marketing/content push: new posts, promos, etc. Requires explicit user consent. */
export async function sendMarketingPostNotification(
  postText: string,
  postId: number,
  target: "feed" | "club" | "both" = "feed",
): Promise<void> {
  try {
    const tokens = await db.getMarketingPushTokens(target);
    if (tokens.length === 0) return;

    const preview = postText.length > 80 ? `${postText.slice(0, 80)}...` : postText;
    const title = target === "club" ? "Новый пост в клубе" : "Новый пост в ленте";
    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      sound: "default",
      title,
      body: preview,
      data: { postId, type: "new_post", target, category: "marketing" },
    }));

    const sent = await sendExpoPushBatch("marketing", messages, target);
    console.log(`[Push] Sent marketing notification to ${sent} devices for post #${postId}`);
  } catch (err) {
    console.warn("[Push] Error sending marketing notifications:", err);
  }
}

/** Service push: purchases, subscription, account — no marketing consent required. */
export async function sendServicePushNotification(input: {
  userId: number;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  target?: "feed" | "club" | "both";
}): Promise<number> {
  try {
    const tokens = await db.getPushTokensForUser(input.userId);
    if (tokens.length === 0) return 0;
    const target = input.target ?? "club";
    const allowed = new Set(await db.getServicePushTokens(target));
    const messages: ExpoPushMessage[] = tokens
      .filter((token) => allowed.has(token))
      .map((token) => ({
        to: token,
        sound: "default",
        title: input.title,
        body: input.body,
        data: { ...input.data, category: "service" },
      }));
    return sendExpoPushBatch("service", messages, target);
  } catch (err) {
    console.warn("[Push] Service notification failed:", err);
    return 0;
  }
}
