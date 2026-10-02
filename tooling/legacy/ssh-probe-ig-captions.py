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
echo '--- oembed ---'
curl -sS -o /tmp/ig.json -w 'code=%{http_code}\n' --max-time 20 \
  'https://api.instagram.com/oembed/?url=https://www.instagram.com/p/DZKpKPwl0-S/' || true
head -c 400 /tmp/ig.json 2>/dev/null || true
echo
echo '--- embed ---'
curl -sS -o /tmp/ig.html -w 'code=%{http_code} size=%{size_download}\n' --max-time 20 \
  'https://www.instagram.com/p/DZKpKPwl0-S/embed/captioned/' || true
grep -o 'og:description[^>]*' /tmp/ig.html | head -1 || true
echo
echo '--- node fetch ---'
cd /var/www/daryadarcy
node -e "
fetch('https://api.instagram.com/oembed/?url=https://www.instagram.com/p/DZKpKPwl0-S/')
  .then(r => r.text().then(t => console.log('status', r.status, t.slice(0,200))))
  .catch(e => console.error('err', e.message));
"
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
print(out.encode("ascii", "replace").decode("ascii"))
if err.strip():
    print("ERR:", err.encode("ascii", "replace").decode("ascii"))
client.close()
