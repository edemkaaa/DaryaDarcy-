import * as profileWrites from "../apps/backend/src/profile/profile-writes";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { User } from "../packages/database/src/schema";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { SessionService } from "../apps/backend/src/identity/session.service";
import { ContentUploadService } from "../apps/backend/src/content/content-upload.service";
import { TrpcService } from "../apps/backend/src/_core/trpc.service";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import { mp4Fixture, mp3Fixture } from "./helpers/media-fixtures";
import sharp from "sharp";
import * as db from "../apps/backend/src/db";
import { drizzle } from "drizzle-orm/mysql2";
import { sdk } from "../apps/backend/src/_core/sdk";

const storage = vi.hoisted(() => ({ put: vi.fn() }));
vi.mock("../apps/backend/src/storage", () => ({ storagePut: storage.put }));
let app: INestApplication;
let base: string;
let photo: string;
let actor: User;
const member = { id: 7, role: "user", blockedAt: null } as User;
const admin = { ...member, role: "admin" } as User;
const media = {
  base64: mp3Fixture.toString("base64"),
  filename: "x.mp3",
  mimeType: "audio/mpeg",
  type: "audio" as const,
};
const caller = () =>
  app
    .get(TrpcService)
    .router.createCaller({ user: actor, req: {}, res: {} } as TrpcContext);
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  app = await createBackendApplication();
  vi.spyOn(app.get(SessionService), "optionalUser").mockImplementation(
    async () => actor,
  );
  vi.spyOn(sdk, "authenticateRequest").mockImplementation(async () => actor);
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  photo = (
    await sharp({
      create: { width: 2, height: 3, channels: 3, background: "red" },
    })
      .png()
      .toBuffer()
  ).toString("base64");
});
beforeEach(() => {
  actor = admin;
  storage.put.mockReset().mockResolvedValue({
    key: "synthetic",
    url: "https://synthetic.invalid/public",
  });
});
afterAll(async () => {
  await app?.close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("unpaid member cannot create a public comment photo through the legacy router", async () => {
  actor = member;
  await expect(
    caller().club.uploadCommentPhoto({ base64: photo, filename: "x.png" }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(storage.put).not.toHaveBeenCalled();
});
it("legacy admin media refuses even valid bytes without a public object", async () => {
  await expect(caller().admin.uploadMedia(media)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(storage.put).not.toHaveBeenCalled();
});
it.each(["false", "true"])(
  "retired routes cannot fall back when private flags=%s",
  async (enabled) => {
    vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", enabled);
    vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", enabled);
    for (const procedure of [
      "club.uploadCommentPhoto",
      "admin.uploadMedia",
      "auth.me,club.uploadCommentPhoto",
      "admin.uploadMedia,auth.me",
    ]) {
      const response = await fetch(`${base}/api/trpc/${procedure}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{" + "x".repeat(300_000),
      });
      expect(response.status).toBe(404);
    }
    expect(storage.put).not.toHaveBeenCalled();
  },
);
it("retired raw video returns 404 before allocating or inspecting the body", async () => {
  const identity = vi.mocked(app.get(SessionService).optionalUser);
  identity.mockClear();
  const response = await fetch(`${base}/api/admin/upload-video`, {
    method: "POST",
    headers: { "content-type": "video/mp4" },
    body: new Uint8Array(mp4Fixture),
  });
  expect(response.status).toBe(404);
  expect(identity).not.toHaveBeenCalled();
  expect(storage.put).not.toHaveBeenCalled();
});
it("legacy service methods cannot bypass retired HTTP boundaries", async () => {
  const service = app.get(ContentUploadService);
  await expect(service.uploadMedia(media)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(
    service.uploadRawVideo(mp4Fixture, "x.mp4", "video/mp4"),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(storage.put).not.toHaveBeenCalled();
});

it.each([undefined, "postPhoto", "commentPhoto"])(
  "admin photo refuses ambiguous or private purpose %s",
  async (purpose) => {
    await expect(
      caller().admin.uploadPhoto({
        base64: photo,
        filename: "x.png",
        ...(purpose ? { purpose } : {}),
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(storage.put).not.toHaveBeenCalled();
  },
);
it("explicit publicCover retains photo hardening and uses a public cover namespace", async () => {
  const payload = {
    base64: photo,
    filename: "../../private.png",
    purpose: "publicCover" as const,
  };
  expect(await caller().admin.uploadPhoto(payload)).toEqual({
    url: "https://synthetic.invalid/public",
  });
  expect(storage.put).toHaveBeenCalledTimes(1);
  const [key, bytes, mime] = storage.put.mock.calls[0];
  expect(key).toMatch(/^covers\/[0-9a-f-]+\.webp$/);
  expect(mime).toBe("image/webp");
  expect(await sharp(bytes).metadata()).toMatchObject({
    format: "webp",
    width: 2,
    height: 3,
  });
});
it("native HTTP validates purpose and still admits an explicit cover with private flags off", async () => {
  vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "false");
  const post = (payload: unknown) =>
    fetch(base + "/api/trpc/admin.uploadPhoto", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: payload }),
    });
  expect((await post({ base64: photo, filename: "x.png" })).status).toBe(400);
  expect(storage.put).not.toHaveBeenCalled();
  const response = await post({
    base64: photo,
    filename: "x.png",
    purpose: "publicCover",
  });
  expect(response.status).toBe(200);
  expect((await response.json()).result.data.json).toEqual({
    url: "https://synthetic.invalid/public",
  });
  expect(storage.put).toHaveBeenCalledTimes(1);
});
it("ordinary member cannot claim administrator's public-cover purpose", async () => {
  actor = member;
  const payload = {
    base64: photo,
    filename: "x.png",
    purpose: "publicCover" as const,
  };
  await expect(caller().admin.uploadPhoto(payload)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(storage.put).not.toHaveBeenCalled();
});
it("public avatar uploads stay available and persist only the actor's URL", async () => {
  actor = member;
  const database = vi.spyOn(db, "getDb").mockResolvedValue(drizzle.mock());
  const update = vi.spyOn(profileWrites, "saveProfile").mockResolvedValue(1);
  try {
    expect(
      await caller().profile.uploadAvatar({ base64: photo, filename: "x.png" }),
    ).toEqual({ url: "https://synthetic.invalid/public" });
    expect(storage.put.mock.calls[0][0]).toMatch(/^avatars\/7\//);
    expect(update).toHaveBeenLastCalledWith(expect.anything(), 7, member.sessionVersion, {
      expectedRevision: member.profileRevision,
      avatarUrl: "https://synthetic.invalid/public",
    });
  } finally {
    update.mockRestore();
    database.mockRestore();
  }
});
