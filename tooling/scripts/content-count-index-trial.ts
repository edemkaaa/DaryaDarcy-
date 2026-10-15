// Opt-in causal A/B experiment: only the guarded, synthetic load fixture.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { inspectLoad, rows } from "./api-load-fixture";
import { getPostsForTarget } from "../../apps/backend/src/content/post-catalog-repository";

async function main() {
  const uri = process.env.COUNT_INDEX_DATABASE_URL;
  const id = process.env.COUNT_INDEX_CONTAINER_ID;
  if (!uri || !id || process.argv[2] !== "--owned-index-trial")
    throw new Error("Explicit owned fixture required");
  await inspectLoad(uri, id);
  const conn = await mysql.createConnection({ uri, timezone: "Z" });
  try {
    assert.equal(
      (
        await rows(
          conn,
          "SELECT COUNT(*) AS n FROM users WHERE openId LIKE 'load-user-%'",
        )
      )[0].n,
      60,
    );
    assert.equal(
      (await rows(conn, "SELECT COUNT(*) AS n FROM likes"))[0].n,
      1000,
    );
    assert.equal(
      (await rows(conn, "SELECT COUNT(*) AS n FROM post_comments"))[0].n,
      20000,
    );
    const db = drizzle(conn);
    const counters = async () =>
      Object.fromEntries(
        (await rows(conn, "SHOW SESSION STATUS LIKE 'Handler_read%'")).map(
          (r) => [r.Variable_name, Number(r.Value)],
        ),
      );
    let expectedHash: string | undefined;
    const phases: unknown[] = [];
    const definitions = [
      ["likes", "likes_post_lookup", "postId"],
      ["post_comments", "post_comments_post_created", "postId,createdAt"],
    ] as const;
    async function measure(phase: string) {
      const plans = await Promise.all(
        definitions.map(async ([table]) => ({
          table,
          plan: await rows(
            conn,
            `EXPLAIN SELECT COUNT(*) FROM ${table} WHERE postId=2`,
          ),
        })),
      );
      const before = await counters();
      const times: number[] = [];
      for (let i = 0; i < 30; i++) {
        const start = performance.now();
        const result = await getPostsForTarget(db, "club", { limit: 20 });
        times.push(performance.now() - start);
        const hash = createHash("sha256")
          .update(JSON.stringify(result))
          .digest("hex");
        expectedHash ??= hash;
        assert.equal(
          hash,
          expectedHash,
          "Index visibility must not change results",
        );
      }
      const after = await counters();
      times.sort((a, b) => a - b);
      const result = {
        phase,
        requests: 30,
        medianMs: times[14],
        p95Ms: times[28],
        resultHash: expectedHash,
        handlerDelta: Object.fromEntries(
          Object.keys(after).map((key) => [key, after[key] - before[key]]),
        ),
        plans,
      };
      phases.push(result);
      console.log(JSON.stringify(result));
    }
    await conn.query(
      "SET SESSION optimizer_switch='use_invisible_indexes=off'",
    );
    // Works on pre-0038 and current fresh fixtures; never drops an index.
    for (const [table, name, columns] of definitions) {
      const indexes = await rows(conn, `SHOW INDEX FROM ${table}`);
      if (!indexes.some((row) => row.Key_name === name))
        await conn.query(`CREATE INDEX ${name} ON ${table}(${columns})`);
    }
    try {
      for (const [table, name] of definitions)
        await conn.query(`ALTER TABLE ${table} ALTER INDEX ${name} INVISIBLE`);
      await measure("invisible-before");
      for (const [table, name] of definitions)
        await conn.query(`ALTER TABLE ${table} ALTER INDEX ${name} VISIBLE`);
      await measure("visible");
      for (const [table, name] of definitions)
        await conn.query(`ALTER TABLE ${table} ALTER INDEX ${name} INVISIBLE`);
      await measure("invisible-control");
    } finally {
      for (const [table, name] of definitions)
        await conn.query(`ALTER TABLE ${table} ALTER INDEX ${name} VISIBLE`);
    }
    await measure("visible-repeat");
    const output = join(
      await mkdtemp(join(tmpdir(), "daryadarcy-index-trial-")),
      "report.json",
    );
    await writeFile(
      output,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          fixture: {
            posts: 10000,
            comments: 20000,
            likes: 1000,
            syntheticUsers: 60,
          },
          phases,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    console.log(`INDEX_TRIAL_REPORT ${output}`);
  } finally {
    await conn.end();
  }
}
main().catch(() => {
  console.error("Owned index trial failed; inspect local fixture");
  process.exitCode = 1;
});
