/** Опциональный офлайн Compose config-тест 8GiB resource overlay не запускает контейнеры и не меняет лимиты стенда. */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const profile = "compose.resources-8gb.example.yaml";
const files = [
  "compose.yaml",
  "compose.images.yaml",
  "compose.video.yaml",
  "compose.prodamus-test.yaml",
  "compose.private-uploads.yaml",
  "compose.candidate-api.example.yaml",
];
const limits = {
  api: { mem_limit: 1536 * 1024 ** 2, cpus: 1.5 },
  web: { mem_limit: 2048 * 1024 ** 2, cpus: 2 },
  mysql: { mem_limit: 2048 * 1024 ** 2, cpus: 1 },
};
type ComposeConfig = {
  services: Record<string, { mem_limit: string; cpus: number }>;
};

// config renders the actual merge offline. Never call up/run/pull or use real envs.
/** Synthetic baseline/full/candidate stacks сравниваются целиком, не только по трём service-полям. */
describe.skipIf(process.env.RESOURCE_COMPOSE_ACCEPTANCE !== "true")(
  "opt-in resource limits for a dedicated 8GiB host",
  () => {
    /** Меняются ровно memory/cpu API/web/MySQL; остаётся минимум1GiB резерва и снятие overlay возвращает baseline. */
    it.each(["base", "full", "candidate"])(
      "changes only resource ceilings and preserves the %s stack on rollback",
      (variant) => {
        const directory = mkdtempSync(join(tmpdir(), "darcy-resources-"));
        try {
          expect(
            existsSync(resolve("infrastructure/deploy/teamassist", profile)),
          ).toBe(true);
          for (const file of [...files, profile])
            copyFileSync(
              resolve("infrastructure/deploy/teamassist", file),
              join(directory, file),
            );
          for (const file of [
            "mysql.env",
            "interpolation.env",
            "prodamus-test.env",
          ])
            writeFileSync(join(directory, file), "", { mode: 0o600 });
          writeFileSync(
            join(directory, "api.env"),
            "DATABASE_URL=mysql://fixture:fixture@mysql/old_fixture\nVK_CATALOG_ENABLED=true\n",
            { mode: 0o600 },
          );
          writeFileSync(
            join(directory, "candidate-api.env"),
            "DATABASE_URL=mysql://fixture:fixture@mysql/backend_test\nVK_CATALOG_ENABLED=true\n",
            { mode: 0o600 },
          );
          writeFileSync(
            join(directory, "private-uploads.env"),
            "PRIVATE_CONTENT_FILES_ENABLED=false\nS3_BUCKET=fixture-only\n",
            { mode: 0o600 },
          );
          writeFileSync(join(directory, "fixture-test.mjs"), "export {};\n", {
            mode: 0o600,
          });
          writeFileSync(
            join(directory, "smtp-fixture.yaml"),
            "services:\n  smtp-proxy:\n    image: fixture:smtp\n    mem_limit: 32m\n    cpus: 0.1\n    networks: [isolated]\n",
            { mode: 0o600 },
          );
          const stack =
            variant === "base"
              ? [files[0]]
              : [
                  ...files.slice(0, 5),
                  "smtp-fixture.yaml",
                  ...(variant === "candidate" ? [files[5]] : []),
                ];
          /** Docker CLI только рендерит merge собственного temp-stack с synthetic image/env refs. */
          const config = (enabled: boolean): ComposeConfig =>
            JSON.parse(
              execFileSync(
                "docker",
                [
                  "compose",
                  "--env-file",
                  join(directory, "interpolation.env"),
                  "--project-directory",
                  directory,
                  ...[...stack, ...(enabled ? [profile] : [])].flatMap(
                    (file) => ["-f", join(directory, file)],
                  ),
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
                    STAGING_IMAGE: "fixture:baseline",
                    STAGING_VIDEO_IMAGE: "fixture:video",
                    PRODAMUS_TEST_RUNTIME_IMAGE: `sha256:${"a".repeat(64)}`,
                    PRODAMUS_TEST_BUNDLE: join(directory, "fixture-test.mjs"),
                    CANDIDATE_BACKEND_IMAGE: `sha256:${"b".repeat(64)}`,
                  },
                },
              ),
            );
          const baseline = config(false);
          const after = config(true);
          const expected = structuredClone(baseline);
          for (const [service, values] of Object.entries(limits))
            Object.assign(expected.services[service], {
              mem_limit: String(values.mem_limit),
              cpus: values.cpus,
            });
          expect(after).toEqual(expected);
          expect(Number(baseline.services.api.mem_limit)).toBe(256 * 1024 ** 2);
          expect(Number(baseline.services.web.mem_limit)).toBe(384 * 1024 ** 2);
          expect(Number(baseline.services.mysql.mem_limit)).toBe(
            512 * 1024 ** 2,
          );
          const totalMemory = Object.values(after.services).reduce(
            (sum, service) => sum + Number(service.mem_limit),
            0,
          );
          expect(8 * 1024 ** 3 - totalMemory).toBeGreaterThanOrEqual(1024 ** 3);
          expect(config(false)).toEqual(baseline);
        } finally {
          rmSync(directory, { recursive: true });
        }
      },
    );
  },
);
