import { build } from "esbuild";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";

/** Two fresh compiled Node processes, no dotenv/listeners/jobs from production boot. */
export async function privateAttachmentProcesses() {
  const root = new URL("../../", import.meta.url).pathname;
  const directory = await mkdtemp(join(tmpdir(), "daryadarcy-ag4-process-"));
  const active = new Set<ChildProcess>();
  const source = `
    import { createBackendApplication } from ${JSON.stringify(join(root, "apps/backend/src/_core/application.ts"))};
    import { getDb } from ${JSON.stringify(join(root, "apps/backend/src/db.ts"))};
    import { S3Client } from '@aws-sdk/client-s3';
    const send = S3Client.prototype.send;
    S3Client.prototype.send = function(...args) {
      process.stdout.write(JSON.stringify({event:'s3',command:args[0].constructor.name})+'\\n');
      return Reflect.apply(send,this,args);
    };
    const app=await createBackendApplication(); await app.listen(0,'127.0.0.1');
    process.stdout.write(JSON.stringify({event:'ready',port:app.getHttpServer().address().port})+'\\n');
    process.stdin.once('data',async () => { await app.close(); const db=await getDb(); await db?.$client.end(); process.exit(0); });
  `;
  try {
    await symlink(join(root, "node_modules"), join(directory, "node_modules"));
    await build({
      stdin: {
        contents: source,
        resolveDir: root,
        loader: "ts",
        sourcefile: "ag4-owned-process.ts",
      },
      outfile: join(directory, "api.mjs"),
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
      logLevel: "silent",
    });
    async function start(
      options: {
        contentFiles?: boolean;
        privateVideos?: boolean;
        appOrigin?: string;
      } = {},
    ) {
      const env: Record<string, string> = {
        PATH: process.env.PATH!,
        NODE_ENV: "test",
        JWT_SECRET: process.env.JWT_SECRET!,
        DATABASE_URL: process.env.BACKEND_TEST_DATABASE_URL!,
        PRIVATE_POST_MEDIA_UPLOAD_ENABLED: "true",
        PRIVATE_POST_MEDIA_DELIVERY_ENABLED: "true",
        PRIVATE_CONTENT_FILES_ENABLED: options.contentFiles ? "true" : "false",
        PRIVATE_POST_VIDEO_UPLOAD_ENABLED: options.privateVideos
          ? "true"
          : "false",
      };
      if (options.appOrigin) {
        const origin = new URL(options.appOrigin);
        if (
          origin.protocol !== "http:" ||
          origin.hostname !== "127.0.0.1" ||
          !origin.port ||
          origin.origin !== options.appOrigin
        )
          throw new Error("Owned browser origin required");
        env.PUBLIC_APP_URL = origin.origin;
      }
      for (const name of [
        "S3_ENDPOINT",
        "S3_BUCKET",
        "S3_ACCESS_KEY",
        "S3_SECRET_KEY",
      ])
        env[name] = process.env[name]!;
      const child = spawn(process.execPath, [join(directory, "api.mjs")], {
        cwd: directory,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      active.add(child);
      const commands: string[] = [];
      let buffer = "",
        stderr = "";
      child.stderr!.on("data", (chunk) => {
        stderr = (stderr + chunk.toString()).slice(-1500);
      });
      const port = await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Owned API startup timeout")),
          15000,
        );
        child.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`Owned API startup exit ${code}: ${stderr}`));
        });
        child.stdout!.on("data", (chunk) => {
          buffer += chunk.toString();
          for (;;) {
            const boundary = buffer.indexOf("\n");
            if (boundary < 0) break;
            const line = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 1);
            try {
              const event = JSON.parse(line);
              if (event.event === "s3") commands.push(event.command);
              if (
                event.event === "ready" &&
                Number.isInteger(event.port) &&
                event.port > 0 &&
                event.port < 65536
              ) {
                clearTimeout(timer);
                resolve(event.port);
              }
            } catch {
              /* Only the owned JSON events are protocol. */
            }
          }
        });
      });
      return {
        base: `http://127.0.0.1:${port}`,
        pid: child.pid!,
        commands,
        stop: async () => {
          if (!active.has(child)) return;
          const exited = once(child, "exit");
          child.stdin!.end("close\n");
          const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
          try {
            await exited;
          } finally {
            clearTimeout(timer);
            active.delete(child);
          }
        },
      };
    }
    return {
      start,
      close: async () => {
        for (const child of active) {
          if (child.exitCode === null && child.signalCode === null) {
            const exited = once(child, "exit");
            child.kill("SIGKILL");
            await exited;
          }
        }
        if (!basename(directory).startsWith("daryadarcy-ag4-process-"))
          throw new Error("Owned process directory mismatch");
        await rm(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (basename(directory).startsWith("daryadarcy-ag4-process-"))
      await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
