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

sc = "DZKpKPwl0-S"
cmd = f"""
echo '--- oembed -L ---'
curl -sSL -o /tmp/ig.json -w 'code=%{{http_code}}\\n' --max-time 25 \
  'https://api.instagram.com/oembed/?url=https://www.instagram.com/p/{sc}/' || true
head -c 500 /tmp/ig.json 2>/dev/null || true
echo
echo '--- jina reader ---'
curl -sSL -o /tmp/jina.txt -w 'code=%{{http_code}} size=%{{size_download}}\\n' --max-time 25 \
  'https://r.jina.ai/https://www.instagram.com/p/{sc}/' || true
head -c 500 /tmp/jina.txt 2>/dev/null || true
echo
echo '--- ddinstagram ---'
curl -sSL -o /tmp/dd.txt -w 'code=%{{http_code}} size=%{{size_download}}\\n' --max-time 25 \
  'https://ddinstagram.com/reels/{sc}/' || true
head -c 300 /tmp/dd.txt 2>/dev/null || true
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=180)
print(stdout.read().decode("utf-8", errors="replace").encode("ascii", "replace").decode("ascii"))
client.close()
