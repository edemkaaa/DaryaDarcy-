import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { assertLoadFixture, type LoadFixture } from "./api-load-policy";
import { hashPassword } from "../../apps/backend/src/_core/password";

export const exec = promisify(execFile);
export const root = fileURLToPath(new URL("../../", import.meta.url));
export async function inspectLoad(uri: string, id: string) {
  const { stdout } = await exec(
    "docker",
    [
      "inspect",
      id,
      "--format",
      '{"id":{{json .Id}},"name":{{json .Name}},"owner":{{json (index .Config.Labels "codex.owner")}},"ports":{{json .NetworkSettings.Ports}},"tmpfs":{{json .HostConfig.Tmpfs}},"mounts":{{json .Mounts}}}',
    ],
    { timeout: 10000 },
  );
  const metadata = JSON.parse(stdout) as LoadFixture;
  assertLoadFixture(uri, id, metadata);
  return metadata;
}
export const rows = async (
  conn: Connection,
  query: string,
  values: unknown[] = [],
) => (await conn.query<RowDataPacket[]>(query, values))[0];

export async function seedLoad(conn: Connection) {
  if (
    (await rows(conn, "SELECT id FROM users")).length ||
    (await rows(conn, "SELECT id FROM __drizzle_migrations")).length !== 39
  )
    throw new Error("Empty migrated fixture required");
  const password = "local-load-fixture-password",
    passwordHash = await hashPassword(password);
  for (let id = 1; id <= 60; id++) {
    await conn.query(
      "INSERT INTO users(id,openId,email,name,passwordHash,blockedAt) VALUES(?,?,?,?,?,?)",
      [
        id,
        `load-user-${id}`,
        `load-${id}@example.test`,
        `Synthetic ${id}`,
        passwordHash,
        id === 60 ? new Date() : null,
      ],
    );
    if (id <= 50)
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,status,sum,paidAt,expiresAt) VALUES(?,?,'paid','790',NOW(),DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [id, `load-paid-${id}`],
      );
  }
  const insert = async (table: string, columns: string, data: unknown[][]) => {
    for (let offset = 0; offset < data.length; offset += 500)
      await conn.query(`INSERT INTO ${table}(${columns}) VALUES ?`, [
        data.slice(offset, offset + 500),
      ]);
  };
  await insert(
    "tags",
    "slug,label",
    Array.from({ length: 20 }, (_, i) => [`tag-${i}`, `Synthetic tag ${i}`]),
  );
  await insert(
    "posts",
    "id,text,photos,tags,published,status,target,sortOrder,publishedAt",
    Array.from({ length: 10000 }, (_, i) => {
      const id = i + 1,
        draft = id % 10 === 0,
        club = id % 2 === 0;
      return [
        id,
        `${club ? "LOAD_CLUB" : "LOAD_PUBLIC"}_${id} ${"Тестовая запись без файлов. ".repeat(20)}`,
        "[]",
        JSON.stringify([`tag-${id % 20}`]),
        !draft,
        draft ? "draft" : "published",
        club ? "club" : "feed",
        id,
        new Date("2026-10-15T00:00:00Z"),
      ];
    }),
  );
  await insert(
    "post_comments",
    "id,postId,userId,text,photos",
    Array.from({ length: 20000 }, (_, i) => [
      i + 1,
      i < 500 ? 2 : 101 + (i % 9800),
      1 + (i % 50),
      `Synthetic comment ${i} ${"Комментарий. ".repeat(8)}`,
      "[]",
    ]),
  );
  await insert(
    "articles",
    "id,title,access,published,sections",
    Array.from({ length: 50 }, (_, i) => [
      i + 1,
      `Synthetic article ${i + 1}`,
      i % 2 ? "club" : "public",
      true,
      JSON.stringify([
        { type: "text", text: `LOAD_ARTICLE_${i + 1}`, url: "", urls: [] },
      ]),
    ]),
  );
  const saved = Array.from({ length: 1000 }, (_, i) => [
    1 + Math.floor(i / 20),
    1001 + i,
  ]);
  await insert("saved_posts", "userId,postId", saved);
  return { password, saved };
}

export async function startLoadApi(uri: string) {
  const directory = await mkdtemp(join(tmpdir(), "daryadarcy-load-api-"));
  await symlink(join(root, "node_modules"), join(directory, "node_modules"));
  // Instrument only this child. All real application TCP may reach its own SQL port;
  // no endpoint/credentials or behavior is replaced with a successful fake.
  const source = `
    import net from 'node:net'; import {monitorEventLoopDelay} from 'node:perf_hooks';
    const connect=net.Socket.prototype.connect; let blocked=0;
    net.Socket.prototype.connect=function(...args) {
      const raw=Array.isArray(args[0])?args[0]:args;
      const options=typeof raw[0]==='object'?raw[0]:{port:raw[0],host:raw[1]};
      if(options.host!=='127.0.0.1'||Number(options.port)!==${Number(new URL(uri).port)}) {
        blocked++; throw new Error('External connection refused by load harness');
      }
      return Reflect.apply(connect,this,args);
    };
    const {createBackendApplication}=await import(${JSON.stringify(join(root, "apps/backend/src/_core/application.ts"))});
    const {getDb}=await import(${JSON.stringify(join(root, "apps/backend/src/db.ts"))});
    const histogram=monitorEventLoopDelay({resolution:20}); histogram.enable();
    let last=process.cpuUsage(); let previous=performance.now();
    const timer=setInterval(()=>{const current=performance.now(),cpu=process.cpuUsage();
      process.stdout.write(JSON.stringify({event:'metric',rss:process.memoryUsage().rss,
        cpuPercent:100*(cpu.user-last.user+cpu.system-last.system)/1000/(current-previous),
        eventLoopP99Ms:histogram.percentile(99)/1e6,blocked})+'\\n');
      histogram.reset();last=cpu;previous=current;},2000);timer.unref();
    const app=await createBackendApplication();await app.listen(0,'127.0.0.1');
    process.stdout.write(JSON.stringify({event:'ready',port:app.getHttpServer().address().port})+'\\n');
    process.stdin.once('data',async()=>{clearInterval(timer);histogram.disable();await app.close();
      await (await getDb())?.$client.end();process.exit(0);});
  `;
  try {
    await build({
      stdin: { contents: source, resolveDir: root, loader: "ts" },
      outfile: join(directory, "api.mjs"),
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
      logLevel: "silent",
    });
    const child = spawn(process.execPath, [join(directory, "api.mjs")], {
      cwd: directory,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test",
        JWT_SECRET: process.env.JWT_SECRET!,
        DATABASE_URL: uri,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const metrics: Record<string, number>[] = [],
      errors: string[] = [];
    let buffer = "",
      alive = true;
    child.once("exit", () => {
      alive = false;
    });
    child.stderr.on("data", (chunk) => {
      // Only categorical SQL/RPC failures, never arbitrary exception text or payloads.
      for (const match of String(chunk).matchAll(
        /\[trpc\] ([a-zA-Z0-9._-]+): ([A-Z_]+)/g,
      ))
        errors.push(`${match[1]}:${match[2]}`);
    });
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error("Load API startup failed"));
      }, 15000);
      child.once("error", () => {
        clearTimeout(timer);
        reject(new Error("Load API spawn failed"));
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Load API startup exit ${code}`));
      });
      child.stdout.on("data", (chunk) => {
        buffer += String(chunk);
        for (;;) {
          const at = buffer.indexOf("\n");
          if (at < 0) break;
          const line = buffer.slice(0, at);
          buffer = buffer.slice(at + 1);
          try {
            const event = JSON.parse(line);
            if (event.event === "metric")
              metrics.push({ ...event, event: undefined, at: Date.now() });
            if (
              event.event === "ready" &&
              Number.isInteger(event.port) &&
              event.port > 0 &&
              event.port < 65536
            ) {
              clearTimeout(timer);
              resolve(event.port);
            }
          } catch {
            /* Other startup output is not telemetry. */
          }
        }
      });
    });
    return {
      base: `http://127.0.0.1:${port}`,
      pid: child.pid!,
      metrics,
      errors,
      alive: () => alive,
      async close() {
        if (alive)
          await new Promise<void>((resolve) => {
            const timer = setTimeout(() => child.kill("SIGTERM"), 5000);
            child.once("exit", () => {
              clearTimeout(timer);
              resolve();
            });
            child.stdin.write("stop");
          });
        await rm(directory, { recursive: true });
      },
    };
  } catch (error) {
    await rm(directory, { recursive: true });
    throw error;
  }
}
