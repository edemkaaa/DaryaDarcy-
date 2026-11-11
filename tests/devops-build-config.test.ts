/** Опциональный Docker Compose config тестирует build/release contract офлайн, не собирает image и не запускает сервисы. */
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { existsSync, mkdtempSync, writeFileSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

// Docker Compose parses the real build contract; no image/service/DB is started.
const file = resolve("infrastructure/build/compose.build.yaml");
type BuildService = Record<string, unknown> & {
  image: string;
  platform: string;
  build: { context: string; dockerfile: string; args: Record<string, string> };
};
/** Рендерим реальный build Compose с пустым temp-env и явными synthetic public args. */
function render(values: Record<string, string> = {}): {
  services: Record<string, BuildService>;
} {
  const scratch = mkdtempSync(join(tmpdir(), "darcy-build-config-"));
  const envFile = join(scratch, "public.env");
  try {
    writeFileSync(envFile, "", { mode: 0o600 });
    return JSON.parse(
      execFileSync(
        "docker",
        [
          "compose",
          "--env-file",
          envFile,
          "-f",
          file,
          "--profile",
          "legacy-video",
          "config",
          "--format",
          "json",
        ],
        {
          encoding: "utf8",
          timeout: 10_000,
          stdio: ["ignore", "pipe", "pipe"],
          env: { PATH: process.env.PATH, HOME: process.env.HOME, ...values },
        },
      ),
    );
  } finally {
    rmSync(scratch, { recursive: true });
  }
}
const revision = "b".repeat(40);
/** Build-образы отделены от runtime env, volumes, ports и application data. */
describe.skipIf(process.env.DEVOPS_BUILD_ACCEPTANCE !== "true")(
  "build-only Compose contract",
  () => {
    /** Без SOURCE_REVISION конфигурация не создаёт latest-артефакт. */
    it("refuses an unversioned image build instead of silently using latest", () => {
      expect(() => render()).toThrow(/SOURCE_REVISION/);
    });
    /** API/web/video имеют ожидаемый image tag, amd64 platform и разные build contexts без секретных runtime полей. */
    it("renders versioned build-only images without runtime services or secrets", () => {
      const config = render({ SOURCE_REVISION: revision });
      expect(Object.keys(config.services).sort()).toEqual([
        "api",
        "video",
        "web",
      ]);
      for (const [service, data] of Object.entries(config.services)) {
        expect(data.image).toBe(`daryadarcy/${service}:${revision}`);
        expect(data.platform).toBe("linux/amd64");
        for (const field of [
          "environment",
          "env_file",
          "volumes",
          "ports",
          "depends_on",
        ])
          expect(data[field]).toBeUndefined();
        expect(data.build.args.SOURCE_REVISION).toBe(revision);
        // Dockerfile разрешается от контекста, который отличается у legacy-video.
        expect(existsSync(resolve(data.build.context, data.build.dockerfile))).toBe(true);
      }
      expect(config.services.api.build.context).toBe(process.cwd());
      expect(config.services.web.build.context).toBe(process.cwd());
      expect(config.services.video.build.context).toBe(
        resolve("apps/video-service"),
      );
    });
    /** Платёжные flags default-off, выбранные публичные args относятся к web, не backend build. */
    it("keeps default payment flags off and explicitly forwards the chosen public build profile", () => {
      const baseline = render({ SOURCE_REVISION: revision });
      expect(
        baseline.services.web.build.args.NEXT_PUBLIC_PRODAMUS_TEST_ENABLED,
      ).toBe("false");
      expect(
        baseline.services.web.build.args
          .NEXT_PUBLIC_GUEST_CHECKOUT_RECOVERY_ENABLED,
      ).toBe("false");
      const selected = render({
        SOURCE_REVISION: revision,
        IMAGE_PREFIX: "registry.example.test/darcy",
        NEXT_PUBLIC_PRODAMUS_TEST_ENABLED: "true",
        NEXT_PUBLIC_VK_CATALOG_ENABLED: "true",
        NEXT_PUBLIC_VIDEO_THUMBNAILS_ENABLED: "true",
        NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED: "true",
      });
      expect(selected.services.web.image).toBe(
        `registry.example.test/darcy/web:${revision}`,
      );
      for (const key of [
        "NEXT_PUBLIC_PRODAMUS_TEST_ENABLED",
        "NEXT_PUBLIC_VK_CATALOG_ENABLED",
        "NEXT_PUBLIC_VIDEO_THUMBNAILS_ENABLED",
        "NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED",
      ])
        expect(selected.services.web.build.args[key]).toBe("true");
      expect(selected.services.api.build.args).toEqual({
        SOURCE_REVISION: revision,
      });
    });
    /** Image overlay меняет ровно два image refs, а снятие восстанавливает baseline. */
    it("changes only API/web image pins when appended to an accepted runtime", () => {
      const scratch = mkdtempSync(join(tmpdir(), "darcy-runtime-pins-"));
      try {
        for (const name of [
          "compose.yaml",
          "compose.release-images.example.yaml",
        ])
          copyFileSync(
            resolve("infrastructure/deploy/teamassist", name),
            join(scratch, name),
          );
        for (const name of ["empty.env", "api.env", "mysql.env"])
          writeFileSync(join(scratch, name), "", { mode: 0o600 });
        /** Читаем merge собственной temp-runtime конфигурации без up/run/pull. */
        const config = (pins: boolean) =>
          JSON.parse(
            execFileSync(
              "docker",
              [
                "compose",
                "--project-directory",
                scratch,
                "--env-file",
                join(scratch, "empty.env"),
                "-f",
                join(scratch, "compose.yaml"),
                ...(pins
                  ? ["-f", join(scratch, "compose.release-images.example.yaml")]
                  : []),
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
                  STAGING_IMAGE: "synthetic:baseline",
                  API_RUNTIME_IMAGE: `sha256:${"a".repeat(64)}`,
                  WEB_RUNTIME_IMAGE: `sha256:${"b".repeat(64)}`,
                },
              },
            ),
          );
        const before = config(false),
          after = config(true);
        const expected = structuredClone(before);
        expected.services.api.image = `sha256:${"a".repeat(64)}`;
        expected.services.web.image = `sha256:${"b".repeat(64)}`;
        expect(after).toEqual(expected);
        expect(config(false)).toEqual(before);
      } finally {
        rmSync(scratch, { recursive: true });
      }
    });
  },
);
