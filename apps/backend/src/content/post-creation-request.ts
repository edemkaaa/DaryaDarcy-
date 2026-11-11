/** Отпечаток принятого намерения создания поста отличает безопасный повтор от нового содержимого. */
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";

export type PostCreationIntent = {
  requestKey: string;
  actorUserId: number;
  payloadHash: string;
};

/** Fingerprint the accepted intent, not generated IDs or publication timestamps. */
/** Канонизируем ключи JSON принятого намерения, отдельно хешируем содержимое и actor/requestKey; генерируемые ID и даты не участвуют в сравнении повтора. */
export function postCreationIntent(
  actorUserId: number,
  key: string,
  payload: Record<string, unknown>,
): PostCreationIntent {
  /** Вычисляем SHA-256 текстового представления для изолированного ключа и отпечатка запроса. */
  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  try {
    const canonical = JSON.stringify(payload, (_name, value) => {
      if (value && typeof value === "object" && !Array.isArray(value))
        return Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((name) => [name, value[name]]),
        );
      return value;
    });
    return {
      requestKey: hash(
        JSON.stringify(["admin.createPost:v1", actorUserId, key]),
      ),
      actorUserId,
      payloadHash: hash(canonical),
    };
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Для ключа запроса нужны JSON-совместимые данные",
    });
  }
}
