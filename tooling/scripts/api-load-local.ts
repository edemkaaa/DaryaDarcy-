// Нагрузочный прогон запускается только с явным разрешением и собственной fixture. Результаты описывают этот стенд, а не ёмкость рабочего сервера.
/** Explicit opt-in. No production boot, env files, providers, frontend or S3. */
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir, cpus, totalmem, loadavg } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import mysql from "mysql2/promise";
import superjson from "superjson";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { sdk } from "../../apps/backend/src/_core/sdk";
import {
  inspectLoad,
  rows,
  seedLoad,
  startLoadApi,
  exec,
  root,
} from "./api-load-fixture";
import {
  runArrivalStage,
  summarizeLoad,
  type LoadSample,
} from "./api-load-policy";

function ensure(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}
const methods = [
  "feed.listPaginated",
  "club.list",
  "feed.getById",
  "club.comments",
  "articles.getById",
  "club.subscription",
  "auth.me",
  "feed.savedPosts",
  "feed.toggleLike",
  "feed.toggleSave",
];
const mix = [0, 1, 2, 3, 4, 0, 1, 2, 5, 6, 0, 1, 2, 3, 4, 0, 1, 7, 8, 9];
async function main() {
  const uri = process.env.LOAD_DATABASE_URL,
    id = process.env.LOAD_DATABASE_CONTAINER_ID;
  ensure(
    process.argv[2] === "--run-owned-local" &&
      process.argv.length === 3 &&
      process.env.NODE_ENV !== "production" &&
      uri &&
      id &&
      process.env.JWT_SECRET?.startsWith("load-fixture-"),
    "Explicit load fixture required",
  );
  for (const key of [
    "DATABASE_URL",
    "S3_ENDPOINT",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
    "SMTP_HOST",
    "PRODAMUS_SECRET_KEY",
  ])
    ensure(!process.env[key], "Inherited integration configuration refused");
  const fixture = await inspectLoad(uri, id);
  const conn = await mysql.createConnection({
    uri,
    timezone: "Z",
    connectTimeout: 10000,
  });
  let api: Awaited<ReturnType<typeof startLoadApi>> | undefined;
  const directory = await mkdtemp(join(tmpdir(), "daryadarcy-load-results-"));
  const report: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    fixture: { ...fixture, cpus: 2, memoryMiB: 1024 },
    host: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      totalMemoryMiB: Math.round(totalmem() / 1048576),
      loadavg: loadavg(),
    },
    dataset: {
      users: 60,
      paid: 50,
      posts: 10000,
      comments: 20000,
      articles: 50,
      tags: 20,
      saved: 1000,
    },
    poolLimit: 10,
    externalConnections: 0,
    productionAcceptance: false,
  };
  const phases: Record<string, unknown>[] = [],
    resources: Record<string, unknown>[] = [];
  let phase = "setup",
    fatal = "",
    globalIndex = 0,
    samplerBusy = false;
  let sampler: ReturnType<typeof setInterval> | undefined;
  const generatorLag = monitorEventLoopDelay({ resolution: 20 });
  generatorLag.enable();
  try {
    report.sha = (
      await exec("git", ["rev-parse", "HEAD"], { cwd: root })
    ).stdout.trim();
    report.mysql = (
      await rows(conn, "SELECT VERSION() AS version")
    )[0]?.version;
    const seed = await seedLoad(conn);
    console.log("LOAD fixture seeded: 60 users / 10000 posts / 20000 comments");
    const expected = {
      like: new Map<string, boolean>(),
      save: new Map(
        seed.saved.map(([actor, post]) => [`${actor}:${post}`, true]),
      ),
    };
    const tokens = await Promise.all(
      Array.from({ length: 60 }, (_, i) =>
        sdk.createSessionToken(`load-user-${i + 1}`, { sessionVersion: 0 }),
      ),
    );
    const commentCounts = new Map(
      (
        await rows(
          conn,
          "SELECT postId,COUNT(*) AS total FROM post_comments GROUP BY postId",
        )
      ).map((row) => [Number(row.postId), Number(row.total)]),
    );
    api = await startLoadApi(uri);
    const base = api.base;
    ensure(/^http:\/\/127\.0\.0\.1:\d+$/.test(base), "Invalid API loopback");
    const rpc = async (
      method: string,
      input: unknown,
      user: number,
      query = true,
    ) => {
      ensure(methods.includes(method), "Unexpected load endpoint");
      const encoded = superjson.stringify(input);
      const response = await fetch(
        `${base}/api/trpc/${method}${query ? `?input=${encodeURIComponent(encoded)}` : ""}`,
        {
          method: query ? "GET" : "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tokens[user - 1]}`,
          },
          ...(query ? {} : { body: encoded }),
          redirect: "error",
          signal: AbortSignal.timeout(5000),
        },
      );
      const text = await response.text(),
        wire = JSON.parse(text);
      return {
        status: response.status,
        bytes: Buffer.byteLength(text),
        data: wire.result
          ? superjson.deserialize<unknown>(wire.result.data)
          : null,
      };
    };
    const checkPosts = (
      value: unknown,
      target: "feed" | "club" | "saved",
      user: number,
    ) => {
      ensure(Array.isArray(value), "Post list shape");
      const ids = new Set<number>();
      for (const post of value) {
        ensure(
          Number.isInteger(post.id) &&
            !ids.has(post.id) &&
            post.published &&
            post.status === "published",
          "Hidden/duplicate post",
        );
        ids.add(post.id);
        ensure(
          post.text.startsWith(
            post.target === "club"
              ? `LOAD_CLUB_${post.id} `
              : `LOAD_PUBLIC_${post.id} `,
          ),
          "Post content mismatch",
        );
        if (target !== "saved")
          ensure(post.target === target, "Wrong target body");
        else
          ensure(
            post.id === 2 ||
              (post.id >= 1001 + (user - 1) * 20 && post.id < 1001 + user * 20),
            "Cross-account saved post",
          );
      }
    };
    const activePairs = new Set<string>(),
      timeoutTimes: number[] = [];
    const execute = async (
      method: string,
      lag: number,
    ): Promise<LoadSample> => {
      const index = globalIndex++,
        user = 1 + (Math.floor(index / 20) % 50);
      const started = performance.now();
      let pair = "",
        status = 0,
        bytes = 0;
      try {
        ensure(api!.alive(), "API process exited");
        let input: unknown = undefined;
        if (method === "feed.listPaginated")
          input =
            index % 3 === 0
              ? { limit: 12, cursor: 2400 }
              : {
                  limit: 12,
                  tag: "tag-1",
                  search:
                    index % 3 === 1 ? "LOAD_PUBLIC" : "MISSING_LOAD_PHRASE",
                };
        if (method === "club.list")
          input = { limit: 20, cursor: index % 2 ? 0 : 2400 };
        if (method === "feed.getById") input = { id: index % 2 ? 1 : 2 };
        if (method === "club.comments")
          input = { postId: Math.floor(index / 20) % 2 ? 101 : 2 };
        if (method === "articles.getById") input = { id: index % 2 ? 1 : 2 };
        const kind =
          method === "feed.toggleLike"
            ? "like"
            : method === "feed.toggleSave"
              ? "save"
              : null;
        if (kind) {
          input = { postId: 2 };
          pair = `${kind}:${user}:2`;
          ensure(!activePairs.has(pair), "Overlapping same-pair toggle");
          activePairs.add(pair);
        }
        const response = await rpc(method, input, user, !kind);
        status = response.status;
        bytes = response.bytes;
        ensure(status === 200, `HTTP_${status}`);
        const data = response.data as Record<string, unknown>;
        if (method === "feed.listPaginated" || method === "club.list") {
          checkPosts(
            data.posts,
            method === "club.list" ? "club" : "feed",
            user,
          );
          if (method === "feed.listPaginated" && index % 3 === 2)
            ensure(
              (data.posts as unknown[]).length === 0 &&
                data.nextCursor === null,
              "Missing search returned data",
            );
          else
            ensure(
              (data.posts as unknown[]).length ===
                (method === "club.list" ? 20 : 12),
              "Page size mismatch",
            );
          if (method === "feed.listPaginated" && index % 3 === 1)
            ensure(
              (data.posts as { tags: string[] }[]).every((post) =>
                post.tags.includes("tag-1"),
              ),
              "Tag filter mismatch",
            );
        }
        if (method === "feed.getById")
          checkPosts([data], index % 2 ? "feed" : "club", user);
        if (method === "club.comments") {
          ensure(Array.isArray(data), "Comment list shape");
          const postId = Math.floor(index / 20) % 2 ? 101 : 2;
          ensure(
            data.length === commentCounts.get(postId),
            "Comment count mismatch",
          );
          ensure(
            data.every(
              (row) =>
                row.postId === postId &&
                row.text.startsWith("Synthetic comment ") &&
                !row.likedByMe,
            ),
            "Wrong comment content",
          );
        }
        if (method === "articles.getById")
          ensure(
            data.id === (index % 2 ? 1 : 2) &&
              data.locked === false &&
              (data.sections as { text: string }[])[0]?.text ===
                `LOAD_ARTICLE_${data.id}`,
            "Article body mismatch",
          );
        if (method === "club.subscription")
          ensure(
            data.hasClubAccess === true &&
              data.subscribed === true &&
              data.isOwner === false,
            "Paid access mismatch",
          );
        if (method === "auth.me")
          ensure(
            data.id === user &&
              data.role === "user" &&
              !("passwordHash" in data),
            "Identity or sensitive output mismatch",
          );
        if (method === "feed.savedPosts") checkPosts(data, "saved", user);
        if (kind) {
          const key = `${user}:2`,
            wanted = !expected[kind].get(key);
          ensure(response.data === wanted, "Toggle result mismatch");
          expected[kind].set(key, wanted);
        }
        return {
          ms: performance.now() - started,
          lag,
          status,
          bytes,
          error: "",
        };
      } catch (error) {
        const category =
          error instanceof Error ? error.message : "Unknown failure";
        if (/Timeout|abort/i.test(category)) {
          timeoutTimes.push(Date.now());
          if (timeoutTimes.filter((at) => at > Date.now() - 30000).length >= 3)
            fatal = "Three timeouts in 30 seconds";
        } else fatal = category; // Includes payload errors, unknown mutation outcomes and API death.
        return {
          ms: performance.now() - started,
          lag,
          status,
          bytes,
          error: category.slice(0, 100),
        };
      } finally {
        if (pair) activePairs.delete(pair);
      }
    };
    async function accessChecks() {
      for (const user of [51, 60]) {
        ensure(
          (await rpc("club.list", { limit: 1 }, user)).status ===
            (user === 60 ? 401 : 403),
          "Unpaid/blocked access accepted",
        );
        const detail = await rpc("feed.getById", { id: 2 }, user);
        ensure(detail.data == null, "Closed body leaked");
        const article = await rpc("articles.getById", { id: 2 }, user);
        ensure(
          (article.data as { locked: boolean; sections: unknown[] }).locked ===
            true &&
            (article.data as { sections: unknown[] }).sections.length === 0,
          "Closed article leaked",
        );
      }
      await conn.query(
        "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE userId=50",
      );
      ensure(
        (await rpc("club.list", { limit: 1 }, 50)).status === 403,
        "Expired account accepted",
      );
      await conn.query(
        "UPDATE club_payments SET expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE userId=50",
      );
    }
    async function invariants() {
      for (const [table, total] of [
        ["users", 60],
        ["posts", 10000],
        ["post_comments", 20000],
        ["articles", 50],
        ["club_payments", 50],
        ["access_email_outbox", 0],
        ["private_content_files", 0],
        ["post_media", 0],
      ] as const)
        ensure(
          Number(
            (await rows(conn, `SELECT COUNT(*) AS total FROM ${table}`))[0]
              ?.total,
          ) === total,
          `SQL count mismatch: ${table}`,
        );
      for (const [kind, table] of [
        ["like", "likes"],
        ["save", "saved_posts"],
      ] as const) {
        const actual = await rows(
          conn,
          `SELECT userId,postId,COUNT(*) AS total FROM ${table} GROUP BY userId,postId`,
        );
        const wanted = new Set(
          [...expected[kind]].filter(([, value]) => value).map(([key]) => key),
        );
        ensure(
          actual.length === wanted.size &&
            actual.every(
              (row) =>
                row.total === 1 && wanted.has(`${row.userId}:${row.postId}`),
            ),
          `SQL reaction mismatch: ${kind}`,
        );
      }
      return {
        counts: "exact",
        reactionUniquenessAndParity: "exact",
        outbox: 0,
        media: 0,
      };
    }
    const statusNames = [
      "Threads_connected",
      "Threads_running",
      "Innodb_row_lock_current_waits",
      "Innodb_row_lock_waits",
      "Innodb_row_lock_time",
      "Innodb_deadlocks",
      "Slow_queries",
      "Questions",
    ];
    async function sample() {
      if (samplerBusy) return;
      samplerBusy = true;
      try {
        const data = await rows(
          conn,
          "SHOW GLOBAL STATUS WHERE Variable_name IN (?)",
          [statusNames],
        );
        const docker = await exec(
          "docker",
          ["stats", "--no-stream", "--format", "{{json .}}", id!],
          { timeout: 5000 },
        );
        const disk = await exec(
          "docker",
          ["exec", id!, "df", "-Pk", "/var/lib/mysql"],
          { timeout: 5000 },
        );
        const diskPercent = Number(
          disk.stdout
            .trim()
            .split("\n")
            .at(-1)
            ?.trim()
            .split(/\s+/)[4]
            ?.replace("%", ""),
        );
        if (diskPercent >= 95) fatal = "Owned tmpfs nearly full";
        resources.push({
          at: Date.now(),
          phase,
          sql: Object.fromEntries(
            data.map((row) => [row.Variable_name, Number(row.Value)]),
          ),
          docker: JSON.parse(docker.stdout),
          diskPercent,
          generatorEventLoopP99Ms: generatorLag.percentile(99) / 1e6,
        });
        generatorLag.reset();
      } catch {
        fatal = "Resource observer failed";
      } finally {
        samplerBusy = false;
      }
    }
    await accessChecks();
    report.preInvariants = await invariants();
    phase = "login";
    const login = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const started = performance.now();
        const response = await fetch(`${base}/api/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: `load-${i + 1}@example.test`,
            password: seed.password,
          }),
          signal: AbortSignal.timeout(5000),
          redirect: "error",
        });
        const text = await response.text(),
          data = JSON.parse(text);
        ensure(
          response.status === 200 &&
            data.user?.id === i + 1 &&
            !Object.hasOwn(data, "sessionToken") &&
            response.headers.get("set-cookie")?.includes("HttpOnly"),
          "Real login failed",
        );
        return {
          ms: performance.now() - started,
          lag: 0,
          status: response.status,
          bytes: Buffer.byteLength(text),
          error: "",
        };
      }),
    );
    report.login = summarizeLoad(login);
    console.log(
      `LOAD real logins: ${login.length}; p95=${summarizeLoad(login).p95}ms`,
    );
    await sample();
    sampler = setInterval(() => void sample(), 5000);
    // Warmup has its own samples and is excluded from steady-state percentiles.
    for (const method of methods)
      for (let i = 0; i < 3; i++)
        ensure(!(await execute(method, 0)).error, "Warmup failed");
    async function baseline(name: string) {
      phase = name;
      const grouped: Record<string, LoadSample[]> = {};
      for (const method of methods) {
        grouped[method] = [];
        for (let i = 0; i < 30 && !fatal; i++)
          grouped[method]!.push(await execute(method, 0));
      }
      const summary = Object.fromEntries(
        Object.entries(grouped).map(([method, samples]) => [
          method,
          summarizeLoad(samples),
        ]),
      );
      phases.push({ name, methods: summary });
      console.log(`LOAD ${name}: ${JSON.stringify(summary)}`);
      return summary;
    }
    const before = await baseline("baseline");
    for (const [rps, seconds] of [
      [5, 120],
      [10, 180],
      [25, 300],
    ] as const) {
      if (fatal) break;
      phase = `${rps}rps`;
      const grouped: Record<string, LoadSample[]> = {};
      const result = await runArrivalStage(
        rps,
        seconds,
        50,
        async (index, lag) => {
          const method = methods[mix[index % 20]!]!;
          const value = await execute(method, lag);
          (grouped[method] ??= []).push(value);
        },
        () => !!fatal,
      );
      const summary = Object.fromEntries(
        Object.entries(grouped).map(([method, samples]) => [
          method,
          summarizeLoad(samples),
        ]),
      );
      phases.push({
        name: phase,
        ...result,
        actualRps: result.started / (result.wallMs / 1000),
        methods: summary,
      });
      console.log(
        `LOAD ${phase}: ${JSON.stringify({ ...result, methods: summary })}`,
      );
    }
    if (!fatal) {
      phase = "recovery-idle";
      console.log("LOAD recovery: 60 seconds idle");
      await delay(60000);
    }
    const after = fatal ? {} : await baseline("recovery");
    await accessChecks();
    report.postInvariants = await invariants();
    const transactions = await rows(
      conn,
      "SELECT COUNT(*) AS total FROM information_schema.innodb_trx",
    );
    report.openTransactions = Number(transactions[0]?.total);
    report.digests = await rows(
      conn,
      "SELECT DIGEST_TEXT,COUNT_STAR,ROUND(SUM_TIMER_WAIT/1e9,2) AS totalMs,ROUND(AVG_TIMER_WAIT/1e9,2) AS avgMs,SUM_ROWS_EXAMINED,SUM_ROWS_SENT,SUM_ERRORS,SUM_LOCK_TIME/1e9 AS lockMs FROM performance_schema.events_statements_summary_by_digest WHERE SCHEMA_NAME='backend_test' AND DIGEST_TEXT LIKE 'SELECT%' ORDER BY SUM_TIMER_WAIT DESC LIMIT 12",
    );
    report.explain = {
      feed: await rows(
        conn,
        "EXPLAIN SELECT id,text FROM posts WHERE published=1 AND status='published' AND target IN ('feed','both') ORDER BY sortOrder,COALESCE(publishedAt,createdAt) DESC,id LIMIT 13 OFFSET 2400",
      ),
      search: await rows(
        conn,
        "EXPLAIN SELECT id FROM posts WHERE published=1 AND status='published' AND target IN ('feed','both') AND JSON_CONTAINS(tags,JSON_QUOTE('tag-1')) AND LOWER(text) LIKE '%load_public%' ORDER BY sortOrder,COALESCE(publishedAt,createdAt) DESC,id LIMIT 13",
      ),
      comments: await rows(
        conn,
        "EXPLAIN SELECT id,text FROM post_comments WHERE postId=2 ORDER BY createdAt",
      ),
    };
    const criteria: string[] = [];
    if (fatal) criteria.push(fatal);
    if (report.openTransactions !== 0)
      criteria.push("Open transactions after load");
    if ((report.login as ReturnType<typeof summarizeLoad>).p95! > 1500)
      criteria.push("Login p95");
    for (const entry of phases) {
      if (Number(entry.dropped ?? 0) || Number(entry.unstarted ?? 0))
        criteria.push(`${entry.name}:missed starts`);
      for (const [method, summary] of Object.entries(
        entry.methods as Record<string, ReturnType<typeof summarizeLoad>>,
      )) {
        const write = method.startsWith("feed.toggle");
        if (
          summary.errors ||
          !summary.count ||
          summary.p95! > (write ? 1000 : 500) ||
          summary.p99! > (write ? 2000 : 1500)
        )
          criteria.push(`${entry.name}:${method}:latency/errors`);
        if (
          entry.name === "recovery" &&
          summary.p95! >
            Math.max(before[method]!.p95! * 1.2, before[method]!.p95! + 50)
        )
          criteria.push(`${method}:recovery regression`);
      }
    }
    report.criteriaFailures = criteria;
    report.completed = !fatal && Object.keys(after).length === 10;
    report.pass = report.completed && criteria.length === 0;
    report.fatal = fatal || null;
  } catch (error) {
    report.pass = false;
    report.fatal = error instanceof Error ? error.message : "Load failed";
    process.exitCode = 1;
  } finally {
    if (sampler) clearInterval(sampler);
    while (samplerBusy) await delay(50);
    generatorLag.disable();
    report.phases = phases;
    report.resources = resources;
    report.apiMetrics = api?.metrics ?? [];
    report.apiErrorCodes = api?.errors ?? [];
    if (api?.metrics.some((row) => row.blocked > 0)) {
      report.pass = false;
      report.externalConnections = "blocked attempt";
    }
    await api?.close();
    await conn.end();
    report.finishedAt = new Date().toISOString();
    const path = join(directory, "report.json");
    await writeFile(path, JSON.stringify(report, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    console.log(`LOAD_REPORT ${path}`);
    console.log(
      `LOAD_RESULT ${JSON.stringify({ pass: report.pass, completed: report.completed, fatal: report.fatal, criteriaFailures: report.criteriaFailures })}`,
    );
    if (!report.pass) process.exitCode = 1;
  }
}
main().catch(() => {
  console.error("Load preflight refused; no target details printed");
  process.exitCode = 1;
});
