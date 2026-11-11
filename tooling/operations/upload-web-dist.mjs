// Упаковывает и загружает прежнюю статическую сборку в S3. Не использовать вместо выпуска серверного Next-приложения.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const staging = path.join(root, "deploy", ".web-stage");
const out = path.join(root, "deploy", "web-dist.tgz");
const webDist = path.join(root, "web-dist");
if (!fs.existsSync(path.join(webDist, "index.html"))) throw new Error("Missing web-dist");

fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });
fs.cpSync(webDist, path.join(staging, "web-dist"), { recursive: true });
if (fs.existsSync(out)) fs.unlinkSync(out);
const tar = spawnSync("tar", ["-czf", out, "-C", staging, "."], { stdio: "inherit" });
if (tar.status !== 0) throw new Error("tar failed");
fs.rmSync(staging, { recursive: true, force: true });

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});
const body = fs.readFileSync(out);
await client.send(
  new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: "deploy/web-dist.tgz",
    Body: body,
    ContentType: "application/gzip",
  }),
);
console.log(`${env.S3_ENDPOINT}/${env.S3_BUCKET}/deploy/web-dist.tgz`);
console.log("bytes", body.length);
