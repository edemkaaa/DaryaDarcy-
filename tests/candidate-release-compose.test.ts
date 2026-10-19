import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

it.skipIf(process.env.CANDIDATE_COMPOSE_ACCEPTANCE !== "true")(
  "changes only API image/DB connection and restores the exact baseline offline",
  () => {
    const scratch = mkdtempSync(join(tmpdir(), "darcy-compose-rehearsal-"));
    const baselineImage = "daryadarcy-staging:synthetic-baseline";
    const candidateImage = `sha256:${"a".repeat(64)}`;
    const baseUri = "mysql://synthetic:fixture-only@mysql:3306/old_fixture";
    const candidateUri =
      "mysql://synthetic:fixture-only@mysql:3306/backend_test";
    try {
      for (const name of ["compose.yaml", "compose.candidate-api.example.yaml"])
        copyFileSync(
          resolve("infrastructure/deploy/teamassist", name),
          join(scratch, name),
        );
      writeFileSync(join(scratch, "mysql.env"), "", { mode: 0o600 });
      writeFileSync(join(scratch, "interpolation.env"), "", { mode: 0o600 });
      writeFileSync(join(scratch, "api.env"), `DATABASE_URL=${baseUri}\n`, {
        mode: 0o600,
      });
      writeFileSync(
        join(scratch, "candidate-api.env"),
        `DATABASE_URL=${candidateUri}\n`,
        { mode: 0o600 },
      );
      const config = (candidate: boolean) =>
        JSON.parse(
          execFileSync(
            "docker",
            [
              "compose",
              "--env-file",
              join(scratch, "interpolation.env"),
              "--project-directory",
              scratch,
              "-f",
              join(scratch, "compose.yaml"),
              ...(candidate
                ? ["-f", join(scratch, "compose.candidate-api.example.yaml")]
                : []),
              "config",
              "--format",
              "json",
            ],
            {
              encoding: "utf8",
              timeout: 10_000,
              env: {
                PATH: process.env.PATH,
                HOME: process.env.HOME,
                STAGING_IMAGE: baselineImage,
                CANDIDATE_BACKEND_IMAGE: candidateImage,
              },
            },
          ),
        );
      const baseline = config(false);
      const candidate = config(true);
      expect(baseline.services.api.environment.DATABASE_URL).toBe(baseUri);
      expect(candidate.services.api.image).toBe(candidateImage);
      expect(candidate.services.api.environment.DATABASE_URL).toBe(
        candidateUri,
      );
      expect(candidate.services.web.image).toBe(baselineImage);
      const expected = structuredClone(baseline);
      expected.services.api.image = candidateImage;
      expected.services.api.environment.DATABASE_URL = candidateUri;
      expect(candidate).toEqual(expected);
      expect(config(false)).toEqual(baseline);
    } finally {
      rmSync(scratch, { recursive: true });
    }
  },
);
