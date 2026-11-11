/** Служебные и маркетинговые уведомления используют отдельные правила выбора получателей. */
import type { PushConsentType } from "../../../packages/shared/src/push-consent";
import * as db from "./db";
import { z } from "zod";

const pushBatchResponse = z.object({
  data: z.array(z.discriminatedUnion("status", [
    z.object({ status: z.literal("ok"), id: z.string().min(1) }),
    z.object({ status: z.literal("error") }),
  ])),
  errors: z.array(z.unknown()).optional(),
});

export type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

/** Return valid Expo acceptance tickets, not device deliveries. Audiences are filtered in db helpers. */
export async function sendExpoPushBatch(
  category: PushConsentType,
  messages: ExpoPushMessage[],
  target: "feed" | "club" | "both" = "feed",
  serviceUserId?: number,
): Promise<number> {
  if (messages.length === 0) return 0;

  const allowed =
    category === "marketing"
      ? new Set(await db.getMarketingPushTokens(target))
      : new Set(await db.getServicePushTokens(target, serviceUserId));

  const filtered = messages.filter((m) => allowed.has(m.to));
  if (filtered.length === 0) return 0;

  let accepted = 0;
  for (let i = 0; i < filtered.length; i += 100) {
    const batch = filtered.slice(i, i + 100);
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 10_000);
    deadline.unref();
    let response: Response | undefined;
    try {
      response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });
      if (!response.ok) {
        console.warn(`[Push] Batch rejected: HTTP ${response.status}`);
        continue;
      }
      const result = pushBatchResponse.safeParse(await response.json());
      if (!result.success || result.data.data.length !== batch.length || result.data.errors?.length) {
        console.warn("[Push] Invalid batch acknowledgement");
        continue;
      }
      accepted += result.data.data.filter(ticket => ticket.status === "ok").length;
    } catch {
      // Provider messages and transport errors can contain recipient tokens.
      console.warn("[Push] Batch transport or response failed");
    } finally {
      clearTimeout(deadline);
      // Rejected HTTP bodies are not read above. Release the connection before
      // the next batch; the deadline also covers successful response parsing.
      await response?.body?.cancel().catch(() => {});
    }
  }

  return accepted;
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

    const accepted = await sendExpoPushBatch("marketing", messages, target);
    console.log(`[Push] Expo accepted ${accepted} marketing notifications for post #${postId}`);
  } catch {
    console.warn("[Push] Marketing notification failed");
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
    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      sound: "default",
      title: input.title,
      body: input.body,
      data: { ...input.data, category: "service" },
    }));
    // Повторная проверка аудитории включает владельца устройства. Await
    // оставляет обработку ошибки проверки внутри этого фонового вызова.
    return await sendExpoPushBatch("service", messages, target, input.userId);
  } catch {
    console.warn("[Push] Service notification failed");
    return 0;
  }
}
