import { afterAll, beforeAll, expect, it } from "vitest";
import { expect as ui, type Page } from "@playwright/test";
import sharp from "sharp";
import { statfs } from "node:fs/promises";
import { privateFilesBrowser } from "./helpers/private-files-browser";
import { editorApi, ok, failure } from "../apps/frontend/e2e/editor-fixtures";
import { gotoWithSession } from "../apps/frontend/e2e/layout-fixtures";
const native = process.env.DARYADARCY_LOCAL_BROWSER === "1" ? it : it.skip;
let app: Awaited<ReturnType<typeof privateFilesBrowser>>, png: Buffer;
beforeAll(async () => {
  if (process.env.DARYADARCY_LOCAL_BROWSER !== "1") return;
  const disk = await statfs(process.cwd());
  if (disk.bavail * disk.bsize < 2 * 1024 ** 3) throw new Error("Own comment browser fixture requires 2 GiB free");
  png = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 4,
      background: { r: 20, g: 40, b: 60, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  app = await privateFilesBrowser("http://127.0.0.1:1");
}, 60000);
afterAll(async () => {
  await app?.close();
});
native(
  "an account switch during the canonical list read keeps confirmed recovery for the original owner",
  async () => {
    let owner = 101,
      writes = 0,
      reading = false,
      release!: () => void,
      started!: () => void;
    const held = new Promise<void>((resolve) => {
        release = resolve;
      }),
      reached = new Promise<void>((resolve) => {
        started = resolve;
      });
    const page = await ownPage(async (name, input) => {
      if (name === "club.uploadPrivateCommentPhoto") return ok(receipt(input));
      if (name === "club.addComment") {
        writes++;
        return ok({ id: 91 });
      }
      if (name === "club.comments" && writes && !reading) {
        reading = true;
        started();
        await held;
        return ok([]);
      }
    });
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        json: {
          user: {
            id: owner,
            openId: `synthetic-${owner}`,
            role: "admin",
            name: "Synthetic",
            email: "synthetic@example.test",
            lastSignedIn: new Date().toISOString(),
          },
        },
      }),
    );
    try {
      await open(page);
      await text(page).fill("CONFIRMED_OWNER");
      await choose(page);
      await page
        .getByRole("button", { name: "Отправить", exact: true })
        .click();
      await reached;
      owner = 202;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await page
        .getByRole("button", { name: "Комьюнити", exact: true })
        .click();
      await ui(text(page)).toHaveValue("");
      release();
      await ui(
        page.getByRole("button", {
          name: "Восстановить отправку",
          exact: true,
        }),
      ).toHaveCount(0);
      owner = 101;
      await open(page);
      await page
        .getByRole("button", { name: "Восстановить отправку", exact: true })
        .click();
      await ui(text(page)).toHaveValue("CONFIRMED_OWNER");
      await page
        .getByRole("button", { name: "Повторить отправку", exact: true })
        .click();
      await ui(text(page)).toHaveValue("");
      expect(writes).toBe(1);
    } finally {
      release();
      await page.context().close();
    }
  },
  120000,
);
const text = (page: Page) => page.getByPlaceholder("Написать комментарий...");
const url = "/api/media/content-files/3af23d8c-140f-454b-a123-123456789abc";
const receipt = (input: Record<string, unknown>) => ({
  state: "ready",
  assetId: "3af23d8c-140f-454b-a123-123456789abc",
  usage: "commentPhoto",
  filename: input.filename,
  mimeType: "image/webp",
  fileSize: 80,
  url,
});
async function ownPage(answer: Parameters<typeof editorApi>[1]) {
  const context = await app.context.browser()!.newContext();
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === app.origin
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept());
  await editorApi(page, async (name, input, route) => {
    const custom = await answer?.(name, input, route);
    if (custom !== undefined) return custom;
    if (name === "club.subscription")
      return ok({
        hasClubAccess: true,
        subscribed: true,
        expiresAt: "2030-01-01T00:00:00Z",
        cancelAtPeriodEnd: false,
        isOwner: true,
        monthlyPrice: "790",
      });
    if (name === "club.list")
      return ok({
        posts: [
          {
            id: 1,
            text: "PRIVATE_COMMENT_POST",
            tags: ["community"],
            target: "club",
            photos: [],
            media: [],
            createdAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
            commentCount: 0,
            likeCount: 0,
          },
        ],
        nextCursor: null,
      });
    if (name === "club.comments") return ok([]);
  });
  return page;
}
async function open(page: Page) {
  await gotoWithSession(page, `${app.origin}/club`);
  await page.getByRole("button", { name: "Комьюнити", exact: true }).click();
  await ui(text(page)).toBeVisible();
}
async function choose(page: Page) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Фото (0/2)", exact: true }).click(),
  ]);
  await chooser.setFiles({
    name: "comment.png",
    mimeType: "image/png",
    buffer: png,
  });
}
native(
  "comment photo stays local; lost upload and comment replies recover after reload with one frozen key",
  async () => {
    const uploads: Record<string, unknown>[] = [],
      writes: Record<string, unknown>[] = [],
      statuses: Record<string, unknown>[] = [];
    let publicUploads = 0;
    const page = await ownPage((name, input) => {
      if (name === "club.uploadCommentPhoto") {
        publicUploads++;
        return ok({ url: "/public.png" });
      }
      if (name === "club.uploadPrivateCommentPhoto") {
        uploads.push(input);
        return failure(503);
      }
      if (name === "club.privateCommentPhotoStatus") {
        statuses.push(input);
        return ok(receipt(uploads[0]));
      }
      if (name === "club.addComment") {
        writes.push(input);
        return writes.length === 1 ? failure(503) : ok({ id: 91 });
      }
    });
    try {
      await open(page);
      await text(page).fill("PRIVATE_COMMENT");
      await choose(page);
      await ui(page.locator('img[src^="blob:"]')).toHaveCount(1);
      expect(publicUploads).toBe(0);
      expect(uploads).toHaveLength(0);
      await page
        .getByRole("button", { name: "Отправить", exact: true })
        .click();
      await ui(
        page.getByRole("button", { name: "Повторить отправку", exact: true }),
      ).toBeEnabled();
      expect(uploads).toHaveLength(1);
      expect(writes).toHaveLength(0);
      await open(page);
      await page
        .getByRole("button", { name: "Восстановить отправку", exact: true })
        .click();
      await ui(text(page)).toHaveValue("PRIVATE_COMMENT");
      await ui(page.locator('img[src^="blob:"]')).toHaveCount(1);
      await page
        .getByRole("button", { name: "Повторить отправку", exact: true })
        .click();
      await ui.poll(() => writes.length).toBe(1);
      await ui(
        page.getByRole("button", { name: "Повторить отправку", exact: true }),
      ).toBeEnabled();
      await open(page);
      await page
        .getByRole("button", { name: "Восстановить отправку", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Повторить отправку", exact: true })
        .click();
      await ui(text(page)).toHaveValue("");
      await ui(
        page.getByRole("button", {
          name: "Восстановить отправку",
          exact: true,
        }),
      ).toHaveCount(0);
      expect(writes).toHaveLength(2);
      expect(writes[1]).toEqual(writes[0]);
      expect(writes[0]).toMatchObject({
        postId: 1,
        text: "PRIVATE_COMMENT",
        photos: [url],
        idempotencyKey: expect.any(String),
      });
      expect(uploads).toHaveLength(1);
      expect(publicUploads).toBe(0);
      expect(statuses).toEqual([{ idempotencyKey: uploads[0].idempotencyKey }]);
    } finally {
      await page.context().close();
    }
  },
  120000,
);
for (const stage of ["upload", "status"] as const)
  native(
    `comment account switch during ${stage} ignores late receipt and keeps the original owner's operation`,
    async () => {
      let owner = 101,
        release!: () => void,
        started!: () => void;
      const held = new Promise<void>((resolve) => {
          release = resolve;
        }),
        reached = new Promise<void>((resolve) => {
          started = resolve;
        });
      const uploads: Record<string, unknown>[] = [],
        writes: unknown[] = [];
      let completed = 0;
      const page = await ownPage(async (name, input) => {
        if (name === "club.uploadPrivateCommentPhoto") {
          uploads.push(input);
          if (stage === "status") return failure(503);
          started();
          await held;
          completed++;
          return ok(receipt(input));
        }
        if (name === "club.privateCommentPhotoStatus") {
          if (stage === "status" && completed === 0) {
            started();
            await held;
            completed++;
          }
          return ok(receipt(uploads[0]));
        }
        if (name === "club.addComment") {
          writes.push(input);
          return ok({ id: 91 });
        }
      });
      await page.route("**/api/auth/me", (route) =>
        route.fulfill({
          json: {
            user: {
              id: owner,
              openId: `synthetic-${owner}`,
              role: "admin",
              name: "Synthetic",
              email: "synthetic@example.test",
              lastSignedIn: new Date().toISOString(),
            },
          },
        }),
      );
      try {
        await open(page);
        await text(page).fill("OWNER_COMMENT");
        await choose(page);
        await ui(page.locator('img[src^="blob:"]')).toHaveCount(1);
        const blob = await page
          .locator('img[src^="blob:"]')
          .getAttribute("src");
        await page
          .getByRole("button", { name: "Отправить", exact: true })
          .click();
        if (stage === "status") {
          await page
            .getByRole("button", { name: "Повторить отправку", exact: true })
            .click();
        }
        await reached;
        owner = 202;
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
        await page
          .getByRole("button", { name: "Комьюнити", exact: true })
          .click();
        await ui(text(page)).toHaveValue("");
        await ui(page.locator('img[src^="blob:"]')).toHaveCount(0);
        expect(
          await page.evaluate(async (value) => {
            try {
              await fetch(value!);
              return "readable";
            } catch {
              return "revoked";
            }
          }, blob),
        ).toBe("revoked");
        release();
        await ui.poll(() => completed).toBe(1);
        expect(writes).toHaveLength(0);
        await ui(text(page)).toHaveValue("");
        owner = 101;
        await open(page);
        await page
          .getByRole("button", { name: "Восстановить отправку", exact: true })
          .click();
        await ui(text(page)).toHaveValue("OWNER_COMMENT");
        await page
          .getByRole("button", { name: "Повторить отправку", exact: true })
          .click();
        await ui(text(page)).toHaveValue("");
        expect(uploads).toHaveLength(1);
        expect(writes).toHaveLength(1);
      } finally {
        release();
        await page.context().close();
      }
    },
    120000,
  );
native(
  "removing a selected comment photo revokes its blob and never uploads it",
  async () => {
    let uploads = 0;
    const writes: Record<string, unknown>[] = [];
    const page = await ownPage((name, input) => {
      if (
        name === "club.uploadCommentPhoto" ||
        name === "club.uploadPrivateCommentPhoto"
      ) {
        uploads++;
        return ok(receipt(input));
      }
      if (name === "club.addComment") {
        writes.push(input);
        return ok({ id: 91 });
      }
    });
    try {
      await open(page);
      await text(page).fill("TEXT_ONLY");
      await choose(page);
      await ui(page.locator('img[src^="blob:"]')).toHaveCount(1);
      const blob = await page.locator('img[src^="blob:"]').getAttribute("src");
      await page
        .getByRole("button", {
          name: "Удалить фото из комментария",
          exact: true,
        })
        .click();
      await ui(page.locator('img[src^="blob:"]')).toHaveCount(0);
      expect(
        await page.evaluate(async (value) => {
          try {
            await fetch(value!);
            return "readable";
          } catch {
            return "revoked";
          }
        }, blob),
      ).toBe("revoked");
      await page
        .getByRole("button", { name: "Отправить", exact: true })
        .click();
      await ui(text(page)).toHaveValue("");
      expect(uploads).toBe(0);
      expect(writes).toEqual([
        { postId: 1, text: "TEXT_ONLY", parentId: null, photos: null },
      ]);
    } finally {
      await page.context().close();
    }
  },
  120000,
);
