import { afterEach, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import type { PrivateAttachmentActor } from "../apps/backend/src/content/private-attachment-uploads";

vi.mock("../apps/backend/src/db", () => ({ getDb: vi.fn() }));

afterEach(() => vi.unstubAllEnvs());

const actor = { id: 7, sessionVersion: 0 } as PrivateAttachmentActor;
const input = {
  idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
  usage: "commentPhoto" as const,
  postId: 123,
  filename: "synthetic.jpg",
  mimeType: "image/jpeg",
  base64: Buffer.from("not an image").toString("base64"),
};

it("denies an inaccessible comment post before decoding its photo", async () => {
  vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "true");
  const { getDb } = await import("../apps/backend/src/db");
  vi.mocked(getDb).mockResolvedValue({
    transaction: async () => { throw new TRPCError({ code: "FORBIDDEN" }); },
  } as unknown as NonNullable<Awaited<ReturnType<typeof getDb>>>);
  const { uploadPrivateContentFile } = await import("../apps/backend/src/content/private-content-uploads");
  await expect(uploadPrivateContentFile(actor, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("returns a service error before photo decoding when the entitlement check cannot reach the database", async () => {
  vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "true");
  const { getDb } = await import("../apps/backend/src/db");
  vi.mocked(getDb).mockRejectedValue(new Error("database unavailable"));
  const { uploadPrivateContentFile } = await import("../apps/backend/src/content/private-content-uploads");
  await expect(uploadPrivateContentFile(actor, input)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
});
