/** Опциональная офлайн-приёмка уже имеющегося backend-образа; Docker не скачивает image и не подключает рабочие ресурсы. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildSync } from "esbuild";
import { describe, expect, it } from "vitest";

// Explicit local image only: never pull, start workers, load .env or connect to SQL/S3.
const image = process.env.BACKEND_IMAGE_ACCEPTANCE;
/** Ограничиваем время и объём вывода CLI Docker; аргументы не проходят через shell. */
const docker = (args: string[]) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024,
  });

/** Набор включается только явным BACKEND_IMAGE_ACCEPTANCE и проверяет метаданные плюс собственный probe. */
describe.skipIf(!image)(
  "backend release image (native Docker, offline)",
  () => {
    /** Проверяем revision label, архитектуру, non-root command и отсутствие секретных env в образе. */
    it("is pinned to the expected source, amd64 and non-root backend command", () => {
      const revision = process.env.BACKEND_IMAGE_REVISION;
      expect(revision).toMatch(/^[a-f0-9]{40}$/);
      const [meta] = JSON.parse(docker(["image", "inspect", image!]));
      expect(meta.Os).toBe("linux");
      expect(meta.Architecture).toBe("amd64");
      expect(meta.Config.User).toBe("node");
      expect(meta.Config.WorkingDir).toBe("/app");
      expect(meta.Config.Entrypoint).toEqual(["docker-entrypoint.sh"]);
      expect(meta.Config.Cmd).toEqual(["node", "dist/index.mjs"]);
      expect(meta.Config.Labels["org.opencontainers.image.revision"]).toBe(
        revision,
      );
      expect(meta.Config.Env).toEqual(
        expect.arrayContaining(["NODE_ENV=production"]),
      );
      expect(
        meta.Config.Env.some((value: string) =>
          /^(DATABASE_URL|JWT_SECRET|S3_|SMTP_|PRIVATE_)/.test(value),
        ),
      ).toBe(false);
    });

    /** Собранный probe монтируется read-only в network=none контейнер с лимитами; приложение проверяется без workers/БД. */
    it("loads native dependencies and serves the real composition with no egress", () => {
      const scratch = mkdtempSync(join(tmpdir(), "darcy-image-probe-"));
      try {
        const probe = join(scratch, "probe.mjs");
        buildSync({
          entryPoints: [resolve("tests/helpers/backend-image-probe.ts")],
          bundle: true,
          platform: "node",
          packages: "external",
          format: "esm",
          outfile: probe,
        });
        const output = docker([
          "run",
          "--rm",
          "--pull=never",
          "--platform=linux/amd64",
          "--network=none",
          "--read-only",
          "--cap-drop=ALL",
          "--security-opt=no-new-privileges",
          "--memory=384m",
          "--cpus=1",
          "--mount",
          `type=bind,src=${probe},dst=/app/probe.mjs,readonly`,
          image!,
          "node",
          "probe.mjs",
        ]);
        expect(output).toContain('"httpChecks":6');
        expect(output).toContain('"workersStarted":false');
      } finally {
        rmSync(scratch, { recursive: true });
      }
    }, 120_000);
  },
);
