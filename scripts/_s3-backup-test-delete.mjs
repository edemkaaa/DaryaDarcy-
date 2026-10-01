import fs from "node:fs";
import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const env = Object.fromEntries(
  fs
    .readFileSync("/var/www/daryadarcy/.env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});

const list = await client.send(
  new ListObjectsV2Command({ Bucket: "daryadarcy-s3-backup", MaxKeys: 1 }),
);
const key = list.Contents?.[0]?.Key;
if (!key) {
  console.log("no test key");
  process.exit(0);
}

try {
  await client.send(new DeleteObjectCommand({ Bucket: "daryadarcy-s3-backup", Key: key }));
  console.log("DELETE ALLOWED - BAD", key);
  process.exit(1);
} catch (error) {
  console.log("DELETE BLOCKED OK", error.name || error.Code, key);
}
