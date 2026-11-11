# Скачивает, локально обрезает и публикует конкретные книжные обложки в S3 через удалённый helper.
import pathlib
import socket
import paramiko
from PIL import Image

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

out = root / ".tmp-shop-covers"
out.mkdir(exist_ok=True)

books = {
    "book-1": "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b8106c44719f-tlMfbAYBCxFjOQfm.PNG",
    "book-3": "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/94b5bebfd7f4-IbTlGDtcIAJBcJAR.PNG",
}

# Подключение использует историческое автоматическое доверие неизвестному SSH host key; перед новым запуском требуется отдельная сверка хоста.
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

cmds = " && ".join(
    f'curl -fsSL -o /tmp/{name}-raw.png "{url}"'
    for name, url in books.items()
)
_, stdout, stderr = client.exec_command(cmds + "; ls -l /tmp/book-*-raw.png", timeout=60)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print(err)

sftp = client.open_sftp()
try:
    sftp.stat("/tmp/book-covers")
except FileNotFoundError:
    sftp.mkdir("/tmp/book-covers")

for name in books:
    raw_local = out / f"{name}-raw.png"
    sftp.get(f"/tmp/{name}-raw.png", str(raw_local))
    im = Image.open(raw_local).convert("RGBA")
    bbox = im.getbbox()
    im = im.crop(bbox)
    pad = 16
    trimmed = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    trimmed.paste(im, (pad, pad))
    dest = out / f"{name}-cover.png"
    trimmed.save(dest, "PNG", optimize=True)
    print(name, "before", Image.open(raw_local).size, "after", trimmed.size, dest.stat().st_size)
    sftp.put(str(dest), f"/tmp/book-covers/{name}.png")
    raw_local.unlink(missing_ok=True)

mjs = out / "upload.mjs"
mjs.write_text(
    """import fs from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
const env = Object.fromEntries(
  fs.readFileSync("/var/www/daryadarcy/.env", "utf8").split(/\\r?\\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
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
const dir = "/tmp/book-covers";
for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".png"))) {
  const id = name.replace(".png", "");
  const Body = fs.readFileSync(`${dir}/${name}`);
  await client.send(new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: `app-assets/shop/${id}/cover.png`,
    Body,
    ContentType: "image/png",
    ACL: "public-read",
    CacheControl: "public, max-age=31536000",
  }));
  console.log(id, Body.length);
}
""",
    encoding="utf-8",
)
sftp.put(str(mjs), "/var/www/daryadarcy/scripts/upload-book-covers.mjs")
sftp.close()

_, stdout, stderr = client.exec_command(
    "cd /var/www/daryadarcy && node scripts/upload-book-covers.mjs",
    timeout=90,
)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print(err)
print("exit", stdout.channel.recv_exit_status())
client.close()
