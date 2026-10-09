import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  files: vi.fn(),
  names: vi.fn(),
  history: vi.fn(),
  email: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({
  readFile: mocks.files,
  readdir: mocks.names,
}));
vi.mock("../tooling/scripts/migration-history", () => ({
  readMigrationHistory: mocks.history,
}));
vi.mock("../tooling/scripts/email-identity-preflight", () => ({
  readEmailIdentityIssues: mocks.email,
}));
const sql = "SELECT 1;\n";
const migrations = [
  { idx: 0, when: 100, tag: "0000_first", breakpoints: true },
  { idx: 1, when: 200, tag: "0027_user_email_identity", breakpoints: true },
];

describe("CLI email migration gating", () => {
  let argv: string[], exitCode: typeof process.exitCode;
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    argv = process.argv;
    exitCode = process.exitCode;
    process.argv = ["node", "migration-preflight", "--require-database"];
    process.exitCode = 0;
    vi.stubEnv("DATABASE_URL", "mysql://fixture@localhost/backend_test");
    vi.stubEnv("MIGRATION_PREFLIGHT_DATABASE_URL", "");
    mocks.names.mockResolvedValue([
      "0000_first.sql",
      "0027_user_email_identity.sql",
    ]);
    mocks.files.mockImplementation(async (url: URL) =>
      url.pathname.endsWith("_journal.json")
        ? JSON.stringify({ dialect: "mysql", entries: migrations })
        : sql,
    );
    mocks.history.mockResolvedValue([
      { created_at: 100, hash: createHash("sha256").update(sql).digest("hex") },
    ]);
    mocks.email.mockResolvedValue([]);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    process.argv = argv;
    process.exitCode = exitCode;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  async function run() {
    await import("../tooling/scripts/migration-preflight");
    await vi.waitFor(() => expect(console.log).toHaveBeenCalledOnce());
    return JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
  }
  it.each([[], ["email-identity-duplicates"], ["email-identity-noncanonical"]])(
    "checks pending identity data and refuses its issues %j",
    async (...issues: string[]) => {
      mocks.email.mockResolvedValue(issues);
      expect(await run()).toMatchObject({
        databaseChecked: true,
        issues,
        pending: ["0027_user_email_identity"],
        releaseApproval: false,
      });
      expect(mocks.email).toHaveBeenCalledExactlyOnceWith(
        "mysql://fixture@localhost/backend_test",
      );
      expect(process.exitCode).toBe(issues.length ? 1 : 0);
    },
  );
  it("does not inspect identities when the migration is already applied", async () => {
    mocks.history.mockResolvedValue(
      migrations.map((m) => ({
        created_at: m.when,
        hash: createHash("sha256").update(sql).digest("hex"),
      })),
    );
    expect(await run()).toMatchObject({ issues: [], pending: [] });
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it("stops before data inspection on a history mismatch", async () => {
    mocks.history.mockResolvedValue([
      { created_at: 100, hash: "0".repeat(64) },
    ]);
    expect(await run()).toMatchObject({ issues: ["hash-mismatch:0000_first"] });
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it("stops before any database connection on a manifest gap", async () => {
    mocks.names.mockResolvedValue(["0000_first.sql"]);
    expect(await run()).toMatchObject({
      databaseChecked: false,
      issues: ["missing-file:0027_user_email_identity.sql"],
    });
    expect(mocks.history).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it("keeps a rejected data inspection fail-closed and withholds its error details", async () => {
    mocks.email.mockRejectedValue(
      new Error("fixture-sensitive-address@example.test"),
    );
    await import("../tooling/scripts/migration-preflight");
    await vi.waitFor(() => expect(console.error).toHaveBeenCalledOnce());
    expect(console.log).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "fixture-sensitive-address",
    );
  });
});
