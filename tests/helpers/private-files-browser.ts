import { cp, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { chromium, type Browser } from "@playwright/test";

/** Unchanged Next rewrite in an owned copy: no .env reads or generated files
 * written back into the frontend owner's checkout. Not a UI/player acceptance. */
export async function privateFilesBrowser(api: string) {
  const root = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
  const temp = await mkdtemp(join(tmpdir(), "daryadarcy-ag2-browser-"));
  let child: ChildProcess | undefined, browser: Browser | undefined;
  async function close() {
    await browser?.close();
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      process.kill(-child.pid, "SIGTERM");
      const timer = setTimeout(() => {
        if (child?.pid && child.exitCode === null && child.signalCode === null)
          process.kill(-child.pid, "SIGKILL");
      }, 5000);
      try {
        await exited;
      } finally {
        clearTimeout(timer);
      }
    }
    if (!basename(temp).startsWith("daryadarcy-ag2-browser-"))
      throw new Error("Temporary scope changed");
    await rm(temp, { recursive: true, force: true });
  }
  try {
    const directory = join(temp, "apps", "frontend");
    await mkdir(directory, { recursive: true });
    for (const name of [
      "src",
      "package.json",
      "next.config.mjs",
      "tsconfig.json",
      "AGENTS.md",
    ])
      await cp(join(root, "apps", "frontend", name), join(directory, name), {
        recursive: true,
        filter: (source) => !basename(source).startsWith(".env"),
      });
    await mkdir(join(directory, "public"));
    await cp(
      join(root, "apps/frontend/public/privacy.html"),
      join(directory, "public/privacy.html"),
    );
    await symlink(join(root, "node_modules"), join(temp, "node_modules"));
    await symlink(join(root, "packages"), join(temp, "packages"));
    const reservation = createServer();
    reservation.listen(0, "127.0.0.1");
    await once(reservation, "listening");
    const port = (reservation.address() as { port: number }).port;
    await new Promise<void>((resolve) => reservation.close(() => resolve()));
    const origin = `http://127.0.0.1:${port}`;
    child = spawn(
      process.execPath,
      [
        join(root, "node_modules/next/dist/bin/next"),
        "dev",
        "--webpack",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        cwd: directory,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        // Never inherit S3 credentials, DB or provider settings into Next.
        env: {
          PATH: process.env.PATH!,
          NODE_ENV: "development",
          API_PROXY_TARGET: api,
          NEXT_TELEMETRY_DISABLED: "1",
        },
      },
    );
    let output = "";
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(new Error(`Next readiness timeout: ${output.slice(-2000)}`)),
        30000,
      );
      const data = (chunk: Buffer) => {
        output = (output + chunk.toString()).slice(-4000);
        if (/Ready in/.test(output)) {
          clearTimeout(timeout);
          resolve();
        }
      };
      child!.stdout!.on("data", data);
      child!.stderr!.on("data", data);
      child!.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child!.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Next exited ${code}: ${output}`));
      });
    });
    browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
        : {}),
    });
    const context = await browser.newContext();
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    await page.goto(`${origin}/privacy.html`);
    return {
      context,
      origin,
      close,
      read: (id: number, range?: string) =>
        page.evaluate(
          async ({ id, range }) => {
            const response = await fetch(`/api/media/post-attachments/${id}`, {
              credentials: "same-origin",
              headers: range ? { Range: range } : {},
            });
            return {
              status: response.status,
              body: await response.text(),
              cache: response.headers.get("cache-control"),
              range: response.headers.get("content-range"),
            };
          },
          { id, range },
        ),
    };
  } catch (error) {
    await close();
    throw error;
  }
}
