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

out_dir = root / ".tmp-shop-book2"
out_dir.mkdir(exist_ok=True)
raw = out_dir / "tropinka-cover-raw.png"
trimmed = out_dir / "cover.png"

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

_, stdout, stderr = client.exec_command(
    'test -s /tmp/tropinka-cover.png || curl -fsSL -o /tmp/tropinka-cover.png "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/13d6a513f39b-nJGBnjSsHvYTlKyD.PNG"; ls -l /tmp/tropinka-cover.png',
    timeout=40,
)
print(stdout.read().decode("utf-8", errors="replace"))
print(stderr.read().decode("utf-8", errors="replace"))

sftp = client.open_sftp()
sftp.get("/tmp/tropinka-cover.png", str(raw))
sftp.close()
client.close()

im = Image.open(raw).convert("RGBA")
bbox = im.getbbox()
print("before", im.size, "bbox", bbox)
im = im.crop(bbox)
pad = 16
out = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
out.paste(im, (pad, pad))
out.save(trimmed, "PNG")
print("after", out.size, trimmed.stat().st_size)
