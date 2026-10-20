import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

it.skipIf(process.env.PRIVATE_UPLOADS_COMPOSE_ACCEPTANCE !== "true")(
  "adds S3 only to API without giving API general egress or changing existing services",
  () => {
    const directory = mkdtempSync(join(tmpdir(), "darcy-upload-compose-"));
    try {
      for (const name of ["compose.yaml", "compose.private-uploads.yaml"])
        copyFileSync(
          resolve("infrastructure/deploy/teamassist", name),
          join(directory, name),
        );
      for (const name of ["mysql.env", "api.env"])
        writeFileSync(join(directory, name), "", { mode: 0o600 });
      writeFileSync(
        join(directory, "private-uploads.env"),
        "S3_ENDPOINT=https://s3.twcstorage.ru\nS3_BUCKET=synthetic-fixture\nPRIVATE_CONTENT_FILES_ENABLED=false\n",
        { mode: 0o600 },
      );
      const config = (enabled: boolean) =>
        JSON.parse(
          execFileSync(
            "docker",
            [
              "compose",
              "--project-directory",
              directory,
              "-f",
              join(directory, "compose.yaml"),
              ...(enabled
                ? ["-f", join(directory, "compose.private-uploads.yaml")]
                : []),
              "config",
              "--format",
              "json",
            ],
            {
              encoding: "utf8",
              env: {
                PATH: process.env.PATH,
                HOME: process.env.HOME,
                STAGING_IMAGE: "synthetic:baseline",
              },
            },
          ),
        );
      const before = config(false),
        after = config(true);
      expect(after.services.api.networks).toEqual(before.services.api.networks);
      expect(after.networks.isolated.internal).toBe(true);
      expect(after.services.api.environment.S3_ENDPOINT).toBe(
        "https://s3.twcstorage.ru",
      );
      expect(after.services.api.environment.PRIVATE_CONTENT_FILES_ENABLED).toBe(
        "false",
      );
      for (const service of ["web", "mysql", "edge"])
        expect(after.services[service]).toEqual(before.services[service]);
      const proxy = after.services["s3-egress"];
      expect(proxy.networks.isolated.aliases).toEqual(["s3.twcstorage.ru"]);
      expect(Object.keys(proxy.networks).sort()).toEqual([
        "isolated",
        "s3-egress",
      ]);
      expect(proxy.ports).toBeUndefined();
      expect(proxy.read_only).toBe(true);
      expect(proxy.cap_drop).toEqual(["ALL"]);
      expect(proxy.user).toBe("101:101");
      expect(proxy.environment).toBeUndefined();
      expect(config(false)).toEqual(before);
    } finally {
      rmSync(directory, { recursive: true });
    }
  },
);
