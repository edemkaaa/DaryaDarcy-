import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import superjson from "superjson";
import { COOKIE_NAME } from "../packages/shared/src/const";
import { hashPassword } from "../apps/backend/src/_core/password";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";
import { testDatabaseUrl } from "./helpers/backend-mysql";

// Opt-in acceptance of an ALREADY BUILT image, not host Nest/tsx code. Database
// ownership must match the dedicated runner; never attach a working container.
describe.skipIf(!testDatabaseUrl || !process.env.BACKEND_API_IMAGE)(
  "built backend image on disposable MySQL",
  () => {
    vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });
    const image = process.env.BACKEND_API_IMAGE!;
    const dbId = process.env.BACKEND_IMAGE_DATABASE_CONTAINER_ID!;
    const dbOwner = process.env.BACKEND_IMAGE_DATABASE_OWNER!;
    const owner = `darcy-image-${randomUUID()}`;
    const network = owner;
    const docker = (...args: string[]) => {
      try {
        return execFileSync("docker", args, {
          encoding: "utf8",
          timeout: 20_000,
          stdio: ["ignore", "pipe", "pipe"],
        }).trim();
      } catch {
        throw new Error(`Owned Docker ${args[0]} operation failed`);
      }
    };
    const inspect = (id: string) => JSON.parse(docker("inspect", id))[0];
    let conn: Connection,
      ownsNetwork = false,
      attached = false,
      ownsFixture = false;
    let platform = "";
    const env: Record<string, string> = {};
    let api: string, second: string;
    const password = "image-fixture-password-123";
    let adminId: number;
    let adminCookie = "",
      memberCookie = "";
    type HttpResult = {
      status: number;
      text: string;
      cookies: string[];
      headers: Record<string, string>;
    };
    const httpWire = `const fs=require('node:fs');const x=JSON.parse(fs.readFileSync(0,'utf8'));fetch('http://'+(x.host||'127.0.0.1')+':3000'+x.path,{method:x.method,headers:{'Content-Type':'application/json',...(x.cookie?{'Cookie':x.cookie}:{}),...x.headers},body:['GET','HEAD'].includes(x.method)?undefined:x.raw===undefined?JSON.stringify(x.data):x.raw,redirect:'manual',signal:AbortSignal.timeout(x.timeoutMs||5000)}).then(async r=>console.log(JSON.stringify({status:r.status,text:x.discardBody?(await r.body?.cancel(),''):await r.text(),cookies:r.headers.getSetCookie(),headers:Object.fromEntries([...r.headers].filter(([k])=>k!=='set-cookie'))}))).catch(()=>{process.exitCode=1})`;
    function request(
      container: string,
      path: string,
      data?: unknown,
      cookie = "",
      method = "POST",
      wire: {
        raw?: string;
        headers?: Partial<Record<string, string>>;
        discardBody?: boolean;
      } = {},
    ): HttpResult {
      try {
        return JSON.parse(
          execFileSync(
            "docker",
            ["exec", "-i", container, "node", "-e", httpWire],
            {
              encoding: "utf8",
              input: JSON.stringify({ path, data, cookie, method, ...wire }),
              timeout: 10000,
              stdio: ["pipe", "pipe", "pipe"],
            },
          ),
        );
      } catch {
        throw new Error("Owned image HTTP request failed");
      }
    }
    function pendingRequest(
      container: string,
      host: string,
      path: string,
      data: unknown,
      cookie: string,
    ) {
      const child = spawn(
        "docker",
        ["exec", "-i", container, "node", "-e", httpWire],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
      let output = "";
      const result = new Promise<HttpResult>((resolve, reject) => {
        const deadline = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error("Image HTTP driver deadline"));
        }, 20000);
        child.stdout.on("data", (part) => {
          output += String(part);
        });
        child.stderr.resume();
        child.once("error", () => {
          clearTimeout(deadline);
          reject(new Error("Image HTTP driver failed"));
        });
        child.once("close", (code) => {
          clearTimeout(deadline);
          if (code !== 0) {
            reject(new Error("Image HTTP driver failed"));
            return;
          }
          try {
            resolve(JSON.parse(output));
          } catch {
            reject(new Error("Invalid image HTTP response"));
          }
        });
      });
      void result.catch(() => {});
      child.stdin.end(
        JSON.stringify({
          host,
          path,
          data,
          cookie,
          method: "POST",
          timeoutMs: 15000,
        }),
      );
      return { child, result };
    }
    function trpc(
      container: string,
      path: string,
      input: unknown,
      cookie = "",
      query = false,
    ) {
      const encoded = superjson.stringify(input);
      const response = request(
        container,
        `/api/trpc/${path}${query ? `?input=${encodeURIComponent(encoded)}` : ""}`,
        query ? undefined : JSON.parse(encoded),
        cookie,
        query ? "GET" : "POST",
      );
      const wire = JSON.parse(response.text);
      return {
        response,
        data: wire.result ? superjson.deserialize(wire.result.data) : undefined,
        error: wire.error ? superjson.deserialize(wire.error) : undefined,
      };
    }
    function ready(container: string) {
      return vi.waitFor(
        () => {
          expect(
            request(container, "/api/health", undefined, "", "GET").status,
          ).toBe(200);
        },
        { timeout: 60000, interval: 250 },
      );
    }
    beforeAll(async () => {
      if (
        !/^[a-f0-9]{64}$/.test(dbId || "") ||
        !dbOwner?.startsWith("daryadarcy-fresh-backend-audit-")
      )
        throw new Error("Missing owned database descriptor");
      const fixture = inspect(dbId);
      const target = assertTestDatabase(testDatabaseUrl!);
      const bindings = fixture.NetworkSettings.Ports?.["3306/tcp"];
      if (
        fixture.Config.Labels?.["codex.owner"] !== dbOwner ||
        fixture.Name !== `/${dbOwner}` ||
        !fixture.HostConfig.Tmpfs?.["/var/lib/mysql"] ||
        fixture.Mounts.length !== 0 ||
        target.hostname !== "127.0.0.1" ||
        bindings?.length !== 1 ||
        bindings[0].HostIp !== "127.0.0.1" ||
        bindings[0].HostPort !== target.port
      )
        throw new Error("Unowned database refused");
      const metadata = JSON.parse(docker("image", "inspect", image))[0];
      expect(metadata.Config.User).toBe("node");
      expect(metadata.Os).toBe("linux");
      platform = `linux/${metadata.Architecture}`;
      conn = await mysql.createConnection({
        uri: testDatabaseUrl!,
        timezone: "Z",
      });
      const [history] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM __drizzle_migrations",
      );
      expect(history[0].n).toBe(51);
      const [existing] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM users",
      );
      if (existing[0].n !== 0)
        throw new Error(
          "Image acceptance requires an exclusive empty owned database",
        );
      ownsFixture = true;
      console.log("Owned schema verified; preparing fixture accounts");
      const encoded = await hashPassword(password);
      await conn.query(
        "INSERT INTO users(openId,email,passwordHash,role) VALUES ('image-admin','image-admin@example.test',?,'admin'),('image-member','image-member@example.test',?,'user'),('image-other','image-other@example.test',?,'user')",
        [encoded, encoded, encoded],
      );
      const [admins] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE openId='image-admin'",
      );
      adminId = admins[0].id;
      docker(
        "network",
        "create",
        "--internal",
        "--label",
        `codex.owner=${owner}`,
        "--label",
        `codex.parent=${dbOwner}`,
        network,
      );
      ownsNetwork = true;
      docker("network", "connect", "--alias", "mysql", network, dbId);
      attached = true;
      const db = new URL(testDatabaseUrl!);
      db.hostname = "mysql";
      db.port = "3306";
      Object.assign(env, {
        DATABASE_URL: db.toString(),
        JWT_SECRET: randomBytes(32).toString("hex"),
        AUTH_LINK_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
        PUBLIC_APP_URL: "https://fixture.example.test",
        API_COORDINATION_MODE: "mysql",
        API_REPLICA_COUNT: "2",
        ENABLE_SMS_LOGIN: "false",
        ENABLE_PEN_PALS: "true",
        PRIVATE_CONTENT_FILES_ENABLED: "false",
        PRIVATE_LIBRARY_FILES_ENABLED: "false",
        PRODAMUS_TEST_ENABLED: "false",
        YOOKASSA_TEST_ENABLED: "false",
        CONTENT_EDIT_REVISIONS_REQUIRED: "false",
        HOST: "0.0.0.0",
        PORT: "3000",
      });
      console.log("Starting first built API", platform);
      api = start("api-a");
      await ready(api);
      console.log("Starting second built API", platform);
      second = start("api-b");
      await ready(second);
      console.log("Both built APIs ready");
    }, 180000);
    beforeEach(async () => {
      await conn.query("DELETE FROM api_rate_limits");
      const admin = request(api, "/api/auth/login", {
        email: "image-admin@example.test",
        password,
      });
      expect(admin.status).toBe(200);
      adminCookie = admin.cookies.map((x) => x.split(";")[0]).join("; ");
      const member = request(second, "/api/auth/login", {
        email: "image-member@example.test",
        password,
      });
      expect(member.status).toBe(200);
      memberCookie = member.cookies.map((x) => x.split(";")[0]).join("; ");
    }, 30000);
    function start(hostname: string, overrides: Record<string, string> = {}) {
      const id = docker(
        "run",
        "--pull=never",
        "--platform",
        platform,
        "-d",
        "--label",
        `codex.owner=${owner}`,
        "--label",
        `codex.parent=${dbOwner}`,
        "--network",
        network,
        "--network-alias",
        hostname,
        "--hostname",
        hostname,
        "--memory=1536m",
        "--cpus=1",
        "--read-only",
        "--tmpfs=/tmp:rw,size=32m,mode=1777",
        "--tmpfs=/app/backups:rw,size=32m,uid=1000,gid=1000,mode=0700",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        ...Object.entries({ ...env, ...overrides }).flatMap(([k, v]) => [
          "-e",
          `${k}=${v}`,
        ]),
        image,
      );
      return id;
    }
    afterAll(async () => {
      if (ownsFixture)
        await conn.query("DROP DATABASE IF EXISTS backend_image_restore");
      await conn?.end();
      // Include a partial create whose ID wasn't returned after a daemon error.
      if (ownsNetwork) {
        const created = docker(
          "ps",
          "-a",
          "--filter",
          `label=codex.owner=${owner}`,
          "--format",
          "{{.ID}}",
        )
          .split(/\s+/)
          .filter(Boolean);
        for (const id of created) {
          if (inspect(id).Config.Labels?.["codex.owner"] !== owner)
            throw new Error("Unowned cleanup refused");
          docker("rm", "-f", id);
        }
        if (attached) docker("network", "disconnect", network, dbId);
        if (
          JSON.parse(docker("network", "inspect", network))[0].Labels?.[
            "codex.owner"
          ] !== owner
        )
          throw new Error("Unowned network cleanup refused");
        docker("network", "rm", network);
      }
    });
    type Card = {
      id: number;
      text: string;
      media: unknown[];
      commentCount: number;
      likeCount: number;
    };
    type OffsetPage = { posts: Card[]; nextCursor: number | null };
    type SavedPage = { items: Card[]; nextCursor: string | null };
    type CommentPage = {
      items: {
        id: number;
        parentId: number | null;
        replyCount: number;
        likeCount: number;
        likedByMe: boolean;
        text: string;
      }[];
      nextCursor: string | null;
      totalCount: number;
    };
    function readData<T>(
      procedure: string,
      input: unknown,
      cookie = adminCookie,
      container = api,
    ): T {
      const result = trpc(container, procedure, input, cookie, true);
      expect(result.response.status).toBe(200);
      return result.data as T;
    }
    function otherSession() {
      const login = request(second, "/api/auth/login", {
        email: "image-other@example.test",
        password,
      });
      expect(login.status).toBe(200);
      return login.cookies.map((x) => x.split(";")[0]).join("; ");
    }
    async function fixturePosts(
      run: (
        create: (input: Record<string, unknown>) => number,
      ) => Promise<void>,
    ) {
      const ids: number[] = [];
      const create = (input: Record<string, unknown>) => {
        const result = trpc(
          api,
          "admin.createPost",
          {
            text: "Image read fixture",
            photos: [],
            tags: ["community"],
            target: "feed",
            published: true,
            status: "published",
            ...input,
          },
          adminCookie,
        );
        expect(result.response.status).toBe(200);
        expect(result.data).toBeTypeOf("number");
        const id = result.data as number;
        ids.push(id);
        return id;
      };
      try {
        await run(create);
      } finally {
        for (const id of ids) {
          expect(
            trpc(api, "admin.deletePost", { id }, adminCookie).response.status,
          ).toBe(200);
          for (const table of [
            "posts",
            "likes",
            "saved_posts",
            "post_comments",
          ]) {
            const [rows] = await conn.query<RowDataPacket[]>(
              `SELECT COUNT(*) AS n FROM ${table} WHERE ${table === "posts" ? "id" : "postId"}=?`,
              [id],
            );
            expect(rows[0].n).toBe(0);
          }
        }
      }
    }
    async function withCommentRecovery(
      run: (a: string, b: string) => Promise<void>,
    ) {
      const temporary: string[] = [];
      // The regular pair is stopped only inside this owned test network, so
      // the active topology still has two API processes and no outside egress.
      docker("stop", api, second);
      try {
        const a = start("comment-a", { PRIVATE_CONTENT_FILES_ENABLED: "true" });
        temporary.push(a);
        await ready(a);
        const b = start("comment-b", { PRIVATE_CONTENT_FILES_ENABLED: "true" });
        temporary.push(b);
        await ready(b);
        await run(a, b);
      } finally {
        for (const id of temporary) docker("rm", "-f", id);
        docker("start", api, second);
        await ready(api);
        await ready(second);
      }
    }
    it("pages real feed/club cards without duplicates, drafts or private text leakage", async () => {
      await fixturePosts(async (create) => {
        const publicA = create({
          text: "Image public Alpha",
          tags: ["image-feed"],
          publishedAt: "2026-01-01T00:00:00Z",
        });
        const both = create({
          text: "Image public Beta",
          target: "both",
          tags: ["image-feed"],
          publishedAt: "2026-01-01T00:00:00Z",
        });
        create({
          text: "Image public hidden draft",
          published: false,
          status: "draft",
        });
        const old = create({
          text: "Image secret club old",
          target: "club",
          sortOrder: -100,
          publishedAt: "2026-01-02T00:00:00Z",
        });
        const recent = create({
          text: "Image secret club recent",
          target: "club",
          sortOrder: 100,
          publishedAt: "2026-01-03T00:00:00Z",
        });
        const first = readData<OffsetPage>(
          "feed.listPaginated",
          { limit: 1 },
          "",
        );
        const last = readData<OffsetPage>(
          "feed.listPaginated",
          { limit: 1, cursor: first.nextCursor },
          "",
          second,
        );
        expect(first.posts.map((x) => x.id)).toEqual([publicA]);
        expect(last.posts.map((x) => x.id)).toEqual([both]);
        expect(last.nextCursor).toBeNull();
        for (const card of [...first.posts, ...last.posts]) {
          expect(card.media).toEqual([]);
          expect(card.commentCount).toBe(0);
          expect(card.likeCount).toBe(0);
        }
        expect(
          readData<OffsetPage>(
            "feed.listPaginated",
            { limit: 12, search: "Beta", tag: "image-feed" },
            "",
          ).posts.map((x) => x.id),
        ).toEqual([both]);
        const pages: number[] = [];
        let cursor: number | null = null;
        for (let i = 0; i < 3; i++) {
          const page: OffsetPage = readData<OffsetPage>("club.list", {
            limit: 1,
            cursor,
          });
          pages.push(...page.posts.map((x) => x.id));
          cursor = page.nextCursor;
        }
        expect(pages).toEqual([recent, old, both]);
        expect(cursor).toBeNull();
        expect(
          readData<OffsetPage>("club.listByCategory", {
            category: "community",
            limit: 20,
          }).posts.map((x) => x.id),
        ).toEqual([recent, old]);
        expect(
          trpc(api, "club.list", { limit: 1 }, memberCookie, true).response
            .status,
        ).toBe(403);
        const denied = trpc(second, "feed.getById", { id: recent }, "", true);
        expect(denied.response.status).toBe(200);
        expect(denied.data).toBeUndefined();
        expect(denied.response.text).not.toContain("Image secret");
      });
    }, 60000);
    it("persists reactions, pages public saves and scopes saved cursors to the current account", async () => {
      await fixturePosts(async (create) => {
        const a = create({ text: "Image saved one" }),
          b = create({ text: "Image saved two" }),
          secret = create({ text: "Image saved private", target: "club" });
        for (const id of [a, b]) {
          const result = trpc(
            api,
            "feed.toggleSave",
            { postId: id },
            memberCookie,
          );
          expect(result.response.status).toBe(200);
          expect(result.data).toBe(true);
        }
        expect(
          trpc(api, "feed.toggleSave", { postId: secret }, memberCookie)
            .response.status,
        ).toBe(403);
        expect(
          trpc(second, "feed.toggleLike", { postId: a }, memberCookie).data,
        ).toBe(true);
        const marks = readData<{ likedIds: number[]; savedIds: number[] }>(
          "feed.interactionsForPosts",
          { postIds: [a, b, secret, a] },
          memberCookie,
        );
        expect(marks.likedIds).toEqual([a]);
        expect(marks.savedIds).toEqual([a, b]);
        const first = readData<SavedPage>(
          "feed.savedPostsPage",
          { target: "feed", limit: 1 },
          memberCookie,
        );
        expect(first.nextCursor).toBeTypeOf("string");
        const last = readData<SavedPage>(
          "feed.savedPostsPage",
          { target: "feed", limit: 1, cursor: first.nextCursor },
          memberCookie,
          second,
        );
        expect(
          new Set([...first.items, ...last.items].map((x) => x.id)),
        ).toEqual(new Set([a, b]));
        expect(last.nextCursor).toBeNull();
        const stranger = otherSession();
        expect(
          readData<SavedPage>(
            "feed.savedPostsPage",
            { target: "feed" },
            stranger,
          ).items,
        ).toEqual([]);
        expect(
          trpc(
            second,
            "feed.savedPostsPage",
            { target: "feed", cursor: first.nextCursor },
            stranger,
            true,
          ).response.status,
        ).toBe(400);
        const [stored] = await conn.query<RowDataPacket[]>(
          "SELECT (SELECT COUNT(*) FROM likes WHERE postId=?) AS likes,(SELECT COUNT(*) FROM saved_posts WHERE postId IN (?,?)) AS saves",
          [a, a, b],
        );
        expect(stored[0]).toEqual({ likes: 1, saves: 2 });
        expect(readData<Card>("feed.getById", { id: a }, "").likeCount).toBe(1);
        expect(
          trpc(api, "feed.toggleLike", { postId: a }, memberCookie).data,
        ).toBe(false);
        expect(
          trpc(second, "feed.toggleSave", { postId: a }, memberCookie).data,
        ).toBe(false);
        expect(
          readData<SavedPage>(
            "feed.savedPostsPage",
            { target: "feed" },
            memberCookie,
          ).items.map((x) => x.id),
        ).toEqual([b]);
        expect(readData<Card>("feed.getById", { id: a }, "").likeCount).toBe(0);
      });
    }, 60000);
    describe.each(["dismissCommentReport", "deleteReportedComment"] as const)(
      "in-flight moderation %s",
      (operation) => {
        it.each(["role", "epoch"] as const)(
          "rejects a %s change committed while the writer waits",
          async (change) => {
            await fixturePosts(async (create) => {
              const postId = create({ text: "Image moderation revocation" });
              const comment = trpc(
                api,
                "club.addComment",
                { postId, text: "Keep this comment" },
                memberCookie,
              );
              expect(comment.response.status).toBe(200);
              const commentId = (comment.data as { id: number }).id;
              const [users] = await conn.query<RowDataPacket[]>(
                "SELECT id FROM users WHERE openId='image-member'",
              );
              const userId = users[0].id;
              await conn.query(
                "INSERT INTO comment_reports(commentId,reporterUserId,reason) VALUES (?,?,'Image report')",
                [commentId, userId],
              );
              const [reports] = await conn.query<RowDataPacket[]>(
                "SELECT id FROM comment_reports WHERE commentId=?",
                [commentId],
              );
              const reportId = reports[0].id;
              const [auditBefore] = await conn.query<RowDataPacket[]>(
                "SELECT COUNT(*) AS n FROM admin_audit_log WHERE actorUserId=?",
                [userId],
              );
              await conn.query("UPDATE users SET role='moderator' WHERE id=?", [
                userId,
              ]);
              const control = await mysql.createConnection({
                uri: testDatabaseUrl!,
                timezone: "Z",
              });
              let pending: ReturnType<typeof pendingRequest> | undefined;
              try {
                await control.beginTransaction();
                await control.query(
                  "SELECT id FROM users WHERE id=? FOR UPDATE",
                  [userId],
                );
                pending = pendingRequest(
                  second,
                  "api-a",
                  "/api/trpc/moderation." + operation,
                  JSON.parse(
                    superjson.stringify(
                      operation === "dismissCommentReport"
                        ? { reportId }
                        : { commentId },
                    ),
                  ),
                  memberCookie,
                );
                await expect
                  .poll(
                    async () => {
                      const [waiting] = await conn.query<RowDataPacket[]>(
                        "SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits w JOIN performance_schema.threads blocker ON blocker.THREAD_ID=w.BLOCKING_THREAD_ID WHERE blocker.PROCESSLIST_ID=?",
                        [control.threadId],
                      );
                      return waiting[0].n;
                    },
                    { timeout: 7000, interval: 100 },
                  )
                  .toBeGreaterThan(0);
                if (change === "role")
                  await control.query(
                    "UPDATE users SET role='user' WHERE id=?",
                    [userId],
                  );
                else
                  await control.query(
                    "UPDATE users SET sessionVersion=sessionVersion+1 WHERE id=?",
                    [userId],
                  );
                await control.commit();
                expect((await pending.result).status).toBe(
                  change === "role" ? 403 : 401,
                );
                const [state] = await conn.query<RowDataPacket[]>(
                  "SELECT (SELECT COUNT(*) FROM post_comments WHERE id=?) AS comments,(SELECT COUNT(*) FROM comment_reports WHERE id=?) AS reports,(SELECT COUNT(*) FROM admin_audit_log WHERE actorUserId=?) AS audit",
                  [commentId, reportId, userId],
                );
                expect(state[0]).toEqual({
                  comments: 1,
                  reports: 1,
                  audit: auditBefore[0].n,
                });
              } finally {
                await control.rollback();
                await control.end();
                await pending?.result.catch(() => {});
                await conn.query("UPDATE users SET role='user' WHERE id=?", [
                  userId,
                ]);
              }
            });
          },
          45000,
        );
      },
    );
    async function withActorLock(
      userId: number,
      startRequest: () => ReturnType<typeof pendingRequest>,
      change: (control: Connection) => Promise<void>,
    ) {
      const control = await mysql.createConnection({
        uri: testDatabaseUrl!,
        timezone: "Z",
      });
      let pending: ReturnType<typeof pendingRequest> | undefined;
      try {
        await control.beginTransaction();
        await control.query("SELECT id FROM users WHERE id=? FOR UPDATE", [
          userId,
        ]);
        pending = startRequest();
        await expect
          .poll(
            async () => {
              const [waiting] = await conn.query<RowDataPacket[]>(
                "SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits w JOIN performance_schema.threads blocker ON blocker.THREAD_ID=w.BLOCKING_THREAD_ID WHERE blocker.PROCESSLIST_ID=?",
                [control.threadId],
              );
              return waiting[0].n;
            },
            { timeout: 7000, interval: 100 },
          )
          .toBeGreaterThan(0);
        await change(control);
        await control.commit();
        return await pending.result;
      } finally {
        await control.rollback();
        await control.end();
        await pending?.result.catch(() => {});
      }
    }
    it("ships the patched redirect and querystring production packages", () => {
      const versions = JSON.parse(
        docker(
          "exec",
          api,
          "node",
          "-e",
          `
        const path=require('node:path');
        const read=(name,parent)=>require(require.resolve(name+'/package.json',{paths:[path.dirname(require.resolve(parent+'/package.json'))]})).version;
        console.log(JSON.stringify({redirect:read('follow-redirects','axios'),querystring:read('qs','express')}));
      `,
        ),
      );
      expect(versions).toEqual({ redirect: "1.16.2", querystring: "6.16.1" });
    });
    it("refuses production startup with an undersized JWT key", async () => {
      const weak = start("api-weak-key", { JWT_SECRET: "x" });
      await expect
        .poll(() => inspect(weak).State.Running, {
          timeout: 10000,
          interval: 200,
        })
        .toBe(false);
      expect(inspect(weak).State.ExitCode).not.toBe(0);
      const logs = spawnSync("docker", ["logs", weak], { encoding: "utf8", timeout: 10000 });
      expect(logs.status).toBe(0);
      expect(logs.stdout + logs.stderr).toContain("JWT_SECRET");
    });
    it.each([
      { operation: "grant", change: "epoch", status: 401 },
      { operation: "grant", change: "role", status: 403 },
      { operation: "resend", change: "epoch", status: 401 },
      { operation: "resend", change: "deletion", status: 403 },
    ] as const)(
      "fences legacy $operation after actor $change changes in flight",
      async ({ operation, change, status }) => {
        const [rows] = await conn.query<RowDataPacket[]>(
          "SELECT id,openId FROM users WHERE openId IN ('image-member','image-other')",
        );
        const actorId = rows.find((row) => row.openId === "image-member")!.id;
        const targetId = rows.find((row) => row.openId === "image-other")!.id;
        await conn.query("UPDATE users SET role='admin' WHERE id=?", [actorId]);
        if (operation === "resend")
          await conn.query(
            "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES (?,'image-legacy-resend-check','paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
            [targetId],
          );
        const state = async () => {
          const [payments] = await conn.query(
            "SELECT * FROM club_payments WHERE userId=? ORDER BY id",
            [targetId],
          );
          const [outbox] = await conn.query(
            "SELECT * FROM access_email_outbox WHERE userId=? ORDER BY id",
            [targetId],
          );
          const [tokens] = await conn.query(
            "SELECT * FROM password_tokens WHERE userId=? ORDER BY id",
            [targetId],
          );
          const [audit] = await conn.query(
            "SELECT * FROM admin_audit_log WHERE actorUserId=? ORDER BY id",
            [actorId],
          );
          return { payments, outbox, tokens, audit };
        };
        try {
          const before = await state();
          const response = await withActorLock(
            actorId,
            () =>
              pendingRequest(
                second,
                "api-a",
                operation === "grant"
                  ? "/api/trpc/admin.grantClub"
                  : "/api/admin/access-email/resend",
                operation === "grant"
                  ? JSON.parse(superjson.stringify({ userId: targetId }))
                  : { userId: targetId },
                memberCookie,
              ),
            async (control) => {
              const update =
                change === "epoch"
                  ? "sessionVersion=sessionVersion+1"
                  : change === "role"
                    ? "role='user'"
                    : "accountDeletionRequestedAt=NOW()";
              await control.query(`UPDATE users SET ${update} WHERE id=?`, [
                actorId,
              ]);
            },
          );
          expect(response.status).toBe(status);
          expect(await state()).toEqual(before);
        } finally {
          await conn.query(
            "UPDATE users SET role='user',accountDeletionRequestedAt=NULL WHERE id=?",
            [actorId],
          );
          await conn.query("DELETE FROM access_email_outbox WHERE userId=?", [
            targetId,
          ]);
          await conn.query("DELETE FROM password_tokens WHERE userId=?", [
            targetId,
          ]);
          await conn.query("DELETE FROM club_payments WHERE userId=?", [
            targetId,
          ]);
          await conn.query("DELETE FROM admin_audit_log WHERE actorUserId=?", [
            actorId,
          ]);
        }
      },
    );
    it("keeps legacy grant and resend usable through the built HTTP API", async () => {
      const [targets] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE openId='image-other'",
      );
      const userId = targets[0].id;
      try {
        expect(
          trpc(api, "admin.grantClub", { userId }, adminCookie).response.status,
        ).toBe(200);
        const resend = request(
          second,
          "/api/admin/access-email/resend",
          { userId },
          adminCookie,
        );
        expect(resend.status).toBe(202);
        expect(JSON.parse(resend.text)).toEqual({ queued: true });
        const [counts] = await conn.query<RowDataPacket[]>(
          "SELECT (SELECT COUNT(*) FROM club_payments WHERE userId=?) AS grants, (SELECT COUNT(*) FROM access_email_outbox WHERE userId=?) AS mails",
          [userId, userId],
        );
        expect(counts[0]).toMatchObject({ grants: 1, mails: 1 });
      } finally {
        await conn.query("DELETE FROM access_email_outbox WHERE userId=?", [
          userId,
        ]);
        await conn.query("DELETE FROM password_tokens WHERE userId=?", [
          userId,
        ]);
        await conn.query("DELETE FROM club_payments WHERE userId=?", [userId]);
      }
    });
    it.each(["blockUser", "unblockUser"] as const)(
      "rejects revoked session during in-flight %s without target or audit changes",
      async (operation) => {
        const [rows] = await conn.query<RowDataPacket[]>(
          "SELECT id,openId FROM users WHERE openId IN ('image-member','image-other')",
        );
        const actorId = rows.find((row) => row.openId === "image-member")!.id;
        const targetId = rows.find((row) => row.openId === "image-other")!.id;
        await conn.query("UPDATE users SET role='moderator' WHERE id=?", [
          actorId,
        ]);
        if (operation === "unblockUser")
          await conn.query(
            "UPDATE users SET blockedAt=NOW(),blockedReason='Image retained block' WHERE id=?",
            [targetId],
          );
        async function state() {
          const [target] = await conn.query(
            "SELECT blockedAt,blockedReason,sessionVersion FROM users WHERE id=?",
            [targetId],
          );
          const [audit] = await conn.query(
            "SELECT id FROM admin_audit_log WHERE actorUserId=? ORDER BY id",
            [actorId],
          );
          return { target, audit };
        }
        try {
          const before = await state();
          const response = await withActorLock(
            actorId,
            () =>
              pendingRequest(
                second,
                "api-a",
                "/api/trpc/moderation." + operation,
                JSON.parse(
                  superjson.stringify({
                    userId: targetId,
                    ...(operation === "blockUser"
                      ? { reason: "Late block" }
                      : {}),
                  }),
                ),
                memberCookie,
              ),
            async (control) => {
              await control.query(
                "UPDATE users SET sessionVersion=sessionVersion+1 WHERE id=?",
                [actorId],
              );
            },
          );
          expect(response.status).toBe(401);
          expect(await state()).toEqual(before);
        } finally {
          await conn.query("UPDATE users SET role='user' WHERE id=?", [
            actorId,
          ]);
          await conn.query(
            "UPDATE users SET blockedAt=NULL,blockedReason=NULL WHERE id=?",
            [targetId],
          );
        }
      },
      45000,
    );
    it.each([
      ["create", "private"],
      ["edit", "draft"],
      ["delete", "private"],
      ["like", "subscription"],
      ["report", "private"],
      ["create", "closed"],
    ] as const)(
      "rechecks post access during in-flight comment %s after %s",
      async (operation, change) => {
        await fixturePosts(async (create) => {
          const postId = create({ text: "Image delayed comment access" });
          const root = trpc(
            api,
            "club.addComment",
            { postId, text: "Keep original text" },
            memberCookie,
          );
          expect(root.response.status).toBe(200);
          const commentId = (root.data as { id: number }).id;
          const [owners] = await conn.query<RowDataPacket[]>(
            "SELECT id FROM users WHERE openId='image-member'",
          );
          const userId = owners[0].id;
          const orderId = "image-access-race-" + postId;
          if (change === "subscription") {
            await conn.query("UPDATE posts SET target='club' WHERE id=?", [
              postId,
            ]);
            await conn.query(
              "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES (?,?,'paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
              [userId, orderId],
            );
          }
          async function state() {
            const [comments] = await conn.query(
              "SELECT id,text FROM post_comments WHERE postId=? ORDER BY id",
              [postId],
            );
            const [likes] = await conn.query(
              "SELECT id FROM comment_likes WHERE commentId=?",
              [commentId],
            );
            const [reports] = await conn.query(
              "SELECT id FROM comment_reports WHERE commentId=?",
              [commentId],
            );
            return { comments, likes, reports };
          }
          const commands = {
            create: {
              procedure: "club.addComment",
              input: { postId, text: "Delayed comment" },
            },
            edit: {
              procedure: "club.updateComment",
              input: { id: commentId, text: "Delayed edit" },
            },
            delete: {
              procedure: "club.deleteComment",
              input: { id: commentId },
            },
            like: { procedure: "club.toggleCommentLike", input: { commentId } },
            report: {
              procedure: "club.reportComment",
              input: { id: commentId, reason: "Delayed report" },
            },
          };
          const command = commands[operation];
          try {
            const before = await state();
            const response = await withActorLock(
              userId,
              () =>
                pendingRequest(
                  second,
                  "api-a",
                  "/api/trpc/" + command.procedure,
                  JSON.parse(superjson.stringify(command.input)),
                  memberCookie,
                ),
              async (control) => {
                if (change === "private")
                  await control.query(
                    "UPDATE posts SET target='club' WHERE id=?",
                    [postId],
                  );
                if (change === "draft")
                  await control.query(
                    "UPDATE posts SET published=FALSE,status='draft' WHERE id=?",
                    [postId],
                  );
                if (change === "subscription")
                  await control.query(
                    "UPDATE club_payments SET status='failed' WHERE orderId=?",
                    [orderId],
                  );
                if (change === "closed")
                  await control.query(
                    "UPDATE posts SET publishedAt=DATE_SUB(NOW(),INTERVAL 3 DAY) WHERE id=?",
                    [postId],
                  );
              },
            );
            expect(response.status).toBe(
              change === "draft" ? 404 : change === "closed" ? 400 : 403,
            );
            expect(await state()).toEqual(before);
          } finally {
            await conn.query("DELETE FROM club_payments WHERE orderId=?", [
              orderId,
            ]);
          }
        });
      },
      45000,
    );
    it("keeps threaded comment counts, ownership and SQL relations consistent", async () => {
      await fixturePosts(async (create) => {
        const postId = create({ text: "Image discussion" }),
          otherPost = create({ text: "Image other discussion" });
        const stranger = otherSession();
        function comment(text: string, cookie: string, parentId?: number) {
          const result = trpc(
            api,
            "club.addComment",
            { postId, text, parentId },
            cookie,
          );
          expect(result.response.status).toBe(200);
          return (result.data as { id: number }).id;
        }
        const root = comment("Image root", memberCookie),
          reply = comment("Image reply", stranger, root);
        const roots = readData<CommentPage>(
          "club.commentsPage",
          { postId, limit: 1 },
          memberCookie,
        );
        expect(roots.totalCount).toBe(2);
        expect(roots.items).toHaveLength(1);
        expect(roots.items[0]).toMatchObject({ id: root, replyCount: 1 });
        expect(
          readData<CommentPage>(
            "club.commentsPage",
            { postId, parentId: root },
            stranger,
          ).items.map((x) => x.id),
        ).toEqual([reply]);
        expect(
          trpc(
            second,
            "club.updateComment",
            { id: root, text: "foreign overwrite" },
            stranger,
          ).response.status,
        ).toBe(403);
        expect(
          trpc(second, "club.deleteComment", { id: root }, stranger).response
            .status,
        ).toBe(403);
        expect(
          trpc(
            second,
            "club.addComment",
            { postId: otherPost, parentId: root, text: "cross-post reply" },
            stranger,
          ).response.status,
        ).toBe(400);
        const [stored] = await conn.query<RowDataPacket[]>(
          "SELECT text FROM post_comments WHERE id=?",
          [root],
        );
        expect(stored[0].text).toBe("Image root");
        expect(
          trpc(second, "club.toggleCommentLike", { commentId: root }, stranger)
            .response.status,
        ).toBe(200);
        expect(
          readData<CommentPage>("club.commentsPage", { postId }, stranger)
            .items[0],
        ).toMatchObject({ likeCount: 1, likedByMe: true });
        expect(
          readData<OffsetPage>(
            "feed.listPaginated",
            { limit: 50 },
            "",
          ).posts.find((x) => x.id === postId)?.commentCount,
        ).toBe(2);
        expect(
          trpc(
            api,
            "club.updateComment",
            { id: root, text: "Image edited root" },
            memberCookie,
          ).response.status,
        ).toBe(200);
        const [edited] = await conn.query<RowDataPacket[]>(
          "SELECT text FROM post_comments WHERE id=?",
          [root],
        );
        expect(edited[0].text).toBe("Image edited root");
        expect(
          trpc(second, "club.deleteComment", { id: root }, memberCookie)
            .response.status,
        ).toBe(200);
        const after = readData<CommentPage>(
          "club.commentsPage",
          { postId },
          stranger,
        );
        expect(after.totalCount).toBe(1);
        expect(after.items[0]).toMatchObject({ id: reply, parentId: null });
        const [likes] = await conn.query<RowDataPacket[]>(
          "SELECT COUNT(*) AS n FROM comment_likes WHERE commentId=?",
          [root],
        );
        expect(likes[0].n).toBe(0);
        await conn.query(
          "UPDATE posts SET publishedAt=DATE_SUB(NOW(),INTERVAL 3 DAY) WHERE id=?",
          [postId],
        );
        expect(
          trpc(
            api,
            "club.addComment",
            { postId, text: "late comment" },
            memberCookie,
          ).response.status,
        ).toBe(400);
        expect(
          readData<CommentPage>("club.commentsPage", { postId }, stranger)
            .totalCount,
        ).toBe(1);
        expect(
          trpc(api, "club.deleteComment", { id: reply }, adminCookie).response
            .status,
        ).toBe(200);
        expect(
          readData<CommentPage>("club.commentsPage", { postId }, memberCookie)
            .totalCount,
        ).toBe(0);
      });
    }, 60000);
    it.each([
      { path: "/api/auth/login", raw: "{PRIVATE_PARSE_SENTINEL", status: 400 },
      {
        path: "/api/auth/login",
        raw: JSON.stringify({ payload: "x".repeat(17 * 1024) }),
        status: 413,
      },
      {
        path: "/api/trpc/feed.listPaginated",
        raw: JSON.stringify({ payload: "x".repeat(270 * 1024) }),
        status: 413,
      },
    ])(
      "bounds and sanitizes JSON at $path ($status)",
      ({ path, raw, status }) => {
        const response = request(api, path, undefined, "", "POST", { raw });
        expect(response.status).toBe(status);
        expect(response.text).not.toMatch(
          /PRIVATE_PARSE_SENTINEL|SyntaxError|stack|passwordHash/,
        );
        expect(response.headers["content-type"]).toContain("application/json");
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(request(api, "/api/health", undefined, "", "GET").status).toBe(
          200,
        );
      },
    );
    it.each([
      { headers: { Origin: "https://foreign.example.test" }, status: 403 },
      { headers: { "Sec-Fetch-Site": "cross-site" }, status: 403 },
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        status: 403,
      },
      { headers: { "Content-Encoding": "gzip" }, status: 415 },
    ])(
      "rejects unsafe HTTP metadata before mutation: $headers",
      ({ headers, status }) => {
        const response = request(
          api,
          "/api/auth/logout",
          {},
          adminCookie,
          "POST",
          { headers },
        );
        expect(response.status).toBe(status);
        expect(response.cookies).toEqual([]);
        expect(
          request(second, "/api/auth/me", undefined, adminCookie, "GET").status,
        ).toBe(200);
        expect(
          JSON.parse(
            request(second, "/api/auth/me", undefined, adminCookie, "GET").text,
          ).user.id,
        ).toBe(adminId);
        expect(response.headers["x-content-type-options"]).toBe("nosniff");
      },
    );
    it("accepts only the configured credentialed CORS preflight", () => {
      const response = request(
        api,
        "/api/auth/login",
        undefined,
        "",
        "OPTIONS",
        {
          headers: {
            Origin: env.PUBLIC_APP_URL,
            "Access-Control-Request-Method": "POST",
          },
        },
      );
      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(
        env.PUBLIC_APP_URL,
      );
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
      expect(response.headers["access-control-allow-headers"]).toContain(
        "Idempotency-Key",
      );
    });
    it.each([Array(21).fill("auth.me").join(","), "feed.list,feed.list"])(
      "rejects amplification before entering tRPC: %s",
      (names) => {
        const response = request(
          api,
          `/api/trpc/${names}?batch=1`,
          undefined,
          "",
          "GET",
        );
        expect(response.status).toBe(400);
        expect(JSON.parse(response.text)).toEqual({
          error: "Слишком много операций в запросе",
        });
      },
    );
    it.each([
      ["admin.stats", 401],
      ["feed.savedPosts", 401],
      ["doesNotExist", 404],
    ] as const)(
      "keeps guest access/unknown procedure errors explicit: %s",
      (procedure, status) => {
        const response = trpc(api, procedure, undefined, "", true).response;
        expect(response.status).toBe(status);
        expect(response.cookies).toEqual([]);
        expect(response.text).not.toMatch(
          /passwordHash|sessionVersion|stack|SELECT /,
        );
      },
    );
    it.each([
      { limit: 0 },
      { limit: 51 },
      { limit: 1.5 },
      { limit: 12, cursor: -1 },
    ])("rejects invalid pagination instead of coercing it: %j", (input) => {
      expect(
        trpc(api, "feed.listPaginated", input, "", true).response.status,
      ).toBe(400);
    });
    it.each([
      "club.uploadCommentPhoto",
      "admin.uploadMedia",
      "admin.uploadPrivateContentFile",
      "club.uploadPrivateCommentPhoto",
    ])(
      "keeps retired/disabled upload %s unreachable even for admin",
      (procedure) => {
        expect(
          request(api, `/api/trpc/${procedure}`, {}, adminCookie).status,
        ).toBe(404);
      },
    );
    it("keeps public profile fields consistent between REST and tRPC", () => {
      const rest = JSON.parse(
        request(api, "/api/auth/me", undefined, adminCookie, "GET").text,
      ).user;
      const rpc = trpc(second, "auth.me", undefined, adminCookie, true);
      expect(rpc.response.status).toBe(200);
      expect(rpc.data).toEqual(rest);
      for (const key of [
        "passwordHash",
        "sessionVersion",
        "blockedReason",
        "accountDeletionRequestedAt",
      ])
        expect(rest).not.toHaveProperty(key);
      expect(
        request(
          api,
          "/api/auth/me",
          undefined,
          `${COOKIE_NAME}=invalid-fixture`,
          "GET",
        ).text,
      ).toBe('{"user":null}');
    });
    it("rejects invalid profile values without changing the SQL row", async () => {
      const select =
        "SELECT name,profileRevision,avatarUrl FROM users WHERE openId='image-member'";
      const [before] = await conn.query<RowDataPacket[]>(select);
      for (const input of [
        { name: "   " },
        { avatarUrl: "javascript:fixture" },
        { expectedRevision: 1.5, name: "invalid revision" },
      ]) {
        const response = trpc(
          api,
          "profile.update",
          { expectedRevision: before[0].profileRevision, ...input },
          memberCookie,
        ).response;
        expect(response.status).toBe(400);
      }
      const [after] = await conn.query<RowDataPacket[]>(select);
      expect(after).toEqual(before);
    });
    it("returns server errors, not a guest, during a real disposable SQL fault and recovers with the same cookie", async () => {
      await conn.query("RENAME TABLE users TO image_fixture_users_unavailable");
      try {
        const rest = request(
          api,
          "/api/auth/me",
          undefined,
          adminCookie,
          "GET",
        );
        expect(rest.status).toBe(503);
        expect(rest.cookies).toEqual([]);
        expect(rest.text).not.toMatch(
          /user.*null|image_fixture|SELECT|stack|passwordHash/,
        );
        const rpc = trpc(
          second,
          "auth.me",
          undefined,
          adminCookie,
          true,
        ).response;
        expect(rpc.status).toBe(500);
        expect(rpc.cookies).toEqual([]);
        expect(rpc.text).not.toMatch(/image_fixture|SELECT|stack|passwordHash/);
      } finally {
        await conn.query(
          "RENAME TABLE image_fixture_users_unavailable TO users",
        );
      }
      const recovered = JSON.parse(
        request(second, "/api/auth/me", undefined, adminCookie, "GET").text,
      );
      expect(recovered.user.id).toBe(adminId);
    });
    it("executes the actual image as non-root with working Linux native media dependencies", () => {
      const result = JSON.parse(
        docker(
          "exec",
          api,
          "node",
          "-e",
          "const sharp=require('sharp');sharp({create:{width:4,height:3,channels:4,background:{r:1,g:2,b:3,alpha:0}}}).webp({lossless:true}).toBuffer({resolveWithObject:true}).then(x=>console.log(JSON.stringify({uid:process.getuid(),arch:process.arch,format:x.info.format,size:x.data.length})))",
        ),
      );
      expect(result).toMatchObject({ uid: 1000, format: "webp" });
      expect(result.size).toBeGreaterThan(0);
    });
    it("connects through shared coordination to the migrated schema", async () => {
      const [history] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM __drizzle_migrations",
      );
      expect(history[0].n).toBe(51);
      expect(
        JSON.parse(
          docker(
            "exec",
            api,
            "node",
            "-e",
            "fetch('http://127.0.0.1:3000/api/launch-config').then(async r=>console.log(JSON.stringify({status:r.status})))",
          ),
        ).status,
      ).toBe(200);
    });
    it("shares sessions across two production API containers and denies non-admin writes", () => {
      const profile = request(
        second,
        "/api/auth/me",
        undefined,
        adminCookie,
        "GET",
      );
      expect(profile.status).toBe(200);
      expect(JSON.parse(profile.text).user.role).toBe("admin");
      const denied = trpc(
        second,
        "admin.createPost",
        {
          text: "unauthorized",
          photos: [],
          tags: [],
          published: false,
          status: "draft",
        },
        memberCookie,
      );
      expect(denied.response.status).toBe(403);
    });
    it("registers once, queues access mail and completes password setup through the built API", async () => {
      const input = {
        email: "image-register@example.test",
        name: "Synthetic image user",
        consentVersion: "2026-09-1",
      };
      expect(request(api, "/api/auth/register", input).status).toBe(202);
      expect(request(second, "/api/auth/register", input).status).toBe(202);
      const [users] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE email=?",
        [input.email],
      );
      expect(users).toHaveLength(1);
      const [mail] = await conn.query<RowDataPacket[]>(
        "SELECT payload FROM access_email_outbox WHERE eventKey=?",
        [`registration:${users[0].id}`],
      );
      expect(mail).toHaveLength(1);
      const payload =
        typeof mail[0].payload === "string"
          ? JSON.parse(mail[0].payload)
          : mail[0].payload;
      const cipher = Buffer.from(payload.tokenCipher, "base64"),
        decipher = createDecipheriv(
          "aes-256-gcm",
          Buffer.from(env.AUTH_LINK_ENCRYPTION_KEY, "base64"),
          cipher.subarray(0, 12),
        );
      decipher.setAuthTag(cipher.subarray(-16));
      const token = Buffer.concat([
        decipher.update(cipher.subarray(12, -16)),
        decipher.final(),
      ]).toString("utf8");
      // Read only this test's encrypted outbox. No external letter is sent and
      // this is not a claim that delivery/SMTP has been accepted.
      expect(
        request(second, "/api/auth/password/complete", { token, password })
          .status,
      ).toBe(200);
      const login = request(api, "/api/auth/login", {
        email: input.email,
        password,
      });
      expect(login.status).toBe(200);
      expect(JSON.parse(login.text)).not.toHaveProperty("sessionToken");
      expect(login.cookies.join(";")).toContain("HttpOnly");
      expect(login.cookies.join(";")).toContain("Secure");
    });
    it("runs post creation replay, editing conflicts, publication and deletion through the image", async () => {
      const input = {
        text: "Image fixture draft",
        photos: [],
        tags: [],
        published: false,
        status: "draft",
        target: "club",
        idempotencyKey: "image-post-creation-intent-0001",
      };
      const first = trpc(api, "admin.createPost", input, adminCookie);
      expect(first.response.status).toBe(200);
      const replay = trpc(second, "admin.createPost", input, adminCookie);
      expect(replay.data).toEqual(first.data);
      const [ledger] = await conn.query<RowDataPacket[]>(
        "SELECT postId FROM post_creation_requests WHERE actorUserId=?",
        [adminId],
      );
      expect(ledger).toHaveLength(1);
      const id = ledger[0].postId;
      const detail = trpc(second, "admin.postDetail", { id }, adminCookie, true)
        .data as { editRevision: string };
      const changed = trpc(
        api,
        "admin.updatePost",
        {
          id,
          expectedRevision: detail.editRevision,
          text: "Image fixture published",
          published: true,
          status: "published",
        },
        adminCookie,
      );
      expect(changed.response.status).toBe(200);
      const stale = trpc(
        second,
        "admin.updatePost",
        { id, expectedRevision: detail.editRevision, text: "stale overwrite" },
        adminCookie,
      );
      expect(stale.response.status).toBe(409);
      const guest = trpc(second, "club.list", undefined, "", true);
      expect([401, 403]).toContain(guest.response.status);
      expect(guest.response.text).not.toContain("Image fixture published");
      expect(
        trpc(second, "admin.deletePost", { id }, adminCookie).response.status,
      ).toBe(200);
      const [remaining] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM posts WHERE id=?",
        [id],
      );
      expect(remaining).toEqual([]);
    });
    it("runs article creation replay, publication, conflict and removal through the image", async () => {
      const input = {
        title: "Image article fixture",
        sections: [{ type: "text", text: "Synthetic body" }],
        access: "club",
        published: false,
        idempotencyKey: "07100b92-4a9e-4d7c-9dca-9a2a3032465c",
      };
      const first = trpc(api, "admin.createArticle", input, adminCookie);
      expect(first.response.status).toBe(200);
      expect(
        trpc(second, "admin.createArticle", input, adminCookie).data,
      ).toEqual(first.data);
      const [ledger] = await conn.query<RowDataPacket[]>(
        "SELECT articleId FROM article_creation_requests WHERE actorUserId=?",
        [adminId],
      );
      expect(ledger).toHaveLength(1);
      const id = ledger[0].articleId;
      const detail = trpc(
        second,
        "admin.articleDetail",
        { id },
        adminCookie,
        true,
      ).data as { editRevision: string };
      expect(
        trpc(
          api,
          "admin.updateArticle",
          {
            id,
            expectedRevision: detail.editRevision,
            title: "Published image article",
            published: true,
          },
          adminCookie,
        ).response.status,
      ).toBe(200);
      expect(
        trpc(
          second,
          "admin.updateArticle",
          { id, expectedRevision: detail.editRevision, title: "stale article" },
          adminCookie,
        ).response.status,
      ).toBe(409);
      expect(
        trpc(second, "admin.deleteArticle", { id }, adminCookie).response
          .status,
      ).toBe(200);
      const [remaining] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM articles WHERE id=?",
        [id],
      );
      expect(remaining).toEqual([]);
    });
    it("revokes a session on one API and rejects its reuse on the other", () => {
      expect(request(api, "/api/auth/logout", {}, memberCookie).status).toBe(
        200,
      );
      const previous = request(
        second,
        "/api/auth/me",
        undefined,
        memberCookie,
        "GET",
      );
      expect(previous.status).toBe(200);
      expect(JSON.parse(previous.text)).toEqual({ user: null });
    });
    it("uses one shared login IP quota across the two containers", async () => {
      await conn.query("DELETE FROM api_rate_limits WHERE kind='rate'");
      const statuses = [];
      for (let i = 0; i < 22; i++)
        statuses.push(
          request(i % 2 ? api : second, "/api/auth/login", {}).status,
        );
      expect(statuses.slice(0, 20)).toEqual(Array(20).fill(400));
      expect(statuses.slice(20)).toEqual([429, 429]);
    }, 30000);

    it("grants and revokes club access from synthetic subscription state without a provider", async () => {
      const member = (
        await conn.query<RowDataPacket[]>(
          "SELECT id FROM users WHERE openId='image-member'",
        )
      )[0][0];
      expect(
        (
          trpc(second, "club.subscription", undefined, memberCookie, true)
            .data as { hasClubAccess: boolean }
        ).hasClubAccess,
      ).toBe(false);
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,email,status,expiresAt) VALUES (?,'image-synthetic-grant','image-member@example.test','paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [member.id],
      );
      expect(
        (
          trpc(api, "club.subscription", undefined, memberCookie, true)
            .data as { hasClubAccess: boolean }
        ).hasClubAccess,
      ).toBe(true);
      await conn.query(
        "UPDATE users SET blockedAt=NOW(),sessionVersion=sessionVersion+1 WHERE id=?",
        [member.id],
      );
      try {
        const response = trpc(
          second,
          "club.list",
          undefined,
          memberCookie,
          true,
        );
        expect([401, 403]).toContain(response.response.status);
      } finally {
        await conn.query("UPDATE users SET blockedAt=NULL WHERE id=?", [
          member.id,
        ]);
        await conn.query(
          "DELETE FROM club_payments WHERE orderId='image-synthetic-grant'",
        );
      }
    }, 30000);
    it("creates a usable compressed backup with the client shipped in the image and restores it separately", async () => {
      const list = () =>
        JSON.parse(
          docker(
            "exec",
            api,
            "node",
            "-e",
            "const fs=require('node:fs');console.log(JSON.stringify(fs.readdirSync('/app/backups').filter(x=>x.endsWith('.sql.gz'))))",
          ),
        ) as string[];
      await expect
        .poll(() => list().length, { timeout: 10000, interval: 250 })
        .toBeGreaterThan(0);
      const filename = list()[0];
      if (!/^daryadarcy-[A-Za-z0-9.-]+\.sql\.gz$/.test(filename))
        throw new Error("Unexpected owned backup name");
      await conn.query(
        "CREATE DATABASE backend_image_restore CHARACTER SET utf8mb4",
      );
      // Run the real mysql client from the final image. Its password file is
      // private, short-lived and excluded from argv; the production DB is unreachable.
      const script = `const fs=require('node:fs'),z=require('node:zlib'),cp=require('node:child_process');const u=new URL(process.env.DATABASE_URL);const p=fs.mkdtempSync('/tmp/image-restore-');const cfg=p+'/client.cnf';try{fs.writeFileSync(cfg,'[client]\\npassword='+JSON.stringify(decodeURIComponent(u.password))+'\\n',{mode:0o600});const result=cp.spawnSync('mysql',['--defaults-extra-file='+cfg,'-h'+u.hostname,'-P3306','-u'+decodeURIComponent(u.username),'backend_image_restore'],{input:z.gunzipSync(fs.readFileSync('/app/backups/'+${JSON.stringify(filename)})),stdio:['pipe','pipe','pipe']});console.log(JSON.stringify({exit:result.status}));}finally{fs.unlinkSync(cfg);fs.rmdirSync(p);}`;
      const restored = JSON.parse(docker("exec", api, "node", "-e", script));
      expect(restored.exit).toBe(0);
      const [history] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM backend_image_restore.__drizzle_migrations",
      );
      expect(history[0].n).toBe(51);
      const [user] = await conn.query<RowDataPacket[]>(
        "SELECT role FROM backend_image_restore.users WHERE openId='image-admin'",
      );
      expect(user).toEqual([{ role: "admin" }]);
    }, 30000);

    it("shares the account cooldown even when attempted logins use different source IPs", () => {
      const script = `Promise.all(Array.from({length:6},async(_,i)=>{const r=await fetch('http://api-'+(i%2?'a':'b')+':3000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'198.51.100.'+(i+1)},body:JSON.stringify({email:'image-member@example.test',password:'wrong-fixture-password'}),signal:AbortSignal.timeout(10000)});await r.text();return r.status;})).then(x=>console.log(JSON.stringify(x))).catch(()=>{process.exitCode=1})`;
      const statuses = JSON.parse(
        docker("exec", second, "node", "-e", script),
      ) as number[];
      expect(statuses.sort()).toEqual([401, 401, 401, 401, 401, 429]);
    }, 30000);
    it("drains an in-flight SQL mutation on SIGTERM while the second image stays available", async () => {
      const control = await mysql.createConnection({
        uri: testDatabaseUrl!,
        timezone: "Z",
      });
      let pending: ReturnType<typeof pendingRequest> | undefined;
      try {
        await control.beginTransaction();
        const [rows] = await control.query<RowDataPacket[]>(
          "SELECT id,profileRevision FROM users WHERE openId='image-member' FOR UPDATE",
        );
        pending = pendingRequest(
          second,
          "api-a",
          "/api/trpc/profile.update",
          JSON.parse(
            superjson.stringify({
              name: "Image graceful update",
              expectedRevision: rows[0].profileRevision,
            }),
          ),
          memberCookie,
        );
        let completed: HttpResult | undefined;
        void pending.result.then(
          (x) => {
            completed = x;
          },
          () => {},
        );
        await expect
          .poll(
            async () => {
              if (completed)
                throw new Error(
                  `SQL gate request completed before waiting: ${completed.status} ${completed.text.slice(0, 400)}`,
                );
              const [waiting] = await conn.query<RowDataPacket[]>(
                "SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits w JOIN performance_schema.threads blocker ON blocker.THREAD_ID=w.BLOCKING_THREAD_ID WHERE blocker.PROCESSLIST_ID=?",
                [control.threadId],
              );
              return waiting[0].n;
            },
            { timeout: 7000, interval: 100 },
          )
          .toBeGreaterThan(0);
        docker("kill", "--signal=TERM", api);
        expect(inspect(api).State.Running).toBe(true);
        expect(
          request(second, "/api/health", undefined, "", "GET").status,
        ).toBe(200);
        await control.commit();
        const response = await pending.result;
        expect(response.status).toBe(200);
        await expect
          .poll(() => inspect(api).State.Running, {
            timeout: 6000,
            interval: 100,
          })
          .toBe(false);
        expect(inspect(api).State.ExitCode).toBe(0);
        const [saved] = await conn.query<RowDataPacket[]>(
          "SELECT name FROM users WHERE id=?",
          [rows[0].id],
        );
        expect(saved[0].name).toBe("Image graceful update");
        docker("start", api);
        await ready(api);
      } finally {
        await control.rollback();
        await control.end();
        await pending?.result.catch(() => {});
      }
    }, 30000);
    // Container replacement discards /app/backups tmpfs. As with the drain
    // scenario above, run this lifecycle acceptance after backup/restore.
    it("recovers committed comment intents across replicas without duplicates or access bypass", async () => {
      await fixturePosts(async (create) => {
        const postId = create({ text: "Image recoverable discussion" });
        const privatePost = create({
          text: "Image recoverable club discussion",
          target: "club",
        });
        const input = {
          postId,
          text: "Image discarded comment response",
          idempotencyKey: "image-comment-recovery-intent-0001",
        };
        // Feature-off compatibility is retained; no local/working flag changes.
        expect(
          trpc(api, "club.addComment", input, memberCookie).response.status,
        ).toBe(404);
        const stranger = otherSession();
        const [member] = await conn.query<RowDataPacket[]>(
          "SELECT id FROM users WHERE openId='image-member'",
        );
        try {
          await withCommentRecovery(async (a, b) => {
            const discarded = request(
              a,
              "/api/trpc/club.addComment",
              JSON.parse(superjson.stringify(input)),
              memberCookie,
              "POST",
              { discardBody: true },
            );
            expect(discarded.status).toBe(200);
            expect(discarded.text).toBe("");
            const [stored] = await conn.query<RowDataPacket[]>(
              "SELECT id,userId FROM post_comments WHERE postId=? AND text=?",
              [postId, input.text],
            );
            expect(stored).toHaveLength(1);
            expect(stored[0].userId).toBe(member[0].id);
            const id = stored[0].id as number;
            const replay = trpc(b, "club.addComment", input, memberCookie);
            expect(replay.response.status).toBe(200);
            expect(replay.data).toEqual({ id });
            expect(
              trpc(
                b,
                "club.addComment",
                { ...input, text: "changed intent" },
                memberCookie,
              ).response.status,
            ).toBe(409);
            const other = trpc(
              b,
              "club.addComment",
              { ...input, text: "Image separate account intent" },
              stranger,
            );
            expect(other.response.status).toBe(200);
            const otherId = (other.data as { id: number }).id;
            expect(otherId).not.toBe(id);
            const [owners] = await conn.query<RowDataPacket[]>(
              "SELECT c.id,u.openId FROM post_comments c JOIN users u ON u.id=c.userId WHERE c.id IN (?,?) ORDER BY c.id",
              [id, otherId],
            );
            expect(owners).toEqual([
              { id, openId: "image-member" },
              { id: otherId, openId: "image-other" },
            ]);
            const parallel = {
              ...input,
              text: "Image simultaneous intent",
              idempotencyKey: "image-comment-concurrent-intent-0001",
            };
            const first = pendingRequest(
              a,
              "comment-a",
              "/api/trpc/club.addComment",
              JSON.parse(superjson.stringify(parallel)),
              memberCookie,
            );
            const secondRequest = pendingRequest(
              b,
              "comment-b",
              "/api/trpc/club.addComment",
              JSON.parse(superjson.stringify(parallel)),
              memberCookie,
            );
            const replies = await Promise.all([
              first.result,
              secondRequest.result,
            ]);
            for (const response of replies) expect(response.status).toBe(200);
            const results = replies.map((response) =>
              superjson.deserialize<{ id: number }>(
                JSON.parse(response.text).result.data,
              ),
            );
            expect(results[0]).toEqual(results[1]);
            const [parallelRows] = await conn.query<RowDataPacket[]>(
              "SELECT id FROM post_comments WHERE postId=? AND text=?",
              [postId, parallel.text],
            );
            expect(parallelRows).toEqual([{ id: results[0].id }]);
            const [ledger] = await conn.query<RowDataPacket[]>(
              "SELECT COUNT(*) AS n FROM comment_creation_requests WHERE commentId=? AND actorUserId=?",
              [results[0].id, member[0].id],
            );
            expect(ledger[0].n).toBe(1);
            expect(
              trpc(a, "club.deleteComment", { id }, adminCookie).response
                .status,
            ).toBe(200);
            expect(
              trpc(b, "club.addComment", input, memberCookie).response.status,
            ).toBe(409);
            await conn.query(
              "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES (?,'image-comment-grant','paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
              [member[0].id],
            );
            const clubInput = {
              ...input,
              postId: privatePost,
              text: "Image club recoverable comment",
              idempotencyKey: "image-comment-club-intent-0001",
            };
            expect(
              trpc(a, "club.addComment", clubInput, memberCookie).response
                .status,
            ).toBe(200);
            await conn.query(
              "DELETE FROM club_payments WHERE orderId='image-comment-grant'",
            );
            expect(
              trpc(b, "club.addComment", clubInput, memberCookie).response
                .status,
            ).toBe(403);
            expect(
              trpc(
                b,
                "club.addComment",
                {
                  ...clubInput,
                  idempotencyKey: "image-comment-club-denied-0001",
                },
                memberCookie,
              ).response.status,
            ).toBe(403);
            const [clubRows] = await conn.query<RowDataPacket[]>(
              "SELECT COUNT(*) AS n FROM post_comments WHERE postId=?",
              [privatePost],
            );
            expect(clubRows[0].n).toBe(1);
            await conn.query(
              "UPDATE users SET blockedAt=NOW(),sessionVersion=sessionVersion+1 WHERE id=?",
              [member[0].id],
            );
            expect(
              trpc(b, "club.addComment", parallel, memberCookie).response
                .status,
            ).toBe(401);
            await conn.query("UPDATE users SET blockedAt=NULL WHERE id=?", [
              member[0].id,
            ]);
            const login = request(a, "/api/auth/login", {
              email: "image-member@example.test",
              password,
            });
            expect(login.status).toBe(200);
            const restored = login.cookies
              .map((value) => value.split(";")[0])
              .join("; ");
            expect(trpc(b, "club.addComment", parallel, restored).data).toEqual(
              results[0],
            );
            const [count] = await conn.query<RowDataPacket[]>(
              "SELECT COUNT(*) AS n FROM post_comments WHERE postId=?",
              [postId],
            );
            expect(count[0].n).toBe(2);
          });
        } finally {
          await conn.query("UPDATE users SET blockedAt=NULL WHERE id=?", [
            member[0].id,
          ]);
          await conn.query(
            "DELETE FROM club_payments WHERE orderId='image-comment-grant'",
          );
        }
      });
    }, 180000);
    it("ranks Pen Pals candidates and shares shown cards across built replicas", () => {
      const otherCookie = otherSession();
      for (const [cookie, fullName, interests] of [
        [memberCookie, "Fixture member", ["Сад", "Книги"]],
        [otherCookie, "Fixture other", ["Сад", "Музыка"]],
        [adminCookie, "Fixture admin", ["Сад", "Книги"]],
      ] as const) {
        const saved = trpc(
          api,
          "penPals.upsert",
          {
            fullName,
            interests,
            address: "Private synthetic address",
            adultConsent: true,
          },
          cookie,
        );
        expect(saved.response.status).toBe(200);
      }

      const first = trpc(api, "penPals.find", undefined, memberCookie);
      expect(first.response.status).toBe(200);
      const data = first.data as {
        needsProfile: boolean;
        matches: {
          fullName: string;
          sharedInterests: string[];
          address?: string;
        }[];
      };
      expect(data.needsProfile).toBe(false);
      expect(
        data.matches.map(({ fullName, sharedInterests }) => ({
          fullName,
          sharedInterests,
        })),
      ).toEqual([
        { fullName: "Fixture admin", sharedInterests: ["Сад", "Книги"] },
        { fullName: "Fixture other", sharedInterests: ["Сад"] },
      ]);
      expect(data.matches.every((card) => card.address === undefined)).toBe(true);

      const repeated = trpc(second, "penPals.find", undefined, memberCookie);
      expect(repeated.response.status).toBe(200);
      expect(repeated.data).toEqual({ needsProfile: false, matches: [] });
    });
  },
);
