import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import type { User } from "../packages/database/src/schema";
import superjson from "superjson";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import * as db from "../apps/backend/src/db";
import { privateVideoMetadata } from "../apps/backend/src/content/private-video-input";

// Real JWT/SDK/Nest/JSON/tRPC validation; only account/activity SQL is substituted.
// Invalid intent keys or oversized decoded bytes stop before upload SQL or S3.
const actor: User = {
  id: 308,
  openId: "body-member",
  name: null,
  email: "body@example.test",
  phone: null, contactPhone: null,
  passwordHash: null,
  sessionVersion: 0, profileRevision: 0,
  loginMethod: "email",
  gender: null,
  avatarUrl: null,
  role: "user",
  blockedAt: null,
  blockedReason: null,
  accountDeletionRequestedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  lastSignedIn: new Date(0),
};
const admin = "admin.uploadPrivateContentFile";
const comment = "club.uploadPrivateCommentPhoto";
const MiB = 1024 * 1024;
let app: INestApplication, base: string;
const tokens: Record<string, string> = {};
let admissionBodies: unknown[];
// Проверяется реальный HTTP ingress и JWT, но SQL/S3 заменены: неверные ключи намерений останавливают допустимое тело до загрузки файла.
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("JWT_SECRET", "private-body-test-only-signing-secret");
  app = await createBackendApplication();
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  for (const role of ["admin", "user", "moderator"])
    tokens[role] = await sdk.createSessionToken(`body-${role}`, {
      sessionVersion: 0,
    });
});
beforeEach(() => {
  vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "true");
  vi.spyOn(db, "getUserByOpenId").mockImplementation(async (openId) => ({
    ...actor,
    openId,
    role: openId.slice("body-".length) as User["role"],
  }));
  vi.spyOn(db, "recordAuthenticatedActivity").mockResolvedValue(undefined);
  vi.spyOn(db, "getDb").mockRejectedValue(
    new Error("Unexpected upload database access"),
  );
  const authenticate = sdk.authenticateRequest.bind(sdk);
  admissionBodies = [];
  vi.spyOn(sdk, "authenticateRequest").mockImplementation((request) => {
    admissionBodies.push(request.body);
    return authenticate(request);
  });
});
afterEach(() => {
  expect(db.getDb).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
afterAll(async () => {
  await app?.close();
  vi.unstubAllEnvs();
});
function input(usage: string, bytes: number, validKey = false) {
  // Формирует Base64-пакет заданного размера; по умолчанию неверный ключ останавливает запрос на схеме до S3.

  return {
    idempotencyKey: validKey ? "synthetic-private-body-intent" : "invalid",
    usage,
    filename: "synthetic.txt",
    mimeType: "text/plain",
    base64: Buffer.alloc(bytes).toString("base64"),
    ...(usage === "commentPhoto" ? { postId: 1 } : {}),
  };
}
function post(name: string, value: unknown, role = "admin", batch = false) {
  // Отправляет настоящий локальный tRPC-запрос с выбранной ролью и одиночной либо пакетной оболочкой.

  return fetch(`${base}/api/trpc/${name}${batch ? "?batch=1" : ""}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}),
    },
    body: batch
      ? JSON.stringify({ 0: superjson.serialize(value) })
      : superjson.stringify(value),
  });
}
it("forwards unexpected upload middleware rejection to Nest without leaking details", async () => {
  // Сценарий: Неожиданная ошибка middleware доходит до Nest как безопасная серверная ошибка.

  const previousMedia = process.env.PRIVATE_POST_MEDIA_UPLOAD_ENABLED;
  const previousVideo = process.env.PRIVATE_POST_VIDEO_UPLOAD_ENABLED;
  vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", "true");
  vi.stubEnv("PRIVATE_POST_VIDEO_UPLOAD_ENABLED", "true");
  try {
    vi.spyOn(privateVideoMetadata, "safeParse").mockImplementationOnce(() => {
      throw new Error("SYNTHETIC_PRIVATE_DETAIL");
    });
    const response = await fetch(`${base}/api/admin/private-video-uploads?filename=sample.mp4`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.admin}`, "Content-Type": "video/mp4" },
      body: new Uint8Array([0]),
      signal: AbortSignal.timeout(2000),
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ statusCode: 500, message: "Internal server error" });
    expect(admissionBodies).toEqual([undefined]);
  } finally {
    vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", previousMedia);
    vi.stubEnv("PRIVATE_POST_VIDEO_UPLOAD_ENABLED", previousVideo);
  }
});
it("parses the authenticated UTF-8 media envelope only once before schema validation", async () => {
  // Сценарий: Допущенная UTF-8 оболочка разбирается один раз, без дополнительного полного копирования Base64.

  const encoded = superjson.stringify(input("articleDocument", 256 * 1024));
  const parse = vi.spyOn(JSON, "parse");
  const response = await fetch(`${base}/api/trpc/${admin}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${tokens.admin}` },
    body: encoded,
  });
  expect(response.status).toBe(400);
  expect((await response.json()).error.json.data.code).toBe("BAD_REQUEST");
  // Real parses, not substituted results: a preparse/stringify/reparse cycle
  // consumes another whole upload's worth of memory before the decoder runs.
  expect(parse.mock.calls.filter(([value]) => value === encoded)).toHaveLength(1);
});
it.each(["null", "1", '"text"', "{SECRET_INVALID_UPLOAD}"])(
  "keeps malformed/non-object media JSON %s a private 400 response",
  async body => {
    // Сценарий: Повреждённый JSON и не-объектные значения дают закрытый ответ 400.

    const response = await fetch(`${base}/api/trpc/${admin}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens.admin}` }, body,
    });
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("SECRET_INVALID_UPLOAD");
  },
);
it("retains the existing UTF-16 JSON fallback for authenticated media", async () => {
  // Сценарий: Совместимый UTF-16 путь доходит до валидации входной схемы.

  const encoded = superjson.stringify(input("articleDocument", 8));
  const response = await fetch(`${base}/api/trpc/${admin}`, {
    method: "POST", headers: { "Content-Type": "application/json; charset=utf-16le", Authorization: `Bearer ${tokens.admin}` },
    body: new Uint8Array(Buffer.from(encoded, "utf16le")),
  });
  expect(response.status).toBe(400);
  expect((await response.json()).error.json.data.code).toBe("BAD_REQUEST");
});
it("rejects compressed media before authentication, parsing, SQL or S3", async () => {
  // Сценарий: Сжатое тело отклоняется до аутентификации, разбора и любых обращений к SQL/S3.

  const encoded = superjson.stringify(input("articleDocument", 8));
  const response = await fetch(`${base}/api/trpc/${admin}`, {
    method: "POST", headers: { "Content-Type": "application/json", "Content-Encoding": "gzip", Authorization: `Bearer ${tokens.admin}` },
    body: new Uint8Array(gzipSync(encoded)),
  });
  expect(response.status).toBe(415);
  expect(await response.json()).toEqual({ error: "Сжатые запросы не поддерживаются" });
  expect(admissionBodies).toEqual([]);
});
it("bounds a chunked media envelope even without Content-Length", async () => {
  // Сценарий: Лимит применяется и к порционному телу без заявленной длины.

  const chunk = Buffer.alloc(64 * 1024, 0x61);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // Выдаёт крупное JSON-тело порциями без Content-Length для проверки потокового ограничения размера.

      controller.enqueue(Buffer.from('{"json":{"payload":"'));
      for (let i = 0; i < 800; i++) controller.enqueue(chunk); // 50 MiB plus framing.
      controller.enqueue(Buffer.from('"}}'));
      controller.close();
    },
  });
  const response = await fetch(`${base}/api/trpc/${admin}`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens.admin}` },
    body, duplex: "half",
  } as RequestInit & { duplex: "half" });
  expect(response.status).toBe(413);
  expect((await response.json()).error.json.data.code).toBe("PAYLOAD_TOO_LARGE");
});
it.each([
  { name: admin, usage: "postPhoto", bytes: 4 * MiB, role: "admin" },
  { name: admin, usage: "articlePhoto", bytes: 4 * MiB, role: "admin" },
  { name: admin, usage: "articleDocument", bytes: 32 * MiB, role: "admin" },
  { name: comment, usage: "commentPhoto", bytes: 4 * MiB, role: "user" },
])(
  "admits the full Base64 envelope for $usage to real schema validation",
  async ({ name, usage, bytes, role }) => {
    // Сценарий: Максимальные разрешённые файлы проходят парсер и останавливаются на намеренно неверном ключе.

    const response = await post(name, input(usage, bytes), role);
    expect(response.status).toBe(400);
    expect((await response.json()).error.json.data.code).toBe("BAD_REQUEST");
    expect(admissionBodies[0]).toBeUndefined();
  },
);
it.each([admin, comment])(
  "preserves small/300 KiB validation behavior for %s",
  async (name) => {
    // Сценарий: Малый пакет и пакет 300 КиБ получают ту же ошибку схемы, а не старый лимит 256 КиБ.

    for (const bytes of [1, 225 * 1024]) {
      const response = await post(
        name,
        input(name === admin ? "postPhoto" : "commentPhoto", bytes),
      );
      expect(response.status).toBe(400);
      expect((await response.json()).error.json.data.code).toBe("BAD_REQUEST");
    }
  },
);
it.each([admin, comment])(
  "refuses disabled %s before authentication or JSON parsing",
  async (name) => {
    // Сценарий: Выключенная функция отклоняет загрузку до аутентификации и разбора JSON.

    vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "false");
    const response = await post(name, { payload: "x".repeat(300000) });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Загрузка недоступна" });
    expect(admissionBodies).toEqual([]);
  },
);
it.each([admin, comment])(
  "refuses anonymous %s before JSON parsing",
  async (name) => {
    // Сценарий: Гость получает отказ до выделения памяти для разбора загрузки.

    const response = await post(name, { payload: "x".repeat(300000) }, "");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Нужно войти" });
    expect(admissionBodies).toEqual([undefined]);
  },
);
it.each(["user", "moderator"])(
  "refuses %s on the administrator upload before parsing",
  async (role) => {
    // Сценарий: Неадминистративная роль не допускается к загрузке редактора.

    const response = await post(admin, { payload: "x".repeat(300000) }, role);
    expect(response.status).toBe(403);
    expect(admissionBodies).toEqual([undefined]);
  },
);
it.each([admin, comment])(
  "keeps infrastructure failure at %s distinct from a guest",
  async (name) => {
    // Сценарий: Инфраструктурный сбой проверки сессии остаётся 503 и не превращается в гостя.

    vi.mocked(db.getUserByOpenId).mockRejectedValueOnce(
      new Error("PRIVATE_BODY_LOOKUP_FAULT"),
    );
    const response = await post(name, { payload: "x".repeat(300000) });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE_BODY_LOOKUP_FAULT");
    expect(admissionBodies).toEqual([undefined]);
  },
);
it.each([admin, comment])(
  "classifies encoded and batched %s without bypassing admission",
  async (name) => {
    // Сценарий: Кодированное имя процедуры и batch не обходят правила допуска к телу.

    for (const route of [name.replace(".", "%2E"), `${name},auth.me`]) {
      const response = await post(
        route,
        { payload: "x".repeat(300000) },
        "",
        route.includes(","),
      );
      expect(response.status).toBe(401);
    }
    expect(admissionBodies).toEqual([undefined, undefined]);
  },
);
it("requires administrator authority for a mixed private-upload batch", async () => {
  // Сценарий: Смешанный batch с админской загрузкой требует роли администратора для всего допуска.

  const response = await post(
    `${comment},${admin}`,
    { payload: "x".repeat(300000) },
    "user",
    true,
  );
  expect(response.status).toBe(403);
  expect(admissionBodies).toEqual([undefined]);
});
it.each([
  { name: admin, bytes: 50 * MiB },
  { name: comment, bytes: 6 * MiB },
])("bounds the complete JSON envelope at %s", async ({ name, bytes }) => {
  // Сценарий: Ограничивается вся JSON-оболочка, включая служебные поля.

  const response = await post(name, { payload: "x".repeat(bytes) });
  expect(response.status).toBe(413);
  expect(await response.json()).toEqual({ error: "Запрос слишком большой" });
  expect(admissionBodies).toEqual([undefined]);
});
it.each([
  { name: admin, usage: "articleDocument", bytes: 32 * MiB + 1 },
  { name: admin, usage: "postPhoto", bytes: 4 * MiB + 1 },
  { name: comment, usage: "commentPhoto", bytes: 4 * MiB + 1 },
])(
  "preserves the decoded file quota for $usage",
  async ({ name, usage, bytes }) => {
    // Сценарий: Превышение квоты декодированного файла отклоняется независимо от лимита оболочки.

    const response = await post(name, input(usage, bytes, true));
    expect(response.status).toBe(413);
    expect((await response.json()).error.json.data.code).toBe(
      "PAYLOAD_TOO_LARGE",
    );
  },
);
it.each([
  "admin.privateContentFileStatus",
  "club.privateCommentPhotoStatus",
  `${admin}Extra`,
  "posts.create",
])("does not widen ordinary JSON for %s", async (name) => {
  // Сценарий: Обычные и похожие по префиксу маршруты сохраняют обычный лимит JSON.

  const response = await post(name, { payload: "x".repeat(300000) });
  expect(response.status).toBe(413);
  expect(await response.json()).toEqual({ error: "Запрос слишком большой" });
  expect(admissionBodies).toEqual([]);
});
