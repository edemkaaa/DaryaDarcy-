import { afterAll, beforeAll, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, type Browser, type BrowserContext } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";

const native = process.env.DARYADARCY_LOCAL_BROWSER === "1" ? it : it.skip;
type Fixture = Pick<
  typeof import("../apps/frontend/src/shared/api/trpc"),
  "createTRPCClient"
> &
  Pick<
    typeof import("../apps/frontend/src/shared/api/request-lifecycle"),
    "getSessionRequestSignal"
  > &
  Pick<
    typeof import("../apps/frontend/src/shared/browser/operation-scope"),
    "OperationScope"
  > &
  Pick<
    typeof import("../apps/frontend/src/shared/browser/storage"),
    "setPersonalDataOwner"
  > &
  Pick<
    typeof import("../apps/frontend/src/domain/content/article-creation-journal"),
    "ArticleCreationJournal"
  > &
  Pick<
    typeof import("../apps/frontend/src/domain/content/article-file-save"),
    "recoverArticleFileUploads"
  >;
type FixtureWindow = Window & { uploadFixture: Fixture };
type WireUpload = {
  key: string;
  size: number;
  hash: string;
  durationMs: number;
  path: string;
};
let browser: Browser | undefined, server: Server | undefined, origin: string;
const uploads: WireUpload[] = [];
const statusKeys: string[] = [];
const receipts = new Map<string, Record<string, unknown>>();
let dropReply: false | "before-headers" | "body" = false;
const assetId = "3af23d8c-140f-454b-a123-123456789abc";

beforeAll(async () => {
  if (process.env.DARYADARCY_LOCAL_BROWSER !== "1") return;
  const root = new URL("../", import.meta.url).pathname;
  const bundle = (
    await build({
      stdin: {
        contents: `
        export {createTRPCClient} from './apps/frontend/src/shared/api/trpc';
        export {getSessionRequestSignal} from './apps/frontend/src/shared/api/request-lifecycle';
        export {OperationScope} from './apps/frontend/src/shared/browser/operation-scope';
        export {setPersonalDataOwner} from './apps/frontend/src/shared/browser/storage';
        export {ArticleCreationJournal} from './apps/frontend/src/domain/content/article-creation-journal';
        export {recoverArticleFileUploads} from './apps/frontend/src/domain/content/article-file-save';
      `,
        resolveDir: root,
        loader: "ts",
      },
      bundle: true,
      write: false,
      platform: "browser",
      format: "iife",
      globalName: "uploadFixture",
      tsconfig: `${root}apps/frontend/tsconfig.json`,
      define: {
        "process.env.NODE_ENV": '"production"',
        "process.env.NEXT_PUBLIC_API_BASE_URL": '""',
      },
    })
  ).outputFiles[0].text;
  server = createServer(async (request, response) => {
    const started = performance.now();
    const url = new URL(request.url!, "http://fixture.invalid");
    if (url.pathname === "/") {
      response.writeHead(200, {
        "Content-Type": "text/html",
        "Set-Cookie": "upload_fixture=own; HttpOnly; SameSite=Lax; Path=/",
      });
      response.end(
        "<!doctype html><title>Owned frontend upload acceptance</title>",
      );
      return;
    }
    if (url.pathname === "/fixture.js") {
      response.writeHead(200, { "Content-Type": "text/javascript" });
      response.end(bundle);
      return;
    }
    if (!url.pathname.startsWith("/api/trpc/")) {
      response.writeHead(404).end();
      return;
    }
    try {
      expect(request.headers.cookie).toContain("upload_fixture=own");
      const path = url.pathname.slice("/api/trpc/".length);
      expect(path).not.toContain(",");
      let body = "";
      for await (const chunk of request) {
        body += chunk.toString("utf8");
        if (body.length > 50 * 1024 * 1024)
          throw new Error("Fixture body limit");
      }
      const envelope = JSON.parse(body || url.searchParams.get("input")!);
      const input = envelope.json ?? envelope[0].json;
      let value: unknown;
      if (path === "admin.uploadPrivateContentFile") {
        const bytes = Buffer.from(input.base64, "base64");
        uploads.push({
          key: input.idempotencyKey,
          size: bytes.length,
          hash: createHash("sha256").update(bytes).digest("hex"),
          durationMs: performance.now() - started,
          path,
        });
        value = {
          state: "ready",
          assetId,
          usage: input.usage,
          filename: input.filename,
          mimeType: input.mimeType,
          fileSize: bytes.length,
          url: `/api/media/content-files/${assetId}`,
        };
        if (!receipts.has(input.idempotencyKey))
          receipts.set(input.idempotencyKey, value as Record<string, unknown>);
        if (dropReply) {
          if (dropReply === "before-headers") response.destroy();
          else {
            response.writeHead(200, { "Content-Type": "application/json" });
            response.write("[");
            // Receiving headers prevents Chromium's connection-level replay.
            setTimeout(() => response.destroy(), 25);
          }
          return;
        }
      } else if (path === "admin.privateContentFileStatus") {
        statusKeys.push(input.idempotencyKey);
        value = receipts.get(input.idempotencyKey) ?? { state: "notRecorded" };
      } else throw new Error("Unexpected fixture API procedure");
      const result = { result: { data: { json: value } } };
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(
        JSON.stringify(
          url.searchParams.get("batch") === "1" ? [result] : result,
        ),
      );
    } catch (error) {
      if (!request.destroyed && !response.destroyed)
        response.writeHead(500).end("Fixture request rejected");
      if (!(error instanceof Error && error.message.includes("aborted")))
        console.error(error);
    }
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  });
}, 30_000);

afterAll(async () => {
  await browser?.close();
  server?.closeAllConnections();
  if (server)
    await new Promise<void>((resolve) => server!.close(() => resolve()));
});

async function open(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto(origin);
  await page.addScriptTag({ url: `${origin}/fixture.js` });
  return page;
}

native(
  "32 MiB original File uploads at 10 Mbit/s and retains its receipt and exact bytes",
  async () => {
    const context = await browser!.newContext();
    try {
      uploads.length = 0;
      statusKeys.length = 0;
      dropReply = false;
      const page = await open(context);
      const session = await context.newCDPSession(page);
      await session.send("Network.enable");
      await session.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: 1_250_000,
      });
      const size = 32 * 1024 * 1024;
      const result = await page.evaluate(async (size) => {
        const f = (window as unknown as FixtureWindow).uploadFixture;
        f.setPersonalDataOwner(101);
        const file = new File([new Uint8Array(size).fill(120)], "large.txt", {
          type: "text/plain",
        });
        const selected = {
          key: crypto.randomUUID(),
          usage: "articleDocument" as const,
          file,
        };
        const journal = new f.ArticleCreationJournal(101);
        const { record } = await journal.prepare(
          {
            title: "Slow file",
            coverUrl: null,
            access: "club",
            published: false,
            sections: [{ type: "link", url: `local-content:${selected.key}` }],
          },
          { editingId: null, files: [selected] },
        );
        const client = f.createTRPCClient();
        const task = new f.OperationScope().begin(
          "upload",
          f.getSessionRequestSignal(),
          () => true,
        )!;
        const current = await f.recoverArticleFileUploads(
          record,
          journal,
          {
            upload: (input, signal) =>
              client.admin.uploadPrivateContentFile.mutate(input, { signal }),
            status: (input, signal) =>
              client.admin.privateContentFileStatus.query(input, { signal }),
          },
          task,
          () => {},
        );
        const restored = await journal.load();
        return {
          key: selected.key,
          phase: current.media!.phase,
          state: restored!.media!.files[0].receipt?.state,
          size: restored!.media!.files[0].file.size,
        };
      }, size);
      expect(result).toMatchObject({ phase: "upload", state: "ready", size });
      expect(uploads).toHaveLength(1);
      const hash = createHash("sha256");
      const chunk = Buffer.alloc(64 * 1024, 120);
      for (let offset = 0; offset < size; offset += chunk.length)
        hash.update(chunk);
      expect(uploads[0]).toMatchObject({
        key: result.key,
        size,
        hash: hash.digest("hex"),
      });
      expect(uploads[0].durationMs).toBeGreaterThan(30_000);
      expect(statusKeys).toEqual([]);
      console.log(
        JSON.stringify({
          uploadAcceptance: "32MiB/10Mbit",
          wireDurationMs: Math.round(uploads[0].durationMs),
          decodedBytes: uploads[0].size,
          uploads: uploads.length,
        }),
      );
      writeFileSync(
        "/tmp/darcy-network-2-slow-upload-result.json",
        JSON.stringify(
          {
            decodedBytes: uploads[0].size,
            wireDurationMs: Math.round(uploads[0].durationMs),
            uploadBytesPerSecond: 1_250_000,
            physicalRequests: uploads.length,
            sha256Verified: true,
          },
          null,
          2,
        ),
      );
    } finally {
      await context.close();
    }
  },
  75_000,
);

for (const fault of ["before-headers", "body"] as const)
  native(
    `a lost acknowledgement (${fault}) survives reload and recovers by status without a new upload`,
    async () => {
      const context = await browser!.newContext();
      try {
        uploads.length = 0;
        statusKeys.length = 0;
        receipts.clear();
        dropReply = fault;
        const page = await open(context);
        const first = await page.evaluate(async () => {
          const f = (window as unknown as FixtureWindow).uploadFixture;
          f.setPersonalDataOwner(101);
          const selected = {
            key: crypto.randomUUID(),
            usage: "articleDocument" as const,
            file: new File(["original document"], "original.txt", {
              type: "text/plain",
            }),
          };
          const journal = new f.ArticleCreationJournal(101);
          const { record } = await journal.prepare(
            {
              title: "Lost reply",
              coverUrl: null,
              access: "club",
              published: false,
              sections: [
                { type: "link", url: `local-content:${selected.key}` },
              ],
            },
            { editingId: null, files: [selected] },
          );
          const client = f.createTRPCClient();
          const task = new f.OperationScope().begin(
            "upload",
            f.getSessionRequestSignal(),
            () => true,
          )!;
          try {
            await f.recoverArticleFileUploads(
              record,
              journal,
              {
                upload: (input, signal) =>
                  client.admin.uploadPrivateContentFile.mutate(input, {
                    signal,
                  }),
                status: (input, signal) =>
                  client.admin.privateContentFileStatus.query(input, {
                    signal,
                  }),
              },
              task,
              () => {},
            );
            throw new Error("Fixture should lose its reply");
          } catch (error) {
            if (
              (error as { cause?: { kind?: string } }).cause?.kind !== "network"
            )
              throw error;
          }
          return {
            key: selected.key,
            state: (await journal.load())!.media!.files[0].attempted,
          };
        });
        expect(first.state).toBe(true);
        // Chromium can replay a reset connection before receiving any headers.
        // Such a replay must retain the same intent and bytes, never a fresh key.
        const physicalRequests = uploads.length;
        expect(physicalRequests).toBeGreaterThanOrEqual(1);
        expect(physicalRequests).toBeLessThanOrEqual(2);
        if (fault === "body") expect(physicalRequests).toBe(1);
        expect(receipts.size).toBe(1);
        expect(new Set(uploads.map((upload) => upload.key))).toEqual(
          new Set([first.key]),
        );
        expect(new Set(uploads.map((upload) => upload.hash)).size).toBe(1);
        await page.reload();
        await page.addScriptTag({ url: `${origin}/fixture.js` });
        expect(uploads).toHaveLength(physicalRequests);
        expect(statusKeys).toEqual([]);
        const recovered = await page.evaluate(async () => {
          const f = (window as unknown as FixtureWindow).uploadFixture;
          f.setPersonalDataOwner(101);
          const journal = new f.ArticleCreationJournal(101);
          const record = (await journal.load())!;
          const original = await record.media!.files[0].file.text();
          const client = f.createTRPCClient();
          const task = new f.OperationScope().begin(
            "recover",
            f.getSessionRequestSignal(),
            () => true,
          )!;
          const current = await f.recoverArticleFileUploads(
            record,
            journal,
            {
              upload: (input, signal) =>
                client.admin.uploadPrivateContentFile.mutate(input, { signal }),
              status: (input, signal) =>
                client.admin.privateContentFileStatus.query(input, { signal }),
            },
            task,
            () => {},
          );
          return {
            original,
            key: current.media!.files[0].key,
            state: current.media!.files[0].receipt?.state,
            phase: current.media!.phase,
          };
        });
        expect(recovered).toEqual({
          original: "original document",
          key: first.key,
          state: "ready",
          phase: "upload",
        });
        expect(uploads).toHaveLength(physicalRequests);
        expect(statusKeys).toEqual([first.key]);
      } finally {
        await context.close();
      }
    },
    20_000,
  );
