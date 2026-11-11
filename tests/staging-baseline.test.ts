/** Проверяем узкий исторический upgrade 0026 по literal attestations: эти fixtures не являются текущим fresh-профилем из 52 миграций и не разрешают произвольный ремонт истории. */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  hashStageTables,
  inspectRestoreProof,
  inspectRehearsalReceipt,
  inspectStageBaseline,
} from "../tooling/scripts/staging-baseline-policy";

// Real 28-table staging snapshot, with only mutable AUTO_INCREMENT removed.
// Fixtures are literals, not values computed by the policy under test.
const baseline = {
  database: "daryadarcy_staging",
  baseHash: "ab07104f1ea2fa3377588df1cca7db22a3fdb7f1466e66f547143f3b5e9fc3ac",
  sqlHash: "96196ec383cd2ce7a33882fc338d77512f5c32d6081646dd2fb1f9a191ba232b",
  checkoutHash: null,
  executableObjects: 0,
};

/** Граница разрешения фиксируется хешами конкретной старой схемы и SQL, а не только именем базы. */
describe("the one approved staging baseline upgrade", () => {
  /** Точное исходное свидетельство разрешает лишь ожидающее согласованное additive изменение. */
  it("allows only the pending additive 0026 on the attested baseline", () => {
    expect(inspectStageBaseline(baseline)).toEqual({
      state: "pending",
      issues: [],
    });
  });
  /** Совпадение структуры не разрешает применять upgrade к другой базе. */
  it.each(["production", "daryadarcy", "backend_test", ""])(
    "refuses a different database even with the same schema: %s",
    (database) => {
      expect(inspectStageBaseline({ ...baseline, database })).toEqual({
        state: "blocked",
        issues: ["unexpected-database"],
      });
    },
  );
  /** Любое отличие base hash блокирует изменение, даже если оно кажется совместимым. */
  it("blocks any drift in an existing table or unexpected extra table", () => {
    expect(
      inspectStageBaseline({ ...baseline, baseHash: "a".repeat(64) }),
    ).toEqual({
      state: "blocked",
      issues: ["baseline-schema-mismatch"],
    });
  });
  /** Хеш разрешённого SQL не заменяется произвольным release-входом. */
  it("blocks changed SQL instead of executing arbitrary release input", () => {
    expect(
      inspectStageBaseline({ ...baseline, sqlHash: "a".repeat(64) }),
    ).toEqual({
      state: "blocked",
      issues: ["upgrade-sql-mismatch"],
    });
  });
  /** Неожиданные executable SQL-объекты выводят назначение за пределы аттестованной схемы. */
  it("refuses executable database objects absent from the approved baseline", () => {
    expect(inspectStageBaseline({ ...baseline, executableObjects: 1 })).toEqual(
      {
        state: "blocked",
        issues: ["unexpected-executable-objects"],
      },
    );
  });
  /** Присутствующая таблица должна совпасть по точному shape, а не только имени. */
  it("never accepts an existing differently shaped checkout table", () => {
    expect(
      inspectStageBaseline({ ...baseline, checkoutHash: "a".repeat(64) }),
    ).toEqual({
      state: "blocked",
      issues: ["checkout-schema-mismatch"],
    });
  });
  /** Потерянный DDL-ответ различается с отсутствием применения по точному checkout hash. */
  it("recognizes the exact rehearsed table after a lost DDL acknowledgement", () => {
    expect(
      inspectStageBaseline({
        ...baseline,
        checkoutHash:
          "da894d0b5fd978061571f63803f676cc3ba6424480db588dda501e96633de914",
      }),
    ).toEqual({
      state: "applied",
      issues: [],
    });
  });
});

/** CLI не должен достигать сети с неподдерживаемыми аргументами или неверной целью. */
describe("operator entry point refuses unsafe input before connecting", () => {
  const entry = fileURLToPath(
    new URL("../tooling/scripts/staging-baseline-upgrade.ts", import.meta.url),
  );
  /** Запускает настоящий операторский entrypoint с явными аргументами и синтетическим URL, ожидая отказ до подключения. */
  const run = (args: string[], databaseUrl?: string) =>
    spawnSync(process.execPath, ["--import", "tsx", entry, ...args], {
      encoding: "utf8",
      timeout: 5000,
      env: { PATH: process.env.PATH, DATABASE_URL: databaseUrl },
    });
  /** Неизвестные режимы и обход истории завершаются до подключения, без печати credential URL. */
  it.each([
    { args: ["--ignore-history"] },
    { args: ["--apply", "--rehearse"] },
    { args: ["arbitrary.sql"] },
  ])("rejects unsupported arguments before a connection", ({ args }) => {
    const result = run(
      args,
      "mysql://secret-user:secret-password@mysql/daryadarcy_staging",
    );
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe(
      "Unsupported baseline arguments; no database changed.",
    );
    expect(result.stdout).toBe("");
  });
  /** URI другой БД/схемы и опасные query options не принимаются как разрешённое назначение. */
  it.each([
    undefined,
    "https://secret-user:secret-password@mysql/db",
    "mysql://secret-user:secret-password@mysql/production",
    "mysql://secret-user:secret-password@mysql/daryadarcy_staging?multipleStatements=true",
    "mysql://secret-user:secret-password@mysql/daryadarcy_staging?charset=latin1",
  ])("does not connect with an absent or wrong target URI", (uri) => {
    const result = run([], uri);
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe(
      "Invalid staging database target; no database changed.",
    );
    expect(result.stdout).toBe("");
  });
});

/** Проверяем независимый restore, неизменность данных и привязку репетиции к конкретному серверу и файлу backup. */
describe("baseline identity and backup attestation", () => {
  const ddl =
    "CREATE TABLE `sample` (id int NOT NULL AUTO_INCREMENT, PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
  /** Schema hash игнорирует только текущее значение счётчика таблицы, не определение колонки. */
  it("ignores only a table's advancing auto-increment counter", () => {
    expect(
      hashStageTables([
        {
          name: "sample",
          ddl: ddl.replace(" DEFAULT", " AUTO_INCREMENT=744 DEFAULT"),
        },
      ]),
    ).toBe("0c9f6a31476ff13af72010e349c55748805bf346863d56338453955451c62b61");
  });
  /** Удаление AUTO_INCREMENT из колонки обязательно меняет schema identity. */
  it("keeps column auto-increment behavior and other schema differences", () => {
    expect(
      hashStageTables([
        { name: "sample", ddl: ddl.replace(" AUTO_INCREMENT,", ",") },
      ]),
    ).not.toBe(
      "0c9f6a31476ff13af72010e349c55748805bf346863d56338453955451c62b61",
    );
  });
  const proof = {
    version: 1,
    database: "daryadarcy_staging",
    sourceServerUuid: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
    restoredServerUuid: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
    sourceSchemaHash: baseline.baseHash,
    restoredSchemaHash: baseline.baseHash,
    sourceDataHash: "c".repeat(64),
    restoredDataHash: "c".repeat(64),
    backupHash: "d".repeat(64),
    verifiedAt: "2026-10-07T12:00:00.000Z",
    tables: 28,
    rows: 833,
    autoIncrementPreserved: true,
  };
  const now = new Date("2026-10-07T13:00:00.000Z");
  /** Режим apply разрешён только для исходного сервера, связанного с проверенным restore. */
  it("binds application to the restored backup's exact source server", () => {
    expect(
      inspectRestoreProof(
        proof,
        proof.sourceServerUuid,
        "d".repeat(64),
        "apply",
        now,
      ),
    ).toEqual([]);
  });
  /** Rehearse разрешён на отдельной восстановленной копии, не на исходном рабочем сервере. */
  it("allows rehearsal only on the independently restored server", () => {
    expect(
      inspectRestoreProof(
        proof,
        proof.restoredServerUuid,
        "d".repeat(64),
        "rehearse",
        now,
      ),
    ).toEqual([]);
    expect(
      inspectRestoreProof(
        proof,
        proof.sourceServerUuid,
        "d".repeat(64),
        "rehearse",
        now,
      ),
    ).toEqual(["backup-target-mismatch"]);
  });
  /** Чужой сервер, несовпадение данных/схемы, self-restore и неверное время делают proof непригодным. */
  it.each([
    [
      "different server",
      { sourceServerUuid: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee" },
      ["backup-target-mismatch"],
    ],
    [
      "different restored rows",
      { restoredDataHash: "e".repeat(64) },
      ["backup-data-mismatch"],
    ],
    [
      "different restored schema",
      { restoredSchemaHash: "e".repeat(64) },
      ["backup-schema-mismatch"],
    ],
    [
      "self-restore",
      { restoredServerUuid: proof.sourceServerUuid },
      ["backup-not-independent"],
    ],
    [
      "stale rehearsal",
      { verifiedAt: "2026-10-06T12:00:00.000Z" },
      ["backup-proof-expired"],
    ],
    [
      "future rehearsal",
      { verifiedAt: "2026-10-07T14:00:00.000Z" },
      ["backup-proof-expired"],
    ],
  ])("refuses %s", (_name, changed, issues) => {
    expect(
      inspectRestoreProof(
        { ...proof, ...changed },
        proof.sourceServerUuid,
        "d".repeat(64),
        "apply",
        now,
      ),
    ).toEqual(issues);
  });
  /** Реально прочитанный digest backup должен совпасть с аттестацией. */
  it("hashes the actual backup instead of trusting a supplied file name", () => {
    expect(
      inspectRestoreProof(
        proof,
        proof.sourceServerUuid,
        "e".repeat(64),
        "apply",
        now,
      ),
    ).toEqual(["backup-file-mismatch"]);
  });
  /** Неполное или неверной версии свидетельство не получает разрешающий default. */
  it.each([
    null,
    {},
    { ...proof, version: 2 },
    { ...proof, sourceServerUuid: "" },
    { ...proof, autoIncrementPreserved: false },
    { ...proof, autoIncrementPreserved: undefined },
  ])("refuses malformed proof without a permissive default", (input) => {
    expect(
      inspectRestoreProof(
        input,
        proof.sourceServerUuid,
        "d".repeat(64),
        "apply",
        now,
      ),
    ).toEqual(["invalid-backup-proof"]);
  });
  const receipt = {
    version: 1,
    mode: "rehearse",
    state: "applied",
    serverUuid: proof.restoredServerUuid,
    baseHash: baseline.baseHash,
    checkoutHash:
      "da894d0b5fd978061571f63803f676cc3ba6424480db588dda501e96633de914",
    sqlHash: baseline.sqlHash,
    backupHash: proof.backupHash,
    dataUnchanged: true,
    verifiedAt: "2026-10-07T12:05:00.000Z",
  };
  /** Для apply нужен отдельный успешный receipt репетиции того же SQL и восстановленного backup. */
  it("permits application only after a matching upgrade rehearsal", () => {
    expect(inspectRehearsalReceipt(receipt, proof, now)).toEqual([]);
  });
  /** Receipt не исправляет недействительный underlying restore proof. */
  it.each([
    { ...proof, sourceDataHash: "e".repeat(64) },
    { ...proof, restoredSchemaHash: "e".repeat(64) },
    { ...proof, restoredServerUuid: proof.sourceServerUuid },
  ])(
    "does not endorse a receipt attached to an invalid restore proof",
    (input) => {
      expect(
        inspectRehearsalReceipt(
          { ...receipt, serverUuid: input.restoredServerUuid },
          input,
          now,
        ),
      ).toEqual(["invalid-upgrade-rehearsal"]);
    },
  );
  /** Другой режим, сервер, SQL/backup/hash, изменённые данные или устаревшее время блокируют upgrade. */
  it.each([
    { ...receipt, mode: "apply" },
    { ...receipt, dataUnchanged: false },
    { ...receipt, serverUuid: proof.sourceServerUuid },
    { ...receipt, backupHash: "e".repeat(64) },
    { ...receipt, checkoutHash: "e".repeat(64) },
    { ...receipt, sqlHash: "e".repeat(64) },
    { ...receipt, verifiedAt: "2026-10-06T12:05:00.000Z" },
    null,
  ])("blocks absent, unrelated or unsuccessful upgrade rehearsal", (input) => {
    expect(inspectRehearsalReceipt(input, proof, now)).toEqual([
      "invalid-upgrade-rehearsal",
    ]);
  });
});
