import pathlib
import socket
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

local_dir = root / ".tmp-shop-book3"
files = [p for p in local_dir.iterdir() if p.suffix.lower() in {".jpg", ".mjs"}]

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

sftp = client.open_sftp()
try:
    sftp.stat("/tmp/book-3-photos")
except FileNotFoundError:
    sftp.mkdir("/tmp/book-3-photos")
for local in files:
    remote = f"/tmp/book-3-photos/{local.name}"
    sftp.put(str(local), remote)
    print("put", local.name, local.stat().st_size)
sftp.put(str(local_dir / "upload.mjs"), "/var/www/daryadarcy/scripts/upload-book3.mjs")
sftp.close()

_, stdout, stderr = client.exec_command(
    "cd /var/www/daryadarcy && node scripts/upload-book3.mjs",
    timeout=90,
)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print(err)
print("exit", stdout.channel.recv_exit_status())
client.close()
