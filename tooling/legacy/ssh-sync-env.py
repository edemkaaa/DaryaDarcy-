import pathlib
import socket
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
local_env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        local_env[k.strip()] = v.strip()

SYNC_KEYS = [
    "DATABASE_URL",
    "JWT_SECRET",
    "VITE_APP_ID",
    "PUBLIC_APP_URL",
    "OWNER_OPEN_ID",
    "OWNER_NAME",
    "OWNER_EMAIL",
    "OWNER_PASSWORD",
    "S3_ENDPOINT",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
    "S3_BUCKET",
    "SMS_RU_API_ID",
    "SMS_RU_FROM",
    "PRODAMUS_SECRET",
    "PRODAMUS_PAYFORM_URL",
    "PRODAMUS_SUBSCRIPTION_ID",
    "PRODAMUS_SUBSCRIPTION_SECRET",
    "CLUB_PRICE",
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
sock = socket.create_connection((local_env["DEPLOY_HOST"], 22), 45)
client.connect(
    local_env["DEPLOY_HOST"],
    username=local_env["DEPLOY_USER"],
    password=local_env["DEPLOY_PASSWORD"],
    sock=sock,
    timeout=25,
    allow_agent=False,
    look_for_keys=False,
)

remote_path = "/var/www/daryadarcy/.env"
sftp = client.open_sftp()
try:
    with sftp.open(remote_path, "r") as handle:
        remote_text = handle.read().decode("utf-8", errors="replace")
except FileNotFoundError:
    remote_text = ""

remote_map = {}
for line in remote_text.splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        remote_map[k.strip()] = v.strip()

updated = dict(remote_map)
for key in SYNC_KEYS:
    if key in local_env and local_env[key]:
        updated[key] = local_env[key]

lines = []
seen = set()
for line in remote_text.splitlines():
    if line.startswith("#") or "=" not in line:
        lines.append(line)
        continue
    key = line.split("=", 1)[0].strip()
    if key in updated:
        lines.append(f"{key}={updated[key]}")
        seen.add(key)
    else:
        lines.append(line)

for key in SYNC_KEYS:
    if key in updated and key not in seen:
        lines.append(f"{key}={updated[key]}")

new_text = "\n".join(lines).rstrip() + "\n"
with sftp.open(remote_path, "w") as handle:
    handle.write(new_text)
sftp.close()
print("synced env keys:", ", ".join(k for k in SYNC_KEYS if k in local_env))

cmd = r"""
set -e
cd /var/www/daryadarcy
pm2 restart daryadarcy-api
sleep 2
curl -sS --max-time 12 'http://127.0.0.1:3000/api/trpc/videos.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D' | head -c 200
echo
curl -sS --max-time 12 'http://127.0.0.1:3000/api/trpc/feed.listPaginated?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22limit%22%3A1%7D%7D%7D' | head -c 300
echo
pm2 logs daryadarcy-api --lines 5 --nostream 2>&1 | tail -n 8
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
(root / "tooling" / "scripts" / ".ssh-last-out.txt").write_text(out + "\n" + err, encoding="utf-8")
print(out.encode("ascii", "replace").decode("ascii"))
client.close()
