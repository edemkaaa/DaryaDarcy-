/** Настоящие detector workers проверяются по бинарным fixtures и собранному runtime, без хранения/внешней сети. */
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
import { pdfFixture, docxFixture, docxMime } from "./helpers/document-fixtures";
import { utf8Text, utf16beText } from "./helpers/text-fixtures";

/** MP3/MP4/WebM/WAV распознаются без изменения исходного Buffer. */
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

/** Невалидный файл не ломает соседние параллельные detector calls. */
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

/** ISO signature за пределами короткого prefix подтверждает поддержку random-access чтения. */
it("preserves random-access signature checks instead of sampling only a prefix", async () => {
  // The ISO signature is intentionally beyond the 4100-byte format prefix.
  const bytes = Buffer.alloc(3 * 65_536, 0x61);
  bytes.write("CD001", 32_769, "ascii");
  expect(await detectBinaryFileType(bytes)).toEqual({
    ext: "iso",
    mime: "application/x-iso9660-image",
  });
  expect(bytes.toString("ascii", 32_769, 32_774)).toBe("CD001");
});

/** Собранный модуль находит worker независимо от cwd; child получает пустой env. */
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

/** Тот же detector остаётся совместимым с dev require/tsx путём. */
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

/** Собранный документный policy различает PDF/DOCX/кодировки текста и отвергает MIME-подмену; временные bundles удаляются. */
it("applies document rejection and text/fallback policy from compiled ESM with real workers", async () => {
  const directory = mkdtempSync(resolve(".tmp-document-signature-"));
  const entry = join(directory, "policy.mjs");
  try {
    await build({
      entryPoints: [resolve("apps/backend/src/content/media-content-type.ts")],
      platform: "node",
      packages: "external",
      bundle: true,
      format: "esm",
      outfile: entry,
    });
    const inputs = [
      ["application/pdf", pdfFixture.toString("base64")],
      [docxMime, docxFixture.toString("base64")],
      [
        "application/pdf",
        Buffer.from("<html>not a PDF</html>").toString("base64"),
      ],
      [docxMime, pdfFixture.toString("base64")],
      ["text/plain", pdfFixture.toString("base64")],
      ["text/plain", utf8Text.toString("base64")],
      ["text/plain", Buffer.from([0xff, 0x41]).toString("base64")],
      ["application/octet-stream", pdfFixture.toString("base64")],
      ["application/octet-stream", utf16beText.toString("base64")],
      ["application/octet-stream", mp3Fixture.toString("base64")],
    ];
    const source = `import {resolveMediaContentType} from ${JSON.stringify(pathToFileURL(entry).href)};
      const results = await Promise.all(${JSON.stringify(inputs)}.map(async ([mime, base64]) => {
        try { return await resolveMediaContentType("document", mime, Buffer.from(base64, "base64")); }
        catch (error) { return {code: error.code}; }
      }));console.log(JSON.stringify(results));`;
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "-e", source],
      { cwd: tmpdir(), env: {}, encoding: "utf8", timeout: 10_000 },
    );
    expect(JSON.parse(output)).toEqual([
      "application/pdf",
      docxMime,
      { code: "BAD_REQUEST" },
      { code: "BAD_REQUEST" },
      { code: "BAD_REQUEST" },
      "text/plain; charset=utf-8",
      { code: "BAD_REQUEST" },
      "application/pdf",
      "text/plain; charset=utf-16be",
      { code: "BAD_REQUEST" },
    ]);
  } finally {
    rmSync(entry, { force: true });
    rmdirSync(directory);
  }
});
