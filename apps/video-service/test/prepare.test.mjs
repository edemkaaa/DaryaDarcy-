import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareVideo, runCommand } from "../prepare.mjs";

const directories = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function directory() {
  const path = await mkdtemp(join(tmpdir(), "video-prepare-test-"));
  directories.push(path);
  return path;
}
const media = Buffer.from([
  0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
]);
const metadata = {
  streams: [
    { codec_type: "video", codec_name: "h264" },
    { codec_type: "audio", codec_name: "aac" },
  ],
  format: { duration: "926" },
};

test("downloads only the fixed YouTube source and remuxes audio plus video without transcoding", async () => {
  const path = await directory();
  await prepareVideo(
    "sq7pY1H_fYU",
    path,
    new AbortController().signal,
    async (binary, args) => {
      if (binary === "/usr/local/bin/yt-dlp") {
        assert.equal(
          args.at(-1),
          "https://www.youtube.com/watch?v=sq7pY1H_fYU",
        );
        assert.ok(args.includes("--ignore-config"));
        assert.ok(args.includes("--no-plugin-dirs"));
        assert.ok(args.includes("--no-remote-components"));
        assert.ok(args[args.indexOf("--format") + 1].includes("height<=720"));
        await writeFile(join(path, "source.mp4"), media);
        return { stdout: "" };
      }
      if (binary === "/usr/bin/ffmpeg") {
        assert.equal(args[args.indexOf("-c") + 1], "copy");
        assert.equal(args[args.indexOf("-movflags") + 1], "+faststart");
        assert.ok(args.includes("0:v:0"));
        assert.ok(args.includes("0:a:0"));
        assert.equal(
          args[args.indexOf("-protocol_whitelist") + 1],
          "file,pipe",
        );
        await writeFile(join(path, "video.mp4"), media);
        return { stdout: "" };
      }
      assert.equal(binary, "/usr/bin/ffprobe");
      return { stdout: JSON.stringify(metadata) };
    },
  );
  assert.equal(
    await access(join(path, "video.mp4")).then(
      () => true,
      () => false,
    ),
    true,
  );
  assert.deepEqual(await readFile(join(path, "video.mp4")), media);
  await assert.rejects(readFile(join(path, "source.mp4")), { code: "ENOENT" });
});

test("rejects video without sound rather than caching a false playable result", async () => {
  const path = await directory();
  await assert.rejects(
    prepareVideo(
      "sq7pY1H_fYU",
      path,
      new AbortController().signal,
      async (binary) => {
        if (binary === "/usr/local/bin/yt-dlp")
          await writeFile(join(path, "source.mp4"), media);
        if (binary === "/usr/bin/ffmpeg")
          await writeFile(join(path, "video.mp4"), media);
        return {
          stdout: JSON.stringify({
            ...metadata,
            streams: [metadata.streams[0]],
          }),
        };
      },
    ),
    /invalid media tracks/,
  );
});

test("command failure never includes upstream signed URLs in the returned error", async () => {
  const path = await directory();
  await assert.rejects(
    runCommand(
      process.execPath,
      [
        "-e",
        "process.stderr.write('https://private.invalid/?token=secret');process.exit(1)",
      ],
      path,
      new AbortController().signal,
    ),
    (error) => {
      assert.equal(error.message, "media command failed");
      assert.equal(error.message.includes("secret"), false);
      return true;
    },
  );
});

test("aborting work terminates the actual child process", async () => {
  const path = await directory();
  const controller = new AbortController();
  const promise = runCommand(
    process.execPath,
    ["-e", "setInterval(()=>{},1000)"],
    path,
    controller.signal,
  );
  setTimeout(() => controller.abort(), 25);
  await assert.rejects(promise, { name: "AbortError" });
});

test("a child cannot fill memory with unbounded stdout", async () => {
  const path = await directory();
  await assert.rejects(
    runCommand(
      process.execPath,
      ["-e", "process.stdout.write('x'.repeat(100000))"],
      path,
      new AbortController().signal,
    ),
  );
});
