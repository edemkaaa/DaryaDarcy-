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
set +e
echo '=== SMTP keys (masked) ==='
grep '^SMTP_' /var/www/daryadarcy/.env | sed 's/SMTP_PASS=.*/SMTP_PASS=***/'
echo '=== health ==='
curl -sS --max-time 8 http://127.0.0.1:3000/api/health
echo
echo '=== tables ==='
python3 - <<'PY'
import re, pathlib
text = pathlib.Path('/var/www/daryadarcy/.env').read_text()
m = re.search(r'^DATABASE_URL=(.+)$', text, re.M)
if not m:
    print('no DATABASE_URL')
    raise SystemExit(0)
import subprocess, json
# just check via mysql client if available
PY
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
(root / "tooling" / "scripts" / ".ssh-smtp-check.txt").write_text(out + err, encoding="utf-8")
print(out.encode("ascii", "replace").decode("ascii"))
client.close()
