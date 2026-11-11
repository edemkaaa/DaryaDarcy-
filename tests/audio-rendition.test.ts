/** Опциональная офлайн приёмка FFmpeg/ffprobe создаёт собственный ALAC tone и совместимую AAC копию, не трогая S3. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const available = ["ffmpeg", "ffprobe"].every(
  (bin) => spawnSync(bin, ["-version"]).status === 0,
);
const script = resolve("tooling/operations/prepare-audio-rendition.ts");
/** Независимо хешируем bytes исходника/rendition для проверки неизменности и receipt. */
const sha = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
/** Набор пропускается без установленных ffmpeg/ffprobe; наличие файла само по себе не доказывает декодирование. */
describe.skipIf(!available)(
  "offline browser-compatible audio preparation",
  () => {
    let root: string;
    let source: string;
    let sequence = 0;
    /** В собственной temp-папке генерируем3сек синтетического ALAC, без реальной записи пользователя. */
    beforeAll(() => {
      root = mkdtempSync(join(tmpdir(), "daryadarcy-audio-"));
      source = join(root, "original.m4a");
      const fixture = spawnSync(
        "ffmpeg",
        [
          "-nostdin",
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=523:sample_rate=48000",
          "-t",
          "3",
          "-c:a",
          "alac",
          source,
        ],
        { timeout: 10000 },
      );
      expect(fixture.status, fixture.stderr?.toString()).toBe(0);
    });
    /** Удаляем только owned audio fixture tree. */
    afterAll(() => {
      if (root) rmSync(root, { recursive: true });
    });
    /** Каждый сценарий получает новый private0700 output directory. */
    const output = () => {
      const directory = join(root, `output-${++sequence}`);
      mkdirSync(directory, { mode: 0o700 });
      return directory;
    };
    /** Запускаем настоящий операторский CLI с локальными путями, timeout и ограниченным выводом. */
    const run = (input: string, directory: string) =>
      spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          script,
          "--input",
          input,
          "--output-dir",
          directory,
        ],
        { encoding: "utf8", timeout: 15000, maxBuffer: 128000 },
      );

    /** Проверяем AAC-LC codec, duration, moov перед mdat, реальные ненулевые PCM bytes и hashes обеих версий. */
    it("creates decodable AAC-LC with startup metadata first and preserves the ALAC original", () => {
      const originalHash = sha(source);
      const directory = output();
      const result = run(source, directory);
      expect(result.status, result.stderr).toBe(0);
      const receipt = JSON.parse(result.stdout);
      expect(receipt.sourceSha256).toBe(originalHash);
      expect(receipt.mimeType).toBe("audio/mp4");
      expect(sha(source)).toBe(originalHash);
      const file = join(directory, receipt.filename);
      expect(sha(file)).toBe(receipt.sha256);
      const probe = spawnSync(
        "ffprobe",
        ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
        { encoding: "utf8" },
      );
      expect(probe.status).toBe(0);
      const metadata = JSON.parse(probe.stdout);
      expect(metadata.streams).toHaveLength(1);
      expect(metadata.streams[0]).toMatchObject({
        codec_name: "aac",
        profile: "LC",
        codec_type: "audio",
        channels: 1,
      });
      expect(Number(metadata.format.duration)).toBeCloseTo(3, 1);
      const bytes = readFileSync(file);
      const atoms: string[] = [];
      for (let offset = 0; offset < bytes.length; ) {
        const size = bytes.readUInt32BE(offset);
        expect(size).toBeGreaterThanOrEqual(8);
        atoms.push(bytes.subarray(offset + 4, offset + 8).toString("ascii"));
        offset += size;
      }
      expect(atoms.indexOf("moov")).toBeGreaterThanOrEqual(0);
      expect(atoms.indexOf("moov")).toBeLessThan(atoms.indexOf("mdat"));
      const decoded = spawnSync(
        "ffmpeg",
        ["-nostdin", "-v", "error", "-i", file, "-f", "s16le", "pipe:1"],
        { maxBuffer: 500000 },
      );
      expect(decoded.status).toBe(0);
      expect(decoded.stdout.length).toBeGreaterThan(280000);
      expect(decoded.stdout.some((value) => value !== 0)).toBe(true);
      expect(readdirSync(directory)).toEqual([receipt.filename]);
    });

    /** Повторное имя назначения не разрешает перезаписать готовую копию или original. */
    it("refuses to overwrite an existing rendition and leaves both files unchanged", () => {
      const directory = output();
      const first = run(source, directory);
      expect(first.status, first.stderr).toBe(0);
      const receipt = JSON.parse(first.stdout);
      const before = sha(join(directory, receipt.filename));
      const originalHash = sha(source);
      const second = run(source, directory);
      expect(second.status).not.toBe(0);
      expect(sha(join(directory, receipt.filename))).toBe(before);
      expect(sha(source)).toBe(originalHash);
      expect(readdirSync(directory)).toEqual([receipt.filename]);
    });

    /** Повреждённый local input не оставляет output и не меняется. */
    it("rejects a non-audio input before leaving output files", () => {
      const input = join(root, "not-audio.m4a");
      writeFileSync(input, "This is not an audio recording");
      const directory = output();
      expect(run(input, directory).status).not.toBe(0);
      expect(readdirSync(directory)).toEqual([]);
      expect(readFileSync(input, "utf8")).toBe(
        "This is not an audio recording",
      );
    });

    /** Symlink не расширяет разрешённую область чтения/записи. */
    it("rejects symlink sources and symlink output directories", () => {
      const alias = join(root, "alias.m4a");
      symlinkSync(source, alias);
      const directory = output();
      expect(run(alias, directory).status).not.toBe(0);
      const directoryAlias = join(root, "output-alias");
      symlinkSync(directory, directoryAlias);
      expect(run(source, directoryAlias).status).not.toBe(0);
      expect(readdirSync(directory)).toEqual([]);
    });

    /** CLI не скачивает URL и не создаёт отсутствующую output папку. */
    it("does not accept remote URLs or create an unrequested output directory", () => {
      const directory = output();
      expect(
        run("https://example.invalid/recording.m4a", directory).status,
      ).not.toBe(0);
      const absent = join(root, "absent");
      expect(run(source, absent).status).not.toBe(0);
      expect(existsSync(absent)).toBe(false);
      expect(readdirSync(directory)).toEqual([]);
    });

    /** Публичные0755 права запрещены для временной подготовки закрытого материала. */
    it("requires a private output directory", () => {
      const directory = output();
      chmodSync(directory, 0o755);
      expect(run(source, directory).status).not.toBe(0);
      expect(readdirSync(directory)).toEqual([]);
    });
  },
);
