import fs from "fs";
import mysql from "mysql2/promise";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const conn = await mysql.createConnection(env.DATABASE_URL);
const [[ig]] = await conn.query(
  "SELECT COUNT(*) AS c FROM posts WHERE source = 'instagram' AND text != ''",
);
const [[club]] = await conn.query(
  "SELECT COUNT(*) AS c FROM posts WHERE target = 'club' AND text != ''",
);
console.log("instagram with text", ig.c, "club with text", club.c);
await conn.end();

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});
const res = await client.send(
  new ListObjectsV2Command({
    Bucket: env.S3_BUCKET,
    Prefix: "feed/DZKpKPwl0-S/",
    MaxKeys: 20,
  }),
);
console.log(
  "S3 keys for latest post",
  (res.Contents || []).map((o) => o.Key),
);

const meta = await client.send(
  new ListObjectsV2Command({
    Bucket: env.S3_BUCKET,
    Prefix: "feed/",
    MaxKeys: 50,
  }),
);
const jsonKeys = (meta.Contents || [])
  .map((o) => o.Key)
  .filter((k) => k?.endsWith(".json"));
console.log("json in feed prefix sample", jsonKeys.slice(0, 10));
