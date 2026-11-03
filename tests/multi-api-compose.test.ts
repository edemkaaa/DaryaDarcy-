import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectMultiApiDeployment } from "../tooling/scripts/multi-api-policy";

describe.skipIf(process.env.API_MULTI_COMPOSE_ACCEPTANCE !== "true")(
  "multi API resolved Compose preflight",
  () => {
    it.each([false, true])(
      "preserves private flags and budgets the actual merged stack (TEST=%s)",
      (withTest) => {
        const dir = mkdtempSync(join(tmpdir(), "darcy-multi-compose-"));
        try {
          const files = [
            "compose.yaml",
            "compose.multi-api.example.yaml",
            ...(withTest ? ["compose.prodamus-test.yaml"] : []),
          ];
          for (const file of files)
            copyFileSync(
              resolve("infrastructure/deploy/teamassist", file),
              join(dir, file),
            );
          writeFileSync(join(dir, "mysql.env"), "", { mode: 0o600 });
          writeFileSync(join(dir, "interpolation.env"), "", { mode: 0o600 });
          writeFileSync(
            join(dir, "prodamus-test.env"),
            "PRODAMUS_TEST_ENABLED=true\n",
            { mode: 0o600 },
          );
          writeFileSync(join(dir, "test.mjs"), "export {};", { mode: 0o600 });
          const envText = `DATABASE_URL=mysql://fixture:private-db-secret@mysql/backend_test\nJWT_SECRET=private-jwt-secret\nAUTH_LINK_ENCRYPTION_KEY=${Buffer.alloc(32, 1).toString("base64")}\nAPI_COORDINATION_MODE=mysql\nAPI_REPLICA_COUNT=2\nPRIVATE_CONTENT_FILES_ENABLED=false\nPRIVATE_LIBRARY_FILES_ENABLED=false\nENABLE_SMS_LOGIN=false\n`;
          writeFileSync(join(dir, "api.env"), envText, { mode: 0o600 });
          const config = () =>
            JSON.parse(
              execFileSync(
                "docker",
                [
                  "compose",
                  "--env-file",
                  join(dir, "interpolation.env"),
                  "--project-directory",
                  dir,
                  ...files.flatMap((file) => ["-f", join(dir, file)]),
                  "config",
                  "--format",
                  "json",
                ],
                {
                  encoding: "utf8",
                  timeout: 10000,
                  env: {
                    PATH: process.env.PATH,
                    HOME: process.env.HOME,
                    STAGING_IMAGE: "fixture:api",
                    PRODAMUS_TEST_RUNTIME_IMAGE: `sha256:${"a".repeat(64)}`,
                    PRODAMUS_TEST_BUNDLE: join(dir, "test.mjs"),
                  },
                },
              ),
            );
          const merged = config();
          expect(
            inspectMultiApiDeployment(merged, {
              hostMemoryMiB: 16384,
              mysqlMaxConnections: 50,
            }),
          ).toMatchObject({
            ok: true,
            apiProcesses: withTest ? 3 : 2,
            requiredConnections: withTest ? 40 : 30,
          });
          expect(
            inspectMultiApiDeployment(merged, {
              hostMemoryMiB: 8192,
              mysqlMaxConnections: 50,
            }).issues,
          ).toContain("host-memory-budget-exceeded");
          for (const service of [
            "api",
            ...(withTest ? ["prodamus-test"] : []),
          ]) {
            expect(
              merged.services[service].environment
                .PRIVATE_CONTENT_FILES_ENABLED,
            ).toBe("false");
            expect(
              merged.services[service].environment
                .PRIVATE_LIBRARY_FILES_ENABLED,
            ).toBe("false");
          }
          const input = join(dir, "private-resolved.json");
          writeFileSync(input, JSON.stringify(merged), { mode: 0o600 });
          const output = execFileSync(
            process.execPath,
            [
              "--import",
              "tsx",
              "tooling/scripts/multi-api-preflight.ts",
              "--config",
              input,
              "--host-memory-mib",
              "16384",
              "--mysql-max-connections",
              "50",
            ],
            { encoding: "utf8", timeout: 10000 },
          );
          expect(JSON.parse(output)).toMatchObject({
            ok: true,
            productionApproval: false,
          });
          expect(output).not.toMatch(/private-db-secret|private-jwt-secret/);
          if (withTest) {
            writeFileSync(
              join(dir, "api.env"),
              envText.replace(
                "API_COORDINATION_MODE=mysql",
                "API_COORDINATION_MODE=local",
              ),
              { mode: 0o600 },
            );
            expect(
              inspectMultiApiDeployment(config(), {
                hostMemoryMiB: 16384,
                mysqlMaxConnections: 50,
              }).issues,
            ).toContain("shared-coordination-required");
          }
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      },
    );
  },
);
