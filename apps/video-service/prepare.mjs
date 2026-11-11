// Подготавливает совместимый MP4 без перекодирования, ограничивая время, размер и дочерние процессы. URL выводится из проверенного ID, cookies и плагины загрузчика не используются.
import { spawn } from "node:child_process";
import { lstat, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

export function runCommand(binary, args, cwd, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      detached: true,
      stdio: ["ignore", "pipe", "ignore"],
      env: {
        PATH: process.env.PATH,
        HOME: "/tmp",
        TMPDIR: "/tmp",
        LANG: "C.UTF-8",
      },
    });
    let stdout = "";
    let failure;
    let killTimer;
    // Останавливаем всю группу, включая потомков FFmpeg, а не только процесс загрузчика.
    const killGroup = (kind) => {
      if (child.pid) {
        try {
          process.kill(-child.pid, kind);
        } catch {}
      }
    };
    const stop = (error) => {
      failure ||= error;
      killGroup("SIGTERM");
      killTimer ||= setTimeout(() => killGroup("SIGKILL"), 1000);
    };
    const onAbort = () => stop(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
    child.stdout.on("data", (chunk) => {
      if (stdout.length + chunk.length > 65536)
        stop(new Error("media command output limit"));
      else stdout += chunk.toString("utf8");
    });
    child.on("error", () => {
      failure ||= new Error("media command failed");
    });
    child.on("close", (code) => {
      clearTimeout(killTimer);
      signal.removeEventListener("abort", onAbort);
      // Include grandchildren: cancellation must not leave a merger running.
      killGroup("SIGKILL");
      if (failure || code !== 0)
        reject(failure || new Error("media command failed"));
      else resolve({ stdout });
    });
  });
}

export async function prepareVideo(
  id,
  directory,
  signal,
  command = runCommand,
) {
  if (!/^[\w-]{11}$/.test(id)) throw new Error("invalid video id");
  const budget = new AbortController();
  const workSignal = AbortSignal.any([signal, budget.signal]);
  // Лимит готового MP4 не ограничивает сумму промежуточных дорожек; рабочий каталог контролируется отдельно.
  const monitor = setInterval(async () => {
    try {
      let bytes = 0;
      for (const name of await readdir(directory)) {
        const info = await lstat(join(directory, name));
        if (info.isFile()) bytes += info.size;
      }
      if (bytes > 240 * 1024 ** 2)
        budget.abort(new Error("media workspace limit"));
    } catch {
      budget.abort(new Error("media workspace unavailable"));
    }
  }, 250);
  try {
    await command(
      "/usr/local/bin/yt-dlp",
      [
        "--ignore-config",
        "--no-cache-dir",
        "--no-plugin-dirs",
        "--no-remote-components",
        "--no-js-runtimes",
        "--js-runtimes",
        "node",
        "--extractor-args",
        "youtube-ejs:jitless=true",
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
        "--socket-timeout",
        "10",
        "--retries",
        "2",
        "--fragment-retries",
        "1",
        "--max-filesize",
        "96M",
        "--match-filter",
        "duration<=2700",
        "--format",
        "bv[ext=mp4][vcodec^=avc1][height<=720]+ba[ext=m4a]/b[ext=mp4][vcodec^=avc1][height<=720]",
        "--merge-output-format",
        "mp4",
        "--output",
        join(directory, "source.%(ext)s"),
        `https://www.youtube.com/watch?v=${id}`,
      ],
      directory,
      workSignal,
    );
    const source = join(directory, "source.mp4");
    const info = await lstat(source);
    if (!info.isFile() || info.size <= 0 || info.size > 112 * 1024 ** 2)
      throw new Error("invalid source video");
    const output = join(directory, "video.mp4");
    await command(
      "/usr/bin/ffmpeg",
      [
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        source,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0",
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        output,
      ],
      directory,
      AbortSignal.any([workSignal, AbortSignal.timeout(30_000)]),
    );
    const { stdout } = await command(
      "/usr/bin/ffprobe",
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-show_entries",
        "stream=codec_type,codec_name:format=duration",
        "-of",
        "json",
        output,
      ],
      directory,
      AbortSignal.any([workSignal, AbortSignal.timeout(5000)]),
    );
    const media = JSON.parse(stdout);
    if (
      !Array.isArray(media.streams) ||
      !media.streams.some(
        (s) => s.codec_type === "video" && s.codec_name === "h264",
      ) ||
      !media.streams.some(
        (s) => s.codec_type === "audio" && s.codec_name === "aac",
      ) ||
      !(
        Number(media.format?.duration) > 0 &&
        Number(media.format.duration) <= 2700
      )
    )
      throw new Error("invalid media tracks");
    await unlink(source);
  } finally {
    clearInterval(monitor);
  }
}
