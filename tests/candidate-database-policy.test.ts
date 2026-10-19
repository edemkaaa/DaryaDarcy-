import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import * as policy from "../tooling/scripts/migration-policy";

const plan = "51616035e287f221c633d8c7975fef46229d6fbc4ef1e80e586f85e96469684a";
const input = {
  CANDIDATE_DATABASE_URL: `mysql://darcy_candidate_20261019:${"b".repeat(64)}@mysql:3306/daryadarcy_candidate_20261019`,
  CANDIDATE_SERVER_UUID: "12345678-1234-1234-1234-123456789abc",
  CANDIDATE_SOURCE_REVISION: "a".repeat(40),
  CANDIDATE_PLAN_HASH: plan,
};
it("accepts only the explicitly reviewed fresh candidate and returns no credentials", () => {
  expect(policy.candidateTargetAllowed?.(input, plan)).toBe(true);
});
it.each([
  { CANDIDATE_DATABASE_URL: undefined },
  {
    CANDIDATE_DATABASE_URL: input.CANDIDATE_DATABASE_URL.replace(
      "/daryadarcy_candidate_20261019",
      "/daryadarcy_staging",
    ),
  },
  {
    CANDIDATE_DATABASE_URL: input.CANDIDATE_DATABASE_URL.replace(
      "@mysql:",
      "@127.0.0.1:",
    ),
  },
  {
    CANDIDATE_DATABASE_URL: input.CANDIDATE_DATABASE_URL.replace(
      "@mysql:",
      "@other:",
    ),
  },
  {
    CANDIDATE_DATABASE_URL:
      input.CANDIDATE_DATABASE_URL + "?multipleStatements=true",
  },
  { CANDIDATE_DATABASE_URL: input.CANDIDATE_DATABASE_URL + "#ignored" },
  {
    CANDIDATE_DATABASE_URL: input.CANDIDATE_DATABASE_URL.replace(
      "3306",
      "3307",
    ),
  },
  {
    CANDIDATE_DATABASE_URL: input.CANDIDATE_DATABASE_URL.replace(
      "darcy_candidate_20261019:",
      "root:",
    ),
  },
  { CANDIDATE_DATABASE_URL: "not a URI private-sentinel" },
  { CANDIDATE_SERVER_UUID: undefined },
  { CANDIDATE_SERVER_UUID: "not-a-server" },
  { CANDIDATE_SOURCE_REVISION: "HEAD" },
  { CANDIDATE_PLAN_HASH: "0".repeat(64) },
])("refuses unintended or ambiguous candidate settings %#", (patch) => {
  expect(policy.candidateTargetAllowed?.({ ...input, ...patch }, plan)).toBe(
    false,
  );
});
it.each([
  { name: "daryadarcy_staging" },
  { serverUuid: "87654321-1234-1234-1234-123456789abc" },
  { version: "8.0.40" },
  { engine: "MyISAM" },
])("refuses a different connected database/server/engine %#", (patch) => {
  expect(
    policy.candidateIdentityAllowed?.(
      {
        name: "daryadarcy_candidate_20261019",
        serverUuid: input.CANDIDATE_SERVER_UUID,
        version: "8.4.11",
        engine: "InnoDB",
        ...patch,
      },
      input.CANDIDATE_SERVER_UUID,
    ),
  ).toBe(false);
});
it("accepts the connected candidate only after checking its live identity", () => {
  expect(
    policy.candidateIdentityAllowed?.(
      {
        name: "daryadarcy_candidate_20261019",
        serverUuid: input.CANDIDATE_SERVER_UUID,
        version: "8.4.11",
        engine: "InnoDB",
      },
      input.CANDIDATE_SERVER_UUID,
    ),
  ).toBe(true);
});
it("refuses changed source bytes even when the caller approves their new hash", () => {
  expect(
    policy.candidateTargetAllowed?.(
      { ...input, CANDIDATE_PLAN_HASH: "c".repeat(64) },
      "c".repeat(64),
    ),
  ).toBe(false);
});
it("does not substitute application credentials when the candidate URI is absent", () => {
  expect(
    policy.candidateTargetAllowed?.(
      {
        ...input,
        CANDIDATE_DATABASE_URL: undefined,
        DATABASE_URL: input.CANDIDATE_DATABASE_URL,
      },
      plan,
    ),
  ).toBe(false);
});
it.each(["--force", "--initialize-candidate", "--check-api"])(
  "the actual operator refuses %s without authorized configuration and keeps errors private",
  (mode) => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "tooling/scripts/candidate-database.ts", mode],
      {
        env: {
          PATH: "",
          CANDIDATE_DATABASE_URL:
            "mysql://root:private-cli-sentinel@127.0.0.1:1/daryadarcy_staging",
        },
        encoding: "utf8",
        timeout: 10000,
      },
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    const lines = result.stderr.trim().split("\n");
    expect(lines[0]).toBe(
      "Candidate database operation refused or failed. No existing database is repaired; details withheld.",
    );
    expect(JSON.parse(lines[1] ?? "{}")).toMatchObject({
      phase: mode === "--force" ? "arguments" : "candidate-target",
      code: "ERR_ASSERTION",
    });
    expect(result.stderr).not.toContain("private-cli-sentinel");
  },
);
