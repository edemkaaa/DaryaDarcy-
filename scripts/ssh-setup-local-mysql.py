import os
import pathlib
import socket
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

drizzle = root / "packages" / "database" / "drizzle"
sql_files = sorted(drizzle.glob("*.sql"))

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
sock = socket.create_connection((env["DEPLOY_HOST"], 22), 45)
client.connect(
    env["DEPLOY_HOST"],
    username=env["DEPLOY_USER"],
    password=env["DEPLOY_PASSWORD"],
    sock=sock,
    timeout=25,
    allow_agent=False,
    look_for_keys=False,
)

remote_mig = "/var/www/daryadarcy/drizzle-migrations"
sftp = client.open_sftp()


def ensure_dir(path: str):
    parts = path.strip("/").split("/")
    cur = ""
    for part in parts:
        cur += "/" + part
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            sftp.mkdir(cur)


ensure_dir(remote_mig)
for file in sql_files:
    sftp.put(str(file), f"{remote_mig}/{file.name}")
sftp.put(
    str(root / "infrastructure" / "deploy" / "setup-local-mysql.sh"),
    "/var/www/daryadarcy/infrastructure/deploy/setup-local-mysql.sh",
)
sftp.close()

cmd = r"""
set -e
chmod +x /var/www/daryadarcy/infrastructure/deploy/setup-local-mysql.sh
bash /var/www/daryadarcy/infrastructure/deploy/setup-local-mysql.sh
pm2 delete daryadarcy-api >/dev/null 2>&1 || true
cd /var/www/daryadarcy
NODE_ENV=production PORT=3000 HOST=127.0.0.1 pm2 start /usr/bin/node --name daryadarcy-api --cwd /var/www/daryadarcy --interpreter none -- dist/index.mjs
pm2 save
sleep 2
curl -sS --max-time 8 http://127.0.0.1:3000/api/health
echo
curl -sS --max-time 12 'http://127.0.0.1:3000/api/trpc/feed.listPaginated?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22limit%22%3A1%7D%7D%7D' | head -c 200
echo
pm2 logs daryadarcy-api --lines 5 --nostream 2>&1 | tail -n 8
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=600)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
(root / "scripts" / ".ssh-last-out.txt").write_text(out + "\n" + err, encoding="utf-8")
print(out.encode("ascii", "replace").decode("ascii"))
if err.strip():
    print("ERR:", err.encode("ascii", "replace").decode("ascii")[:2000])
client.close()
print(f"uploaded {len(sql_files)} migration files")
