import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { promisify } from "node:util";
import { build } from "esbuild";
import assert from "node:assert/strict";

const execute = promisify(execFile);
export async function prepareBackupImage(root: string, directory: string) {
  // Проверяет digest, ревизию и отсутствие секретов в готовом образе; проба использует только неизменённый backup-код и namespace принадлежащей тесту БД.

  const image = process.env.BACKUP_REHEARSAL_IMAGE!;
  const expectedId = process.env.BACKUP_REHEARSAL_IMAGE_ID;
  const revision = process.env.BACKUP_REHEARSAL_REVISION;
  const bundleSha = process.env.BACKUP_REHEARSAL_BUNDLE_SHA;
  assert.match(expectedId ?? "", /^sha256:[a-f0-9]{64}$/);
  assert.match(revision ?? "", /^[a-f0-9]{40}$/);
  assert.match(bundleSha ?? "", /^[a-f0-9]{64}$/);
  const { stdout } = await execute("docker", ["image", "inspect", image]);
  const [metadata] = JSON.parse(stdout);
  assert.equal(metadata.Id, expectedId);
  assert.equal(metadata.Architecture, "amd64");
  assert.equal(metadata.Config.User, "node");
  assert.equal(
    metadata.Config.Labels["org.opencontainers.image.revision"],
    revision,
  );
  assert.equal(
    metadata.Config.Env.some((value: string) =>
      /^(DATABASE_URL|S3_|SMTP_)/.test(value),
    ),
    false,
  );
  // Only source-identical backup/ENV code may be bundled into the unchanged image.
  const diff = await execute(
    "git",
    [
      "diff",
      revision!,
      "--",
      "apps/backend/src/_core/backup.ts",
      "apps/backend/src/_core/env.ts",
    ],
    { cwd: root },
  );
  assert.equal(diff.stdout, "");
  // В образ монтируется только собранный probe; предварительный git diff запрещает подменить проверяемый backup/ENV другим исходником.
  const probe = join(directory, "image-backup-probe.mjs");
  await build({
    entryPoints: [join(root, "tests/helpers/backup-image-probe.ts")],
    bundle: true,
    platform: "node",
    packages: "external",
    format: "esm",
    outfile: probe,
  });
  return async (
    mode: "backup" | "restore" | "failed-backup",
    databaseId: string,
    uri: string,
    input?: Buffer,
  ) => {
    // The caller must run the canonical fixture ownership guard immediately before this.
    assert.match(databaseId, /^[a-f0-9]{64}$/);
    const url = new URL(uri);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.pathname, "/backend_test");
    url.port = "3306"; // Join exactly the guarded fixture's network namespace.
    const owner = `daryadarcy-backup-image-${randomUUID()}`;
    // Контейнер создаётся отдельно от запуска, чтобы известный ID оставался доступен точечной уборке при ошибке старта.
    const created = await execute("docker", [
      "create",
      "--pull=never",
      "--platform=linux/amd64",
      "--name",
      owner,
      "--label",
      `codex.owner=${owner}`,
      "--interactive",
      `--network=container:${databaseId}`,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--memory=256m",
      "--cpus=1",
      "--env",
      `DATABASE_URL=${url.href}`,
      "--env",
      `BACKUP_REHEARSAL_BUNDLE_SHA=${bundleSha}`,
      "--mount",
      `type=bind,src=${probe},dst=/app/backup-probe.mjs,readonly`,
      expectedId!,
      "node",
      "backup-probe.mjs",
      mode,
    ]);
    const id = created.stdout.trim();
    assert.match(id, /^[a-f0-9]{64}$/);
    try {
      const output = await new Promise<string>((resolve, reject) => {
        const child = spawn(
          "docker",
          ["start", "--attach", "--interactive", id],
          { stdio: ["pipe", "pipe", "pipe"], timeout: 60000 },
        );
        let output = "",
          diagnostics = "";
        child.stdout.setEncoding("utf8").on("data", (chunk) => {
          output += chunk;
        });
        child.stderr.setEncoding("utf8").on("data", (chunk) => {
          diagnostics += chunk;
        });
        child.stdin.on("error", () => {});
        child.stdin.end(input);
        child.once("error", () =>
          reject(new Error("Image probe could not start")),
        );
        child.once("close", (code) =>
          code === 0
            ? resolve(output)
            : reject(new Error(`Image probe failed: ${diagnostics}`)),
        );
      });
      const state = await execute("docker", [
        "inspect",
        id,
        "--format",
        "{{json .State}}",
      ]);
      assert.equal(JSON.parse(state.stdout).ExitCode, 0);
      assert.equal(JSON.parse(state.stdout).OOMKilled, false);
      assert.ok(output.includes('"uid":1000'));
      if (mode === "backup")
        await execute("docker", [
          "cp",
          `${id}:/app/backups`,
          join(directory, "backups"),
        ]);
      console.log(output.trim());
    // Перед удалением повторно сверяются ID, owner, image и namespace: чужой контейнер не считается тестовым по одному имени.
    } finally {
      const inspected = await execute("docker", [
        "inspect",
        id,
        "--format",
        '{"id":{{json .Id}},"name":{{json .Name}},"owner":{{json (index .Config.Labels "codex.owner")}},"image":{{json .Config.Image}},"network":{{json .HostConfig.NetworkMode}}}',
      ]);
      assert.deepEqual(JSON.parse(inspected.stdout), {
        id,
        name: `/${owner}`,
        owner,
        image: expectedId,
        network: `container:${databaseId}`,
      });
      await execute("docker", ["rm", "--force", id]);
    }
  };
}
