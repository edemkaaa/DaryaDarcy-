import { expect, it } from "vitest";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { detectBinaryFileType } from "../apps/backend/src/media/file-signature";
import {
  mp3Fixture,
  mp4Fixture,
  audioWebmFixture,
  wavFixture,
} from "./helpers/media-fixtures";

it.each([
  ["MP3", mp3Fixture, "mp3", "audio/mpeg"],
  ["MP4", mp4Fixture, "mp4", "video/mp4"],
  ["audio WebM", audioWebmFixture, "webm", "video/webm"],
  ["WAV", wavFixture(), "wav", "audio/wav"],
] as const)(
  "detects %s without changing storage bytes",
  async (_name, bytes, ext, mime) => {
    const original = Buffer.from(bytes);
    expect(await detectBinaryFileType(bytes)).toEqual({ ext, mime });
    expect(bytes).toEqual(original);
  },
);

it("recovers after malformed parser input and keeps concurrent results independent", async () => {
  const results = await Promise.all([
    detectBinaryFileType(Buffer.from("0000001866747970", "hex")),
    detectBinaryFileType(mp3Fixture),
    detectBinaryFileType(wavFixture()),
  ]);
  expect(results).toEqual([
    undefined,
    { ext: "mp3", mime: "audio/mpeg" },
    { ext: "wav", mime: "audio/wav" },
  ]);
});

it("runs the external detector from compiled ESM in a foreign working directory", async () => {
  const directory = mkdtempSync(resolve(".tmp-media-signature-"));
  const entry = join(directory, "signature.mjs");
  try {
    await build({
      entryPoints: [resolve("apps/backend/src/media/file-signature.ts")],
      platform: "node",
      packages: "external",
      bundle: true,
      format: "esm",
      outfile: entry,
    });
    const source = `import {detectBinaryFileType} from ${JSON.stringify(pathToFileURL(entry).href)};
      console.log(JSON.stringify(await detectBinaryFileType(Buffer.from(${JSON.stringify(mp3Fixture.toString("base64"))}, "base64"))));`;
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "-e", source],
      {
        cwd: tmpdir(),
        env: {},
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    expect(JSON.parse(output)).toEqual({ ext: "mp3", mime: "audio/mpeg" });
  } finally {
    rmSync(entry, { force: true });
    rmdirSync(directory);
  }
});

it("runs the same detector under the existing CommonJS/tsx development runtime", () => {
  const script = `const { detectBinaryFileType } = require(${JSON.stringify(resolve("apps/backend/src/media/file-signature.ts"))});
    detectBinaryFileType(Buffer.from(${JSON.stringify(mp3Fixture.toString("base64"))}, "base64")).then(result => console.log(JSON.stringify(result)));`;
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "-e", script],
    {
      cwd: resolve("apps/backend"),
      env: {},
      encoding: "utf8",
      timeout: 10_000,
    },
  );
  expect(JSON.parse(output)).toEqual({ ext: "mp3", mime: "audio/mpeg" });
});
