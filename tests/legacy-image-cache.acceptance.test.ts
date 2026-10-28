import { expect, it } from "vitest";
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import sharp from "sharp";
import type { NextConfigRuntime } from "next/dist/server/config-shared";

// Explicit post-build operator gate. It never contacts a real upstream or SQL.
it.skipIf(process.env.LEGACY_IMAGE_CACHE_ACCEPTANCE !== "true")(
  "blocks cold and real warm optimizer responses before serving bytes, preserving public controls",
  async () => {
    const root = process.cwd();
    const build = resolve("apps/frontend/.next");
    const metadata = JSON.parse(
      await readFile(join(build, "required-server-files.json"), "utf8"),
    );
    const scratch = await mkdtemp(join(tmpdir(), "darcy-image-cache-gate-"));
    let child: ChildProcess | undefined;
    let base = "";
    let output = "";
    const networkLog = join(scratch, "outbound.log");
    const stop = async () => {
      if (!child || child.exitCode !== null || child.signalCode !== null)
        return;
      const done = once(child, "exit");
      child.kill("SIGTERM");
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        done,
        new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            child?.kill("SIGKILL");
            resolve();
          }, 5000);
        }),
      ]);
      clearTimeout(timer);
      await done;
    };
    try {
      await cp(build, join(scratch, ".next"), {
        recursive: true,
        filter: (path) => path !== join(build, "cache"),
      });
      await cp(
        resolve("apps/frontend/next.config.mjs"),
        join(scratch, "next.config.mjs"),
      );
      await writeFile(join(scratch, "package.json"), '{"private":true}');
      await symlink(resolve("node_modules"), join(scratch, "node_modules"));
      // Deny every outbound HTTP/DNS call in the child, including an accidental
      // real S3 cache miss. Parent requests use only the child's numeric loopback.
      const preload = join(scratch, "no-network.cjs");
      await writeFile(
        preload,
        `
        const fs=require('node:fs');
        function denied(){fs.appendFileSync(${JSON.stringify(networkLog)},'attempt\\n');throw new Error('External network forbidden by acceptance fixture');}
        for(const name of ['node:http','node:https']){const mod=require(name);mod.request=denied;mod.get=denied;}
        const dns=require('node:dns');
        function literal(host,opts){if(!['127.0.0.1','::1'].includes(host))return denied();const item={address:host,family:host==='::1'?6:4};return opts?.all?[item]:item;}
        dns.lookup=(host,opts,callback)=>{if(typeof opts==='function'){callback=opts;opts={};}const value=literal(host,opts);queueMicrotask(()=>Array.isArray(value)?callback(null,value):callback(null,value.address,value.family));};
        dns.promises.lookup=async(host,opts)=>literal(host,opts);
      `,
      );
      const namespace = "feed/acceptance-" + scratch.split("-").at(-1);
      const origin = "https://s3.twcstorage.ru/daryadarcy-s3/";
      const warmKey = namespace + "/warm.jpg";
      const coldKey = namespace + "/cold.jpg";
      const publicKeys = [
        namespace + "/cover.jpg",
        namespace + "/free.jpg",
        namespace + "/unrelated.jpg",
      ];
      const bytes = await sharp({
        create: { width: 640, height: 360, channels: 3, background: "#886644" },
      })
        .webp()
        .toBuffer();
      const manifest = join(scratch, "manifest.json");
      const manifestBytes = JSON.stringify({
        version: 1,
        endpoint: "https://s3.twcstorage.ru",
        bucket: "daryadarcy-s3",
        denyKeys: [warmKey, coldKey],
        preservedKeys: publicKeys.slice(0, 2),
      });
      await writeFile(manifest, manifestBytes, { mode: 0o600 });
      const digest = createHash("sha256").update(manifestBytes).digest("hex");
      const { ImageOptimizerCache } =
        await import("next/dist/server/image-optimizer");
      const { CachedRouteKind } =
        await import("next/dist/server/response-cache");
      const cache = new ImageOptimizerCache({
        distDir: join(scratch, ".next"),
        nextConfig: metadata.config as NextConfigRuntime,
      });
      const key = (href: string) =>
        ImageOptimizerCache.getCacheKey({
          href,
          width: 640,
          quality: 75,
          mimeType: "image/webp",
        });
      for (const source of [warmKey, ...publicKeys]) {
        await cache.set(
          key(origin + source),
          {
            kind: CachedRouteKind.IMAGE,
            buffer: bytes,
            extension: "webp",
            etag: "acceptance",
            upstreamEtag: "synthetic",
          },
          { cacheControl: { revalidate: 3600, expire: undefined } },
        );
        expect((await cache.get(key(origin + source)))?.value).toMatchObject({
          buffer: bytes,
        });
      }
      expect(await cache.get(key(origin + coldKey))).toBeNull();
      const publicDirectory = join(scratch, "public/assets/responsive");
      await mkdir(publicDirectory, { recursive: true });
      await writeFile(join(publicDirectory, "acceptance-free.webp"), bytes);
      const imagePath = (source: string) =>
        "/_next/image?" +
        new URLSearchParams({ url: source, w: "640", q: "75" });
      const image = async (
        source: string,
        headers: Record<string, string> = {},
      ) => {
        const response = await fetch(base + imagePath(source), {
          headers: { Accept: "image/webp", ...headers },
          signal: AbortSignal.timeout(5000),
        });
        return {
          status: response.status,
          cache: response.headers.get("x-nextjs-cache"),
          control: response.headers.get("cache-control"),
          etag: response.headers.get("etag"),
          body: Buffer.from(await response.arrayBuffer()),
        };
      };
      const start = async (enabled: boolean, hash = digest) => {
        const reservation = createServer();
        await new Promise<void>((r) => reservation.listen(0, "127.0.0.1", r));
        const port = (reservation.address() as import("node:net").AddressInfo)
          .port;
        await new Promise<void>((r) => reservation.close(() => r()));
        base = "http://127.0.0.1:" + port;
        output = "";
        child = spawn(
          process.execPath,
          [
            "--require",
            preload,
            resolve("node_modules/next/dist/bin/next"),
            "start",
            scratch,
            "--hostname",
            "127.0.0.1",
            "--port",
            String(port),
          ],
          {
            cwd: scratch,
            stdio: ["ignore", "pipe", "pipe"],
            env: {
              PATH: process.env.PATH,
              NODE_ENV: "production",
              NEXT_TELEMETRY_DISABLED: "1",
              ...metadata.config.env,
              LEGACY_CLUB_IMAGE_GUARD_ENABLED: String(enabled),
              LEGACY_CLUB_IMAGE_MANIFEST_PATH: manifest,
              LEGACY_CLUB_IMAGE_MANIFEST_SHA256: hash,
            },
          },
        );
        for (const stream of [child.stdout, child.stderr])
          stream?.on("data", (chunk) => {
            output = (output + chunk).slice(-16000);
          });
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          if (child.exitCode !== null)
            throw new Error("Owned Next process exited: " + output);
          try {
            const r = await fetch(base + "/", {
              signal: AbortSignal.timeout(500),
            });
            await r.body?.cancel();
            if (r.status === 200) return;
          } catch {}
          await new Promise((r) => setTimeout(r, 50));
        }
        throw new Error("Owned Next process was not ready: " + output);
      };
      await start(false);
      const warm = await image(origin + warmKey);
      expect(warm).toMatchObject({ status: 200, cache: "HIT", body: bytes });
      await stop();
      await start(true);
      let denials = 0;
      for (const cookie of [
        "",
        "session=synthetic-member",
        "session=synthetic-admin",
      ]) {
        for (const source of [
          origin + warmKey,
          origin + coldKey,
          encodeURIComponent(origin + warmKey),
          encodeURIComponent(encodeURIComponent(origin + warmKey)),
          origin.replace("s3.twcstorage.ru", "S3.TWCSTORAGE.RU:443") + warmKey,
        ]) {
          const r = await image(source, { Cookie: cookie });
          expect(r).toMatchObject({
            status: 404,
            control: "private, no-store",
          });
          expect(r.body.equals(bytes)).toBe(false);
          denials++;
        }
      }
      const conditionalHeaders: Record<string, string>[] = [
        { "If-None-Match": warm.etag! },
        { Range: "bytes=0-10" },
      ];
      for (const headers of conditionalHeaders) {
        expect(await image(origin + warmKey, headers)).toMatchObject({
          status: 404,
          control: "private, no-store",
        });
        denials++;
      }
      for (const source of publicKeys)
        expect(await image(origin + source)).toMatchObject({
          status: 200,
          cache: "HIT",
          body: bytes,
        });
      const free = "/assets/responsive/acceptance-free.webp";
      expect(await image(free)).toMatchObject({ status: 200, cache: "MISS" });
      expect(await image(free)).toMatchObject({ status: 200, cache: "HIT" });
      expect(await cache.get(key(origin + coldKey))).toBeNull();
      await stop();
      await start(true, "0".repeat(64));
      expect(await image(origin + warmKey)).toMatchObject({
        status: 503,
        control: "private, no-store",
      });
      await expect(readFile(networkLog, "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
      process.stdout.write(
        JSON.stringify({
          gate: "legacy-image-cache",
          buildId: (await readFile(join(build, "BUILD_ID"), "utf8")).trim(),
          warmHitBeforeGuard: true,
          denials,
          publicControls: 5,
          invalidManifest: 503,
          externalNetworkAttempts: 0,
        }) + "\n",
      );
    } finally {
      await stop();
      await rm(scratch, { recursive: true, force: true });
    }
  },
  35_000,
);
