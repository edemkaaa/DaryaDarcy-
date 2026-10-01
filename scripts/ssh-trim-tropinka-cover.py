import pathlib
import socket
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
sock = socket.create_connection((env["DEPLOY_HOST"], 22), 20)
client.connect(
    env["DEPLOY_HOST"],
    username=env["DEPLOY_USER"],
    password=env["DEPLOY_PASSWORD"],
    sock=sock,
    timeout=25,
    banner_timeout=30,
    auth_timeout=25,
    allow_agent=False,
    look_for_keys=False,
)

cmd = r"""
set -e
cd /tmp
curl -fsSL -o tropinka-cover.png "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/13d6a513f39b-nJGBnjSsHvYTlKyD.PNG"
python3 - <<'PY'
from PIL import Image
im = Image.open("/tmp/tropinka-cover.png").convert("RGBA")
bbox = im.getbbox()
print("before", im.size, "bbox", bbox)
im = im.crop(bbox)
# keep a little breathing room so the 3D shadow is not clipped
pad = 12
out = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
out.paste(im, (pad, pad))
out.save("/tmp/tropinka-cover-trim.png", "PNG")
print("after", out.size)
PY
cat > /var/www/daryadarcy/scripts/upload-tropinka-cover.mjs <<'JS'
import fs from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
const env = Object.fromEntries(
  fs.readFileSync("/var/www/daryadarcy/.env", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);
const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});
const Body = fs.readFileSync("/tmp/tropinka-cover-trim.png");
await client.send(new PutObjectCommand({
  Bucket: env.S3_BUCKET,
  Key: "app-assets/shop/book-2/cover.png",
  Body,
  ContentType: "image/png",
  ACL: "public-read",
  CacheControl: "public, max-age=31536000",
}));
console.log("uploaded", Body.length);
JS
cd /var/www/daryadarcy && node scripts/upload-tropinka-cover.mjs
"""

_, stdout, stderr = client.exec_command(cmd, timeout=90)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print(err)
print("exit", stdout.channel.recv_exit_status())
client.close()
