import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { replacePostVideoRows } from "../apps/backend/src/content/post-videos";

const first = "https://assets.example.test/first.webm";
const second = "https://assets.example.test/second.mov";
const added = "https://assets.example.test/new%20lesson.webm";
const query = vi.fn();
const database = drizzle({ query } as unknown as Pool);
let rows: unknown[][];

// Exercise the real helper and SQL builder, doubling only the SQL transport.
// Persisted state and rollback are checked separately against disposable MySQL.
/** Возвращает две исходные video-строки и подменяет только SQL-транспорт настоящего Drizzle query builder. */
beforeEach(() => {
  rows = [
    [51, first, 0],
    [52, second, 1],
  ];
  query.mockReset().mockImplementation(async ({ sql }: { sql: string }) => {
    if (sql.startsWith("select ")) return [rows, []];
    return [{ insertId: 100, affectedRows: 1 }, []];
  });
});
/** Отбирает записывающие SQL-команды и параметры, исключая SELECT из проверки изменений. */
function writes() {
  return query.mock.calls
    .map(([statement, params]) => ({ sql: statement.sql as string, params }))
    .filter(({ sql }) => !sql.startsWith("select "));
}
/** Проверяет точное ограничение чтения выбранным постом и типом video и устойчивый sortOrder/ID порядок. */
function selection() {
  const [statement, params] = query.mock.calls.find(([statement]) =>
    statement.sql.startsWith("select "),
  )!;
  expect(statement.sql).toContain("`post_media`.`postId` = ?");
  expect(statement.sql).toContain("`post_media`.`type` = ?");
  expect(params).toEqual([41, "video"]);
  expect(statement.sql).toContain(
    "order by `post_media`.`sortOrder` asc, `post_media`.`id` asc",
  );
}

/** Проверяет минимальное согласование video-строк без потери ID и метаданных существующих вложений. */
describe("post video reconciliation", () => {
  /** Проверяет сохранение разрешённого VK-постера вместе с новым video. */
  it("persists a resolved VK poster with a new video", async () => {
    rows = [];
    const vk = "https://vk.com/video_ext.php?oid=-1&id=2";
    const cover = "https://sun9.userapi.com/a.jpg?sign=keep";
    await replacePostVideoRows(database, 41, [vk], new Map([[vk, cover]]));
    expect(writes()).toHaveLength(1);
    expect(writes()[0].params).toContain(cover);
  });
  /** Проверяет заполнение только пустого постера без замены существующей ручной обложки. */
  it("fills a missing poster on edit without replacing an existing manual poster", async () => {
    rows = [[51, first, 0, null], [52, second, 1, "https://assets.example.test/manual.jpg"]];
    await replacePostVideoRows(database, 41, [first, second], new Map([
      [first, "https://sun9.userapi.com/a.jpg"], [second, "https://sun9.userapi.com/b.jpg"],
    ]));
    expect(writes()).toHaveLength(1);
    expect(writes()[0].params).toEqual(["https://sun9.userapi.com/a.jpg", 41, "video", 51]);
    expect(writes()[0].sql).toContain("set `posterUrl` = ?");
  });
  /** Проверяет отсутствие write-команд для неизменного списка и сохранность всех metadata-колонок. */
  it("does not rewrite unchanged rows, preserving IDs and every metadata column", async () => {
    await replacePostVideoRows(database, 41, [first, second]);
    expect(writes()).toEqual([]);
    selection();
  });
  /** Проверяет вставку только нового URL без удаления прежних видео. */
  it("adds only the new URL without deleting or rewriting existing videos", async () => {
    await replacePostVideoRows(database, 41, [first, second, added]);
    expect(writes()).toHaveLength(1);
    expect(writes()[0].sql).toMatch(/^insert into `post_media`/);
    expect(writes()[0].params).toEqual([
      41,
      "video",
      added,
      "new lesson.webm",
      null,
      2,
    ]);
  });
  /** Проверяет удаление только исключённых video-ID выбранного поста. */
  it("removes only excluded IDs, scoped to this post and the video type", async () => {
    await replacePostVideoRows(database, 41, [first]);
    expect(writes()).toHaveLength(1);
    expect(writes()[0].sql).toMatch(/^delete from `post_media`/);
    expect(writes()[0].sql).toContain("`post_media`.`postId` = ?");
    expect(writes()[0].sql).toContain("`post_media`.`type` = ?");
    expect(writes()[0].sql).toContain("`post_media`.`id` in (?)");
    expect(writes()[0].params).toEqual([41, "video", 52]);
  });
  /** Проверяет изменение только sortOrder при перестановке без замены ID и метаданных. */
  it("reorders by updating only sortOrder, never IDs or metadata", async () => {
    await replacePostVideoRows(database, 41, [second, first]);
    expect(writes()).toHaveLength(2);
    for (const write of writes()) {
      expect(write.sql).toContain(
        "update `post_media` set `sortOrder` = ? where",
      );
      expect(write.sql).toContain("`post_media`.`postId` = ?");
      expect(write.sql).toContain("`post_media`.`type` = ?");
      expect(write.sql).toContain("`post_media`.`id` = ?");
    }
    expect(writes().map(({ params }) => params)).toEqual([
      [0, 41, "video", 52],
      [1, 41, "video", 51],
    ]);
  });
  /** Проверяет очистку только выбранных существующих video-ID при пустом списке. */
  it("clears only the selected post's existing video IDs", async () => {
    await replacePostVideoRows(database, 41, []);
    expect(writes()).toHaveLength(1);
    expect(writes()[0].params).toEqual([41, "video", 51, 52]);
  });
  /** Проверяет отдельные вхождения повторного URL с сохранением соответствующих прежних ID. */
  it("keeps repeated URL occurrences separate and their matching IDs stable", async () => {
    rows = [
      [51, first, 0],
      [52, first, 1],
    ];
    await replacePostVideoRows(database, 41, [first, first]);
    expect(writes()).toEqual([]);
  });
  /** Проверяет удаление только лишнего вхождения повторного URL. */
  it("removes only the surplus occurrence of a repeated URL", async () => {
    rows = [
      [51, first, 0],
      [52, first, 1],
    ];
    await replacePostVideoRows(database, 41, [first]);
    expect(writes()).toHaveLength(1);
    expect(writes()[0].params).toEqual([41, "video", 52]);
  });
  /** Проверяет вставку повторного URL только после расходования всех совпавших прежних вхождений. */
  it("adds a repeated URL only when no unmatched existing occurrence remains", async () => {
    rows = [[51, first, 0]];
    await replacePostVideoRows(database, 41, [first, first]);
    expect(writes()).toHaveLength(1);
    expect(writes()[0].sql).toMatch(/^insert /);
    expect(writes()[0].params).toEqual([
      41,
      "video",
      first,
      "first.webm",
      null,
      1,
    ]);
  });
  /** Проверяет различие подписанных query-строк даже при одинаковом basename. */
  it("keeps signed query strings distinct, not just the basename", async () => {
    rows = [[51, first + "?key=one", 0]];
    await replacePostVideoRows(database, 41, [first + "?key=two"]);
    expect(writes()).toHaveLength(2);
    expect(writes()[0].params).toEqual([41, "video", 51]);
    expect(writes()[1].params).toEqual([
      41,
      "video",
      first + "?key=two",
      "first.webm",
      null,
      0,
    ]);
  });
  /** Проверяет trim и сохранение исходных индексов массива через пустые элементы. */
  it("trims input and keeps the original array indexes across blank entries", async () => {
    rows = [
      [51, first, 0],
      [52, second, 2],
    ];
    await replacePostVideoRows(database, 41, [` ${first} `, " ", second]);
    expect(writes()).toEqual([]);
  });
  /** Проверяет отсутствие write-команд для двух пустых множеств. */
  it("leaves an empty set without write queries", async () => {
    rows = [];
    await replacePostVideoRows(database, 41, []);
    expect(writes()).toEqual([]);
  });
  /** Проверяет отсутствие угадывания MIME только по расширению нового URL. */
  it.each(["mp4", "webm", "mov"])(
    "does not infer MIME from a new .%s URL",
    async (extension) => {
      rows = [];
      const url = `https://assets.example.test/new.${extension}`;
      await replacePostVideoRows(database, 41, [url]);
      expect(writes()).toHaveLength(1);
      expect(writes()[0].params).toEqual([
        41,
        "video",
        url,
        `new.${extension}`,
        null,
        0,
      ]);
    },
  );
  /** Проверяет сохранность прежнего URL с malformed encoded filename без новой обработки. */
  it("preserves an existing URL whose filename cannot be decoded", async () => {
    rows = [[51, "https://assets.example.test/%broken.mov", 0]];
    await replacePostVideoRows(database, 41, [
      "https://assets.example.test/%broken.mov",
    ]);
    expect(writes()).toEqual([]);
  });
  /** Проверяет отказ неполного SQL-чтения до любых video-мутаций. */
  it("fails on incomplete SQL reads before any video mutation", async () => {
    query.mockRejectedValueOnce(new Error("fixture read unavailable"));
    await expect(
      replacePostVideoRows(database, 41, [added]),
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ message: "fixture read unavailable" }),
    });
    expect(writes()).toEqual([]);
  });
});
