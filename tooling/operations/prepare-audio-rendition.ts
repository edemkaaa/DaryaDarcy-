// Готовит отдельную совместимую аудиокопию с проверкой исходника и результата. Оригинал сохраняется; обновление привязки выполняется отдельным оператором.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createReadStream,
  closeSync,
  lstatSync,
  openSync,
  readSync,
} from "node:fs";
import { chmod, lstat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { audioRenditionBitrate } from "../data/audio-rendition-policy";

const execute = promisify(execFile);
const probeSchema = z.object({
  streams: z
    .array(
      z.object({
        codec_name: z.string(),
        codec_type: z.literal("audio"),
        channels: z.number().int().min(1).max(2),
        profile: z.string().optional(),
      }),
    )
    .length(1),
  format: z.object({ duration: z.string().regex(/^\d+(?:\.\d+)?$/) }),
});

async function hash(path: string) {
  // Потоково считает SHA-256 локального аудио, не загружая подкаст целиком в память.

  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

async function probe(path: string) {
  // Запускает ffprobe только с file/pipe и проверяет одну моно/стереодорожку и допустимую длительность.

  let stdout: string;
  try {
    ({ stdout } = await execute(
      "ffprobe",
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-show_entries",
        "stream=codec_name,codec_type,profile,channels:format=duration",
        "-of",
        "json",
        path,
      ],
      { timeout: 15000, maxBuffer: 64000 },
    ));
  } catch {
    throw new Error("Audio inspection failed");
  }
  const parsed = probeSchema.safeParse(JSON.parse(stdout));
  assert(parsed.success, "A single mono/stereo audio track is required");
  const duration = Number(parsed.data.format.duration);
  assert(
    Number.isFinite(duration) && duration > 0 && duration <= 14400,
    "Invalid audio duration",
  );
  return { ...parsed.data.streams[0], duration };
}

// Inspect only atom headers; never buffer a complete podcast in memory.
function hasFastStart(path: string, size: number) {
  // Читает заголовки MP4-атомов и проверяет moov до mdat, не буферизуя весь файл.

  const fd = openSync(path, "r");
  try {
    let seenMoov = false;
    for (let offset = 0; offset + 8 <= size; ) {
      const header = Buffer.alloc(8);
      if (readSync(fd, header, 0, 8, offset) !== 8) return false;
      const length = header.readUInt32BE(0);
      const type = header.subarray(4, 8).toString("ascii");
      if (length < 8 || offset + length > size) return false;
      if (type === "moov") seenMoov = true;
      if (type === "mdat") return seenMoov;
      offset += length;
    }
    return false;
  } finally {
    closeSync(fd);
  }
}

/** Offline operator only: no URL fetching, credentials, DB writes or runtime jobs. */
async function prepareAudioRendition(input: string, outputDirectory: string) {
  // Создаёт отдельный AAC-LC faststart без перезаписи, затем сверяет кодек, размер, длительность и неизменность исходника.

  assert(
    isAbsolute(input) && isAbsolute(outputDirectory),
    "Explicit absolute local paths required",
  );
  const source = resolve(input);
  const directory = resolve(outputDirectory);
  const before = await lstat(source);
  const destination = await lstat(directory);
  assert(
    before.isFile() && !before.isSymbolicLink(),
    "Regular non-symlink source required",
  );
  assert(
    before.size > 0 && before.size <= 256 * 1024 * 1024,
    "Offline source exceeds preparation bound",
  );
  assert(
    destination.isDirectory() &&
      !destination.isSymbolicLink() &&
      destination.uid === process.getuid?.() &&
      (destination.mode & 0o077) === 0,
    "Private owned output directory required",
  );
  const sourceSha256 = await hash(source);
  const sourceMetadata = await probe(source);
  const bitrate = audioRenditionBitrate(sourceMetadata.duration);
  assert(
    ["alac", "aac", "mp3"].includes(sourceMetadata.codec_name),
    "Unsupported source audio codec",
  );
  const filename = `audio-${sourceSha256}.aac.m4a`;
  const output = join(directory, filename);
  assert(
    !lstatSync(output, { throwIfNoEntry: false }),
    "Rendition already exists; refusing overwrite",
  );
  try {
    await execute(
      "ffmpeg",
      [
        "-nostdin",
        "-hide_banner",
        "-v",
        "error",
        "-n",
        "-threads",
        "1",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        source,
        "-map",
        "0:a:0",
        "-vn",
        "-sn",
        "-dn",
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
        "-c:a",
        "aac",
        "-profile:a",
        "aac_low",
        "-b:a",
        `${bitrate}k`,
        "-movflags",
        "+faststart",
        "-f",
        "ipod",
        output,
      ],
      { timeout: 120000, maxBuffer: 64000 },
    );
  } catch {
    // Leave any own partial file for inspection; never broaden cleanup to a directory.
    throw new Error("Audio encoding failed; no rendition approved");
  }
  await chmod(output, 0o600);
  const metadata = await probe(output);
  const after = await lstat(source);
  const result = await lstat(output);
  assert(
    before.dev === after.dev &&
      before.ino === after.ino &&
      before.size === after.size &&
      before.mtimeMs === after.mtimeMs &&
      (await hash(source)) === sourceSha256,
    "Source changed during preparation; no rendition approved",
  );
  assert(
    metadata.codec_name === "aac" &&
      metadata.profile === "LC" &&
      metadata.channels === sourceMetadata.channels &&
      Math.abs(metadata.duration - sourceMetadata.duration) < 0.2 &&
      result.size > 0 &&
      result.size <= 32 * 1024 * 1024 &&
      hasFastStart(output, result.size),
    "Invalid browser audio rendition",
  );
  return {
    recipe: `aac-lc-${bitrate}k-faststart-v1`,
    filename,
    mimeType: "audio/mp4",
    sourceSha256,
    sourceBytes: before.size,
    sourceCodec: sourceMetadata.codec_name,
    sha256: await hash(output),
    fileSize: result.size,
    duration: metadata.duration,
  };
}

async function main() {
  // Принимает только два абсолютных локальных пути, печатает квитанцию проверенной копии и не обращается к БД или S3.

  const args = process.argv.slice(2);
  try {
    assert(
      args.length === 4 && args[0] === "--input" && args[2] === "--output-dir",
      "Usage: --input /absolute/source --output-dir /private/existing/directory",
    );
    console.log(JSON.stringify(await prepareAudioRendition(args[1], args[3])));
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Audio preparation failed",
    );
    process.exitCode = 1;
  }
}
void main();
