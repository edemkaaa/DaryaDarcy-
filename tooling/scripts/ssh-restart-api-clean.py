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

cmd = r"""
set -e
cd /var/www/daryadarcy
python3 - <<'PY'
import os, re
from urllib.parse import urlparse
text=open('.env','r',encoding='utf-8').read()
m=re.search(r'^DATABASE_URL=(.+)$', text, re.M)
if not m:
    print('no DATABASE_URL')
    raise SystemExit(1)
url=m.group(1).strip().strip('"').strip("'")
p=urlparse(url)
print('host', p.hostname)
print('user', p.username[:8]+'...' if p.username else None)
print('db', p.path)
print('has_password', bool(p.password))
PY
pm2 delete daryadarcy-api >/dev/null 2>&1 || true
cd /var/www/daryadarcy && NODE_ENV=production PORT=3000 HOST=127.0.0.1 pm2 start /usr/bin/node --name daryadarcy-api --cwd /var/www/daryadarcy --interpreter none -- dist/index.mjs
pm2 save
sleep 3
curl -sS --max-time 12 'http://127.0.0.1:3000/api/trpc/videos.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D' | head -c 250
echo
pm2 logs daryadarcy-api --lines 8 --nostream 2>&1 | tail -n 12
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=90)
out = stdout.read().decode("utf-8", errors="replace")
(root / "tooling" / "scripts" / ".ssh-last-out.txt").write_text(out, encoding="utf-8")
print(out.encode("ascii", "replace").decode("ascii"))
client.close()
