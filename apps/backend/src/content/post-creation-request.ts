import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";

export type PostCreationIntent = {
  requestKey: string;
  actorUserId: number;
  payloadHash: string;
};

/** Fingerprint the accepted intent, not generated IDs or publication timestamps. */
export function postCreationIntent(
  actorUserId: number,
  key: string,
  payload: Record<string, unknown>,
): PostCreationIntent {
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
