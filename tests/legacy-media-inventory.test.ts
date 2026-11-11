import { afterEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

const execute = promisify(execFile);
const directories: string[] = [];
/** Удаляет только временные каталоги, созданные текущим набором проверок CLI. */
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
const url = "https://s3.twcstorage.ru/daryadarcy-s3/feed/photos/fixture.jpg";
/** Создаёт минимальную ссылку из конкретного слота публикации с явно заданной видимостью. */
function ref(id: number, access = "restricted", asset = url) {
  return { kind: "postPhoto", id, slot: "photos.0", access, url: asset };
}
/** Запускает CLI на локальном снимке в собственном каталоге и возвращает результат вместе с путями для проверки неизменности. */
async function run(
  references: unknown[],
  extra: string[] = [],
  existing = false,
) {
  const directory = await mkdtemp(join(tmpdir(), "daryadarcy-media-map-"));
  directories.push(directory);
  const input = join(directory, "input.json"),
    output = join(directory, "report.json");
  const snapshot = { version: 1, coverage: ["posts.photos"], references };
  await writeFile(input, JSON.stringify(snapshot));
  if (existing) await writeFile(output, "preserve");
  let code = 0,
    stdout = "",
    stderr = "";
  try {
    ({ stdout, stderr } = await execute(process.execPath, [
      "--import",
      "tsx",
      "tooling/data/legacy-media-inventory.ts",
      "--input",
      input,
      "--output",
      output,
      ...extra,
    ]));
  } catch (error) {
    const result = error as { code: number; stdout: string; stderr: string };
    ({ code, stdout, stderr } = result);
  }
  return { input, output, snapshot, code, stdout, stderr };
}
/** Проверяет режим инвентаризации старых медиа, который составляет отчёт и не разрешает изменение оригиналов. */
describe("read-only legacy media inventory", () => {
  /** Проверяет план копирования: общий публичный источник сохраняется, а отсутствие контрольных сумм запрещает закрытие оригиналов. */
  it("prepares an explicit plan without source checksums or permission to retire originals", async () => {
    const result = await run(
      [
        ref(938),
        {
          kind: "publicReference",
          id: 5,
          slot: "article.cover",
          access: "public",
          url,
        },
        ref(1, "public", url + "-public"),
        ref(2, "restricted", url + "?signature=hidden"),
        ref(
          3,
          "restricted",
          "/api/media/content-files/00000000-0000-4000-8000-000000000000",
        ),
      ],
      ["--plan"],
    );
    expect(result.code, result.stderr).toBe(0);
    const plan = JSON.parse(await readFile(result.output, "utf8"));
    expect(plan.operations).toHaveLength(1);
    expect(plan.operations[0]).toMatchObject({
      subject: { kind: "postPhoto", id: 938, slot: "photos.0" },
      expectedOldUrl: url,
      expectedSourceSha256: null,
      preserveOriginal: true,
      sharedPublic: true,
      ready: false,
    });
    expect(plan.blocked).toHaveLength(1);
    expect(plan.alreadyProtected).toHaveLength(1);
    expect(JSON.stringify(plan)).not.toContain("signature");
    expect(plan.retirementAllowed).toBe(false);
  });
  /** Проверяет классификацию общих, закрытых и неопубликованных ссылок без выдачи разрешения на удаление. */
  it("maps restricted, shared, unpublished and orphan references without granting deletion", async () => {
    const result = await run([
      ref(938),
      ref(1, "public"),
      ref(2, "restricted", url + "2"),
      ref(3, "unpublished", url + "3"),
      ref(4, "unknown", url + "4"),
    ]);
    expect(result.code, result.stderr).toBe(0);
    const report = JSON.parse(await readFile(result.output, "utf8"));
    expect(
      report.groups
        .map((group: { classification: string }) => group.classification)
        .sort(),
    ).toEqual([
      "manual-review",
      "restricted-candidate",
      "shared-public",
      "unpublished-only",
    ]);
    expect(
      report.groups.every(
        (group: { retirementAllowed: boolean }) =>
          group.retirementAllowed === false,
      ),
    ).toBe(true);
    expect(report.coverage).toEqual(["posts.photos"]);
    expect((await stat(result.output)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(result.input, "utf8"))).toEqual(
      result.snapshot,
    );
    expect(result.stdout).not.toContain("fixture.jpg");
  });
  /** Проверяет удаление секретных query-параметров и учётных данных из отчёта и ручную проверку неоднозначных источников. */
  it("redacts signed URLs and credentials and marks ambiguous sources for review", async () => {
    const result = await run([
      ref(1, "restricted", url + "?secret=do-not-print"),
      ref(
        2,
        "restricted",
        "https://user:do-not-print@s3.twcstorage.ru/daryadarcy-s3/a",
      ),
      ref(
        3,
        "restricted",
        "https://s3.twcstorage.ru/daryadarcy-s3/feed/%2Fprivate",
      ),
      ref(
        4,
        "restricted",
        "https://s3.twcstorage.ru/daryadarcy-s3/private-content/a",
      ),
    ]);
    expect(result.code, result.stderr).toBe(0);
    const text = await readFile(result.output, "utf8");
    expect(text).not.toContain("do-not-print");
    expect(
      JSON.parse(text).groups.every(
        (group: { classification: string }) =>
          group.classification === "manual-review",
      ),
    ).toBe(true);
  });
  /** Отличает защищённую ссылку API от доказанной готовности её файловой привязки. */
  it("recognizes protected API references without claiming their bindings are ready", async () => {
    const result = await run([
      ref(
        1,
        "restricted",
        "/api/media/content-files/00000000-0000-4000-8000-000000000000",
      ),
      ref(2, "public", url),
    ]);
    expect(result.code, result.stderr).toBe(0);
    const groups = JSON.parse(await readFile(result.output, "utf8")).groups;
    expect(
      groups
        .map((group: { classification: string }) => group.classification)
        .sort(),
    ).toEqual(["protected-reference", "public-only"]);
  });
  /** Отклоняет флаги изменения данных до создания выходного отчёта. */
  it.each(["--apply", "--delete"])(
    "rejects mutation mode %s",
    async (option) => {
      const result = await run([ref(1)], [option]);
      expect(result.code).not.toBe(0);
      await expect(stat(result.output)).rejects.toThrow();
    },
  );
  /** Проверяет отказ от перезаписи уже существующего отчёта. */
  it("refuses existing output instead of overwriting it", async () => {
    const result = await run([ref(1)], [], true);
    expect(result.code).not.toBe(0);
    expect(await readFile(result.output, "utf8")).toBe("preserve");
  });
  /** Считает обращения к локальному HTTP-источнику и доказывает, что инвентаризация не скачивает файлы. */
  it("never fetches a source URL, including a local service", async () => {
    let requests = 0;
    const server = createServer((_request, response) => {
      requests++;
      response.end("must not be fetched");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const result = await run([
        ref(
          1,
          "restricted",
          `http://127.0.0.1:${(server.address() as AddressInfo).port}/file`,
        ),
      ]);
      expect(result.code, result.stderr).toBe(0);
      expect(requests).toBe(0);
      expect(
        JSON.parse(await readFile(result.output, "utf8")).groups[0]
          .classification,
      ).toBe("manual-review");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  /** Объединяет ссылки на один объект S3 при различии регистра хоста и явного стандартного порта. */
  it("recognizes the same S3 object behind host case and default-port aliases", async () => {
    const alias = url.replace("s3.twcstorage.ru", "S3.TWCSTORAGE.RU:443");
    const result = await run([ref(1), ref(2, "public", alias)]);
    expect(result.code, result.stderr).toBe(0);
    const groups = JSON.parse(await readFile(result.output, "utf8")).groups;
    expect(groups).toHaveLength(1);
    expect(groups[0].classification).toBe("shared-public");
  });
  /** Отклоняет повторные слоты и посторонние персональные поля снимка вместо неоднозначного плана. */
  it.each([
    { refs: [ref(1), ref(1)] },
    { refs: [{ ...ref(1), access: "perhaps" }] },
    { refs: [{ ...ref(1), text: "personal content" }] },
  ])(
    "rejects duplicate slots or an invalid metadata contract",
    async ({ refs }) => {
      const result = await run(refs);
      expect(result.code).not.toBe(0);
      await expect(stat(result.output)).rejects.toThrow();
    },
  );
});
