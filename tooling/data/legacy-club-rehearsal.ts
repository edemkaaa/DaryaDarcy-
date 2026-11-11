// Репетирует объединение клубного контента на собственной локальной fixture. Общий merge принимает уже проверенное соединение, а не произвольный production URL.
// Rehearsal entry points always inspect an owned local fixture. The shared merge
// accepts an already guarded connection; the separate staging operator owns its guard.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import mysql, {
  type Connection,
  type RowDataPacket,
  type ResultSetHeader,
} from "mysql2/promise";
import {
  prepareLegacyClubContent,
  type LegacyClubContent,
} from "./legacy-club-import";

export type RehearsalTarget = { uri: string; containerId: string };
type ContentTable = "posts" | "articles" | "post_media";
type DataRow = Record<string, unknown>;
type Fingerprint = Record<string, { rows: number; sha256: string }>;
export type LegacyClubPlan = {
  version: 1;
  sourceHash: string;
  targetUuid: string;
  schemaHash: string;
  baseline: Fingerprint;
  ids: Record<ContentTable, Record<number, number>>;
};
const tables: ContentTable[] = ["articles", "posts", "post_media"];
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
const hash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
function identifier(name: string) {
  assert(/^[A-Za-z_][A-Za-z0-9_]*$/.test(name), "Invalid SQL identifier");
  return `\`${name}\``;
}
async function rows(
  connection: Connection,
  sql: string,
  params: unknown[] = [],
) {
  return (await connection.query<RowDataPacket[]>(sql, params))[0];
}

/** Verify container identity, tmpfs and exact loopback port before opening SQL. */
async function connect(target: RehearsalTarget) {
  const url = new URL(target.uri);
  assert(
    process.env.NODE_ENV !== "production" &&
      url.protocol === "mysql:" &&
      url.hostname === "127.0.0.1" &&
      url.port &&
      url.pathname === "/backend_test" &&
      !url.search &&
      !url.hash &&
      /^[a-f0-9]{64}$/.test(target.containerId),
    "Owned disposable fixture required",
  );
  const { stdout } = await promisify(execFile)(
    "docker",
    [
      "inspect",
      target.containerId,
      "--format",
      '{"id":{{json .Id}},"name":{{json .Name}},"owner":{{json (index .Config.Labels "com.daryadarcy.task")}},"ports":{{json .NetworkSettings.Ports}},"tmpfs":{{json .HostConfig.Tmpfs}},"mounts":{{json .Mounts}}}',
    ],
    { timeout: 10000 },
  );
  const meta = JSON.parse(stdout);
  assert(
    meta.id === target.containerId &&
      /^legacy-club-rehearsal-[a-z0-9.-]+$/.test(meta.owner) &&
      meta.name === `/daryadarcy-${meta.owner.replace("-rehearsal", "")}` &&
      meta.tmpfs?.["/var/lib/mysql"] &&
      meta.mounts?.length === 0,
    "Owned disposable fixture required",
  );
  assert.deepEqual(
    meta.ports?.["3306/tcp"],
    [{ HostIp: "127.0.0.1", HostPort: url.port }],
    "Owned disposable fixture port required",
  );
  const connection = await mysql.createConnection({
    uri: target.uri,
    dateStrings: true,
    jsonStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    timezone: "Z",
  });
  try {
    await connection.query("SET SESSION time_zone='+00:00'");
    await connection.query("SET SESSION information_schema_stats_expiry=0");
    const [mode] = await rows(
      connection,
      "SELECT DATABASE() AS db,@@session.sql_mode AS modes",
    );
    assert(
      mode.db === "backend_test" &&
        /(?:^|,)STRICT_(TRANS|ALL)_TABLES(?:,|$)/.test(mode.modes),
      "Strict fixture required",
    );
    return connection;
  } catch (error) {
    await connection.end();
    throw error;
  }
}
async function snapshot(connection: Connection, lock = false) {
  const catalog = await rows(
    connection,
    "SELECT TABLE_NAME AS name,ENGINE AS engine,AUTO_INCREMENT AS nextId FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME",
  );
  assert(catalog.length > 0 && catalog.every((t) => t.engine === "InnoDB"));
  const columns = await rows(
    connection,
    "SELECT TABLE_NAME AS name,COLUMN_NAME AS col,COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS def,EXTRA AS extra,COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION",
  );
  const data: Record<string, DataRow[]> = {};
  let bytes = 0,
    count = 0;
  for (const table of catalog) {
    data[table.name] = await rows(
      connection,
      `SELECT * FROM ${identifier(table.name)} LIMIT 10001${lock ? " FOR UPDATE" : ""}`,
    );
    assert(
      data[table.name].length <= 10000,
      "Fixture exceeds rehearsal bounds",
    );
    count += data[table.name].length;
    bytes += Buffer.byteLength(JSON.stringify(data[table.name]));
    assert(
      count <= 20000 && bytes <= 32 * 1024 * 1024,
      "Fixture exceeds rehearsal bounds",
    );
  }
  assert(tables.every((t) => data[t]));
  const [identity] = await rows(connection, "SELECT @@server_uuid AS uuid");
  return {
    data,
    catalog,
    schemaHash: hash(columns),
    uuid: String(identity.uuid),
  };
}
function fingerprints(
  data: Record<string, DataRow[]>,
  exclude?: LegacyClubPlan["ids"],
): Fingerprint {
  return Object.fromEntries(
    Object.entries(data).map(([table, all]) => {
      const omitted = new Set(
        Object.values(exclude?.[table as ContentTable] ?? {}),
      );
      const encoded = all
        .filter((row) => !omitted.has(Number(row.id)))
        .map((row) =>
          JSON.stringify(
            Object.keys(row)
              .sort()
              .map((key) => [key, row[key]]),
          ),
        )
        .sort();
      return [table, { rows: encoded.length, sha256: hash(encoded) }];
    }),
  );
}
function mappedRows(
  source: LegacyClubContent,
  ids: LegacyClubPlan["ids"],
): Record<ContentTable, DataRow[]> {
  return {
    articles: source.articles.map((row) => ({
      ...row,
      id: ids.articles[row.id],
      sections: JSON.stringify(row.sections),
    })),
    posts: source.posts.map((row) => ({
      ...row,
      id: ids.posts[row.id],
      source: row.source.startsWith("article:")
        ? `article:${ids.articles[Number(row.source.slice(8))]}`
        : row.source,
      photos: JSON.stringify(row.photos),
      tags: JSON.stringify(row.tags),
      richText: row.richText === null ? null : JSON.stringify(row.richText),
    })),
    post_media: source.media.map((row) => ({
      ...row,
      id: ids.post_media[row.id],
      postId: ids.posts[row.postId],
      posterUrl: null,
    })),
  };
}
function sameValue(expected: unknown, actual: unknown, key: string) {
  if (
    ["photos", "tags", "richText", "sections"].includes(key) &&
    expected !== null &&
    actual !== null
  )
    return (
      hash(JSON.parse(String(expected))) === hash(JSON.parse(String(actual)))
    );
  return expected === actual;
}
function verifyImported(
  data: Record<string, DataRow[]>,
  expected: Record<ContentTable, DataRow[]>,
) {
  for (const table of tables)
    for (const row of expected[table]) {
      const actual = data[table].find((item) => Number(item.id) === row.id);
      assert(
        actual &&
          Object.keys(row).every((key) =>
            sameValue(row[key], actual[key], key),
          ),
        "Imported content differs; no overwrite allowed",
      );
    }
}
export async function planLegacyClubMerge(
  connection: Connection,
  input: LegacyClubContent,
): Promise<LegacyClubPlan> {
  const source = prepareLegacyClubContent(input);
  try {
    await connection.query(
      "START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY",
    );
    const state = await snapshot(connection);
    const ids = {} as LegacyClubPlan["ids"];
    const content = {
      posts: source.posts,
      articles: source.articles,
      post_media: source.media,
    };
    for (const table of tables) {
      const ref =
        table === "posts"
          ? "postId"
          : table === "articles"
            ? "articleId"
            : "mediaId";
      const refs = Object.values(state.data).flatMap((all) =>
        all.map((row) => Number(row[ref]) || 0),
      );
      const existing = state.data[table].map((row) => Number(row.id));
      if (table === "articles")
        refs.push(
          ...state.data.posts.map((row) =>
            /^article:\d+$/.test(String(row.source))
              ? Number(String(row.source).slice(8))
              : 0,
          ),
        );
      let next =
        Math.max(
          0,
          ...refs,
          ...existing,
          Number(state.catalog.find((t) => t.name === table)?.nextId || 1) - 1,
        ) + 1;
      ids[table] = Object.fromEntries(
        [...content[table]]
          .sort((a, b) => a.id - b.id)
          .map((row) => {
            assert(next <= 2147483647, "ID space exhausted");
            return [row.id, next++];
          }),
      );
    }
    await connection.rollback();
    return {
      version: 1,
      sourceHash: hash(source),
      targetUuid: state.uuid,
      schemaHash: state.schemaHash,
      baseline: fingerprints(state.data),
      ids,
    };
  } finally {
    await connection.rollback();
  }
}
/** Caller guards identity and supplies dateStrings/jsonStrings/bigNumberStrings,
 * supportBigNumbers and UTC; never pass an application's ordinary pool here. */
export async function applyLegacyClubMerge(
  connection: Connection,
  input: LegacyClubContent,
  plan: LegacyClubPlan,
) {
  const source = prepareLegacyClubContent(input);
  assert(
    plan.version === 1 && plan.sourceHash === hash(source),
    "Source differs from approved rehearsal plan",
  );
  const expected = mappedRows(source, plan.ids);
  for (const table of tables) {
    const values = expected[table].map((row) => row.id);
    assert(
      Object.keys(plan.ids[table]).length === values.length &&
        new Set(values).size === values.length &&
        values.every(
          (id) =>
            typeof id === "number" &&
            Number.isInteger(id) &&
            id > 0 &&
            id <= 2147483647,
        ),
      "Invalid ID map",
    );
  }
  let locked = false;
  try {
    const [lock] = await rows(
      connection,
      "SELECT GET_LOCK('legacy_club_rehearsal',10) AS acquired",
    );
    assert(Number(lock.acquired) === 1);
    locked = true;
    await connection.beginTransaction();
    const before = await snapshot(connection, true);
    assert(
      before.uuid === plan.targetUuid && before.schemaHash === plan.schemaHash,
      "Fixture identity/schema changed",
    );
    const present = tables.reduce(
      (count, table) =>
        count +
        expected[table].filter((row) =>
          before.data[table].some((item) => item.id === row.id),
        ).length,
      0,
    );
    const total = tables.reduce(
      (count, table) => count + expected[table].length,
      0,
    );
    const replayed = present === total;
    assert(
      present === 0 || replayed,
      "Partial/conflicting import; manual inspection required",
    );
    assert.deepEqual(
      fingerprints(before.data, replayed ? plan.ids : undefined),
      plan.baseline,
      "Existing data changed; re-plan required",
    );
    if (!replayed) {
      const telegram = new Set(
        before.data.posts
          .filter((row) => row.source === "telegram" && row.target !== "feed")
          .map((row) => row.instagramId),
      );
      assert(
        !source.posts.some(
          (row) => row.source === "telegram" && telegram.has(row.instagramId),
        ),
        "Telegram posts already exist; reuse original plan",
      );
      for (const table of tables)
        for (const row of expected[table]) {
          const columns = Object.keys(row);
          const params = columns.map((key) => {
            const value = row[key];
            assert(
              value === null ||
                typeof value === "string" ||
                typeof value === "number",
              "Invalid SQL value",
            );
            return value;
          });
          const [inserted] = await connection.execute<ResultSetHeader>(
            `INSERT INTO ${identifier(table)} (${columns.map(identifier).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
            params,
          );
          assert(
            inserted.affectedRows === 1 && inserted.warningStatus === 0,
            "Insert warning; rollback required",
          );
        }
    }
    const after = await snapshot(connection);
    verifyImported(after.data, expected);
    assert.deepEqual(
      fingerprints(after.data, plan.ids),
      plan.baseline,
      "Original rows changed",
    );
    await connection.commit();
    return {
      replayed,
      originalRowsUnchanged: true,
      posts: source.posts.length,
      articles: source.articles.length,
      media: source.media.length,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (locked)
      await connection.query("SELECT RELEASE_LOCK('legacy_club_rehearsal')");
  }
}

export async function planLegacyClubRehearsal(
  target: RehearsalTarget,
  input: LegacyClubContent,
) {
  const connection = await connect(target);
  try {
    return await planLegacyClubMerge(connection, input);
  } finally {
    await connection.end();
  }
}
export async function applyLegacyClubRehearsal(
  target: RehearsalTarget,
  input: LegacyClubContent,
  plan: LegacyClubPlan,
) {
  const connection = await connect(target);
  try {
    return await applyLegacyClubMerge(connection, input, plan);
  } finally {
    await connection.end();
  }
}

export async function rollbackLegacyClubMerge(
  connection: Connection,
  input: LegacyClubContent,
  plan: LegacyClubPlan,
): Promise<{ removed: number; originalRowsUnchanged: boolean }> {
  const source = prepareLegacyClubContent(input);
  assert(
    plan.version === 1 && plan.sourceHash === hash(source),
    "Source changed; rollback refused",
  );
  const expected = mappedRows(source, plan.ids);
  let locked = false;
  try {
    const [lock] = await rows(
      connection,
      "SELECT GET_LOCK('legacy_club_rehearsal',10) AS acquired",
    );
    assert(Number(lock.acquired) === 1);
    locked = true;
    await connection.beginTransaction();
    const before = await snapshot(connection, true);
    assert(
      before.uuid === plan.targetUuid && before.schemaHash === plan.schemaHash,
      "Fixture identity/schema changed",
    );
    verifyImported(before.data, expected);
    assert.deepEqual(
      fingerprints(before.data, plan.ids),
      plan.baseline,
      "Existing data changed; rollback refused",
    );
    let removed = 0;
    for (const table of [...tables].reverse())
      for (const row of expected[table]) {
        const [result] = await connection.execute<ResultSetHeader>(
          `DELETE FROM ${identifier(table)} WHERE id=?`,
          [row.id as number],
        );
        assert(result.affectedRows === 1 && result.warningStatus === 0);
        removed++;
      }
    const after = await snapshot(connection);
    assert.deepEqual(
      fingerprints(after.data),
      plan.baseline,
      "Original rows changed",
    );
    await connection.commit();
    return { removed, originalRowsUnchanged: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (locked)
      await connection.query("SELECT RELEASE_LOCK('legacy_club_rehearsal')");
  }
}
