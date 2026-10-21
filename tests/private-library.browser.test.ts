import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { expect as ui, type Page } from "@playwright/test";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { Connection } from "mysql2/promise";
import { statfs } from "node:fs/promises";
import sharp from "sharp";
import { privateFilesBrowser } from "./helpers/private-files-browser";
import { editorApi, ok } from "../apps/frontend/e2e/editor-fixtures";
import { gotoWithSession } from "../apps/frontend/e2e/layout-fixtures";
import { aestheticGuides } from "../apps/backend/src/content/aesthetic-guides";
import {
  AESTHETIC_RESULTS,
  QUESTIONS,
} from "../apps/frontend/src/domain/quiz/quiz-data";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { COOKIE_NAME } from "../packages/shared/src/const";
import { getDb } from "../apps/backend/src/db";
import { createHash } from "node:crypto";
import { openPrivateUploadWire } from "./helpers/private-upload-wire";
import { applyLibraryMigration } from "../apps/backend/src/content/library-file-migration";

const native = process.env.DARYADARCY_LOCAL_BROWSER === "1" ? it : it.skip;
let app: Awaited<ReturnType<typeof privateFilesBrowser>>, png: Buffer;
let backend: INestApplication | undefined, conn: Connection | undefined;
let wire: Awaited<ReturnType<typeof openPrivateUploadWire>> | undefined;
beforeAll(async () => {
  if (process.env.DARYADARCY_LOCAL_BROWSER !== "1") return;
  const disk = await statfs(process.cwd());
  if (disk.bavail * disk.bsize < 2 * 1024 ** 3)
    throw new Error("Own library browser fixture requires 2 GiB free");
  let api = "http://127.0.0.1:1";
  png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  if (testDatabaseUrl) {
    conn = await openTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl);
    vi.stubEnv("JWT_SECRET", "library-browser-only-fixture-32-characters");
    await conn.query(
      "INSERT INTO users (id,openId,role) VALUES (9064,'guide-browser','user'),(9066,'library-browser-importer','admin')",
    );
    await conn.query(
      "INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES (9064,'guide-browser-fixture','paid','2030-01-01')",
    );
    backend = await createBackendApplication();
    await backend.listen(0, "127.0.0.1");
    api = `http://127.0.0.1:${(backend.getHttpServer().address() as AddressInfo).port}`;
    wire = await openPrivateUploadWire({ content: true });
    for (const [key, value] of Object.entries({
      S3_ENDPOINT: wire.endpoint,
      S3_BUCKET: wire.bucket,
      S3_ACCESS_KEY: "library-browser-fixture",
      S3_SECRET_KEY: "library-browser-fixture-secret",
      PRIVATE_LIBRARY_FILES_ENABLED: "true",
      PRIVATE_CONTENT_FILES_ENABLED: "true",
    }))
      vi.stubEnv(key, value);
    const files = ["holly", "sock", "star", "apple", "loshadka"].map(
      (fileKey, sortOrder) => {
        const bytes =
          fileKey === "loshadka"
            ? Buffer.from("%PDF-1.4\nSynthetic library fixture\n%%EOF")
            : png;
        return {
          fileKey,
          sortOrder,
          expectedRevision: 0,
          filename: fileKey + (fileKey === "loshadka" ? ".pdf" : ".png"),
          mimeType: fileKey === "loshadka" ? "application/pdf" : "image/png",
          bytes,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        };
      },
    );
    await applyLibraryMigration(
      { id: 9066, sessionVersion: 0 },
      {
        materialKey: "patterns",
        idempotencyKey: "library-browser-synthetic-five-slots",
        files,
      },
    );
  }
  app = await privateFilesBrowser(api);
}, 60000);
afterAll(async () => {
  await app?.close();
  await backend?.close();
  if (conn) {
    await conn.query(
      "DELETE FROM club_payments WHERE orderId='guide-browser-fixture'",
    );
    await conn.query(
      "DELETE b FROM library_file_bindings b JOIN private_content_files f ON b.assetId=f.assetId WHERE f.actorUserId=9066",
    );
    await conn.query(
      "DELETE FROM private_content_files WHERE actorUserId=9066",
    );
    await conn.query("DELETE FROM library_file_migrations WHERE requestKey=?", [
      createHash("sha256")
        .update(
          JSON.stringify([
            "library-migration:v1",
            9066,
            "library-browser-synthetic-five-slots",
          ]),
        )
        .digest("hex"),
    ]);
    await conn.query("DELETE FROM users WHERE id IN (9064,9066)");
    await conn.end();
    await (
      (await getDb()) as unknown as { $client: { end(): Promise<void> } }
    )?.$client.end();
  }
  await wire?.close();
  vi.unstubAllEnvs();
});
async function ownPage() {
  const context = await app.context.browser()!.newContext();
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === app.origin
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(90000);
  page.setDefaultTimeout(30000);
  return page;
}
async function fixture(page: Page) {
  const state = { id: 101, allowed: true, guideStatus: 200 };
  await editorApi(page, (name) =>
    name === "club.subscription"
      ? ok({
          hasClubAccess: state.allowed,
          subscribed: state.allowed,
          expiresAt: "2030-01-01",
          cancelAtPeriodEnd: false,
          cancellationStatus: "none",
          isOwner: false,
          monthlyPrice: "790",
        })
      : undefined,
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: state.id
          ? {
              id: state.id,
              openId: `library-${state.id}`,
              name: "Library fixture",
              email: null,
              role: "user",
              lastSignedIn: "2026-10-20T10:00:00Z",
            }
          : null,
      },
    }),
  );
  await page.route("**/api/library/guides/aesthetics/*", (route) => {
    const key = new URL(route.request().url()).pathname
      .split("/")
      .at(-1) as keyof typeof aestheticGuides;
    return route.fulfill(
      state.guideStatus !== 200
        ? {
            status: state.guideStatus,
            json: { error: "Материал временно недоступен." },
          }
        : state.allowed
          ? { json: { key, ...aestheticGuides[key] } }
          : { status: 404, json: { error: "Материал недоступен." } },
    );
  });
  return state;
}
const marker = aestheticGuides.cottagecore.style.intro.slice(0, 80);
const refresh = (page: Page) =>
  page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
native(
  "leaving the guide cancels a late read; returning starts a fresh private read",
  async () => {
    const page = await ownPage();
    let release!: () => void,
      reads = 0;
    const gate = new Promise<void>((resolve) => (release = resolve));
    try {
      await fixture(page);
      await page.route(
        "**/api/library/guides/aesthetics/cottagecore",
        async (route) => {
          reads++;
          if (reads === 1) await gate;
          await route
            .fulfill({
              json: { key: "cottagecore", ...aestheticGuides.cottagecore },
            })
            .catch(() => {});
        },
      );
      await gotoWithSession(page, app.origin + "/library/aesthetics-guide");
      await ui.poll(() => reads).toBe(1);
      await page
        .getByRole("button", {
          name: "Определить свою эстетику →",
          exact: true,
        })
        .first()
        .click();
      await ui(
        page.getByRole("button", { name: "Начать путешествие", exact: true }),
      ).toBeVisible();
      release();
      await ui(page.locator("body")).not.toContainText(marker);
      await page.goBack();
      await ui(page.locator("body")).toContainText(marker);
      // Focus may also revalidate, but returning must not reuse the late payload.
      expect(reads).toBeGreaterThan(1);
    } finally {
      release?.();
      await page.context().close();
    }
  },
  120000,
);
native(
  "switching accounts while pattern metadata is pending cannot open the old account's files",
  async () => {
    const page = await ownPage();
    let release!: () => void,
      held = false,
      mediaReads = 0;
    const gate = new Promise<void>((resolve) => (release = resolve));
    try {
      const state = await fixture(page);
      await page.route(
        "**/api/library/materials/patterns/files",
        async (route) => {
          held = true;
          await gate;
          await route
            .fulfill({
              json: {
                files: [
                  {
                    fileKey: "holly",
                    sortOrder: 0,
                    revision: 1,
                    filename: "synthetic",
                    mimeType: "image/png",
                    fileSize: png.length,
                    url: "/api/media/library-files/patterns/holly",
                  },
                ],
                nextCursor: null,
              },
            })
            .catch(() => {});
        },
      );
      page.on("request", (request) => {
        if (request.url().includes("/api/media/library-files/")) mediaReads++;
      });
      await gotoWithSession(page, app.origin + "/library/patterns");
      await ui.poll(() => held).toBe(true);
      state.id = 202;
      state.allowed = false;
      await page.evaluate(() =>
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "darcy:session-change",
            newValue: "pattern-switch",
          }),
        ),
      );
      await ui(
        page.getByRole("button", { name: "Вступить в клуб →", exact: true }),
      ).toBeVisible();
      release();
      await ui(
        page.locator('img[src^="/api/media/library-files/"]'),
      ).toHaveCount(0);
      await ui(
        page.getByRole("button", {
          name: "Открыть выкройку: Остролист",
          exact: true,
        }),
      ).toHaveCount(0);
      expect(mediaReads).toBe(0);
    } finally {
      release?.();
      await page.context().close();
    }
  },
  120000,
);
native(
  "guide renders paid server payload, hides it on denied refresh and recovers without static fallback",
  async () => {
    const page = await ownPage();
    try {
      const state = await fixture(page);
      await gotoWithSession(page, app.origin + "/library/aesthetics-guide");
      await ui(page.locator("body")).toContainText(marker);
      state.guideStatus = 503;
      await refresh(page);
      await ui(page.locator("body")).not.toContainText(marker);
      state.guideStatus = 200;
      await page
        .getByRole("button", { name: "Повторить", exact: true })
        .first()
        .click();
      await ui(page.locator("body")).toContainText(marker);
    } finally {
      await page.context().close();
    }
  },
  120000,
);
native(
  "account switch discards a late guide response and does not put paid text in browser persistence",
  async () => {
    const page = await ownPage();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let held = false;
    try {
      const state = await fixture(page);
      await page.route(
        "**/api/library/guides/aesthetics/cottagecore",
        async (route) => {
          held = true;
          await gate;
          await route
            .fulfill({
              json: { key: "cottagecore", ...aestheticGuides.cottagecore },
            })
            .catch(() => {});
        },
      );
      await gotoWithSession(page, app.origin + "/library/aesthetics-guide");
      await ui.poll(() => held).toBe(true);
      state.id = 202;
      state.allowed = false;
      await page.evaluate(() =>
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "darcy:session-change",
            newValue: "library-switch",
          }),
        ),
      );
      await ui(
        page.getByText("привилегия участниц Клуба Darcy", { exact: true }),
      ).toBeVisible();
      release();
      await ui(page.locator("body")).not.toContainText(marker);
      const stored = await page.evaluate(() =>
        JSON.stringify({
          local: { ...localStorage },
          session: { ...sessionStorage },
        }),
      );
      expect(stored).not.toContain(marker);
    } finally {
      release?.();
      await page.context().close();
    }
  },
  120000,
);
native(
  "quiz keeps the free result and fetches paid sections only after Читать",
  async () => {
    const page = await ownPage();
    let reads = 0;
    try {
      await fixture(page);
      await page.addInitScript(() =>
        localStorage.setItem(
          "darcy:user:101:@darcy_quiz_result",
          JSON.stringify({
            primaryKey: "cottagecore",
            secondaryKey: null,
            isBlend: false,
            scores: {
              cottagecore: 21,
              goblincore: 0,
              witchcore: 0,
              castlecore: 0,
              fairycore: 0,
              darkAcademia: 0,
              lightAcademia: 0,
            },
          }),
        ),
      );
      page.on("request", (r) => {
        if (r.url().includes("/api/library/guides/")) reads++;
      });
      await gotoWithSession(page, app.origin + "/quiz/result");
      await ui(
        page.getByRole("button", { name: "Читать", exact: true }),
      ).toBeVisible();
      expect(reads).toBe(0);
      await page.getByRole("button", { name: "Читать", exact: true }).click();
      await ui(page.locator("body")).toContainText(marker);
      expect(reads).toBe(1);
    } finally {
      await page.context().close();
    }
  },
  120000,
);
native(
  "guest can complete the existing free quiz without fetching club sections",
  async () => {
    const page = await ownPage();
    let reads = 0;
    try {
      const state = await fixture(page);
      state.id = 0;
      state.allowed = false;
      page.on("request", (r) => {
        if (r.url().includes("/api/library/guides/")) reads++;
      });
      await gotoWithSession(page, app.origin + "/quiz");
      await page
        .getByRole("button", { name: "Начать путешествие", exact: true })
        .click();
      for (let i = 0; i < QUESTIONS.length; i++) {
        await ui(
          page.getByText(`${i + 1} / ${QUESTIONS.length}`, { exact: true }),
        ).toBeVisible();
        const choice = page.getByRole("button", {
          name: "Выбрать изображение 1",
          exact: true,
        });
        if (await choice.count()) await choice.click();
        else
          await page
            .getByRole("button", {
              name: QUESTIONS[i].answers[0].text.replace(/[*_]/g, ""),
              exact: true,
            })
            .click();
        await page
          .getByRole("button", {
            name: i === QUESTIONS.length - 1 ? "Узнать результат" : "Далее →",
            exact: true,
          })
          .click();
      }
      await ui(
        page.getByRole("button", { name: "Вступить в клуб", exact: true }),
      ).toBeVisible();
      expect(reads).toBe(0);
      await ui(page.locator("body")).not.toContainText(marker);
      expect(
        Object.values(AESTHETIC_RESULTS).some((result) =>
          Boolean(result.title),
        ),
      ).toBe(true);
    } finally {
      await page.context().close();
    }
  },
  120000,
);
native(
  "patterns use only canonical synthetic bindings and never fall back when disabled",
  async () => {
    const page = await ownPage();
    const requested: string[] = [];
    try {
      await fixture(page);
      const files = ["holly", "sock", "star", "apple", "loshadka"].map(
        (fileKey, sortOrder) => ({
          fileKey,
          sortOrder,
          revision: 1,
          filename: "synthetic",
          mimeType: fileKey === "loshadka" ? "application/pdf" : "image/png",
          fileSize: png.length,
          url: `/api/media/library-files/patterns/${fileKey}`,
        }),
      );
      await page.route("**/api/library/materials/patterns/files", (route) =>
        route.fulfill({ json: { files, nextCursor: null } }),
      );
      await page.route("**/api/media/library-files/patterns/*", (route) =>
        route.fulfill({ contentType: "image/png", body: png }),
      );
      page.on("request", (r) => requested.push(r.url()));
      await gotoWithSession(page, app.origin + "/library/patterns");
      await page
        .getByRole("button", {
          name: "Открыть выкройку: Остролист",
          exact: true,
        })
        .click();
      await ui
        .poll(() =>
          requested.some((url) =>
            url.endsWith("/api/media/library-files/patterns/holly"),
          ),
        )
        .toBe(true);
      await page.route("**/api/library/materials/patterns/files", (route) =>
        route.fulfill({ status: 404, json: { error: "Файл недоступен." } }),
      );
      await refresh(page);
      await ui(
        page.getByRole("button", { name: "Открыть PDF →", exact: true }),
      ).toBeDisabled();
      await ui(
        page.getByRole("button", {
          name: "Открыть выкройку: Остролист",
          exact: true,
        }),
      ).toHaveCount(0);
      expect(
        requested.some((url) =>
          /EJllmcoOmdUexPyK|kvcsayGSgtVcnjGN|HSvrSZijpbSHOLAN|ReabYqEbymjBrDEY|disk.yandex.ru/.test(
            url,
          ),
        ),
      ).toBe(false);
    } finally {
      await page.context().close();
    }
  },
  120000,
);
const sqlBrowser =
  process.env.DARYADARCY_LOCAL_BROWSER === "1" && testDatabaseUrl
    ? it
    : it.skip;
sqlBrowser(
  "pattern UI reads five synthetic slots through real API/SQL/loopback SDK wire and honors expiry",
  async () => {
    const page = await ownPage();
    try {
      await conn!.query(
        "UPDATE club_payments SET expiresAt='2030-01-01' WHERE orderId='guide-browser-fixture'",
      );
      await fixture(page);
      await page.context().addCookies([
        {
          name: COOKIE_NAME,
          value: await sdk.createSessionToken("guide-browser", {
            sessionVersion: 0,
          }),
          url: app.origin,
        },
      ]);
      await page.route("**/api/auth/me", (route) => route.continue());
      await page.route("**/api/library/materials/patterns/files", (route) =>
        route.continue(),
      );
      await page.route("**/api/media/library-files/patterns/*", (route) =>
        route.continue(),
      );
      await gotoWithSession(page, app.origin + "/library/patterns");
      await ui(
        page.getByRole("button", {
          name: "Открыть выкройку: Остролист",
          exact: true,
        }),
      ).toBeVisible();
      for (const key of ["holly", "sock", "star", "apple"]) {
        const image = page.locator(
          `img[src="/api/media/library-files/patterns/${key}"]`,
        );
        await ui(image).toHaveCount(1);
        const direct = await page.request.get(
          app.origin + `/api/media/library-files/patterns/${key}`,
        );
        expect(direct.status(), `synthetic ${key} read`).toBe(200);
        expect(await direct.body()).toEqual(png);
        await image.scrollIntoViewIfNeeded();
        await ui
          .poll(() =>
            image.evaluate(
              (element: HTMLImageElement) =>
                element.complete && element.naturalWidth > 0,
            ),
          )
          .toBe(true);
      }
      const pdf = await page.request.get(
        app.origin + "/api/media/library-files/patterns/loshadka",
      );
      expect(pdf.status()).toBe(200);
      expect((await pdf.body()).toString()).toContain(
        "Synthetic library fixture",
      );
      expect(pdf.headers()["cache-control"]).toBe("private, no-store");
      expect(wire!.objects.size).toBe(5);
      await conn!.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='guide-browser-fixture'",
      );
      await refresh(page);
      await ui(
        page.getByRole("button", { name: "Открыть PDF →", exact: true }),
      ).toBeDisabled();
      await ui(
        page.locator('img[src^="/api/media/library-files/"]'),
      ).toHaveCount(0);
      expect(
        (
          await page.request.get(
            app.origin + "/api/media/library-files/patterns/loshadka",
          )
        ).status(),
      ).toBe(404);
    } finally {
      await page.context().close();
    }
  },
  120000,
);
(process.env.DARYADARCY_LOCAL_BROWSER === "1" && testDatabaseUrl
  ? it
  : it.skip)(
  "guide UI reads through real Next proxy/Nest/JWT/SQL and honors expiry",
  async () => {
    const page = await ownPage();
    try {
      await conn!.query(
        "UPDATE club_payments SET expiresAt='2030-01-01' WHERE orderId='guide-browser-fixture'",
      );
      await fixture(page);
      await page.context().addCookies([
        {
          name: COOKIE_NAME,
          value: await sdk.createSessionToken("guide-browser", {
            sessionVersion: 0,
          }),
          url: app.origin,
        },
      ]);
      await page.route("**/api/auth/me", (route) => route.continue());
      await page.route("**/api/library/guides/aesthetics/*", (route) =>
        route.continue(),
      );
      await gotoWithSession(page, app.origin + "/library/aesthetics-guide");
      await ui(page.locator("body")).toContainText(marker);
      await conn!.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='guide-browser-fixture'",
      );
      await refresh(page);
      await ui(page.locator("body")).not.toContainText(marker);
      await ui(
        page.getByRole("button", { name: "Повторить", exact: true }).first(),
      ).toBeVisible();
    } finally {
      await page.context().close();
    }
  },
  120000,
);
