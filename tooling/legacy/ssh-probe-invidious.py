import pathlib
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    env["DEPLOY_HOST"],
    username=env["DEPLOY_USER"],
    password=env["DEPLOY_PASSWORD"],
    timeout=25,
    banner_timeout=30,
    auth_timeout=25,
    allow_agent=False,
    look_for_keys=False,
)

cmd = r"""
python3 - <<'PY'
import urllib.request
urls = [
  "https://inv.nadeko.net/api/v1/videos/jNQXAC9IVRw?fields=title,formatStreams",
  "https://invidious.nerdvpn.de/api/v1/videos/jNQXAC9IVRw?fields=title,formatStreams",
  "https://yewtu.be/api/v1/videos/jNQXAC9IVRw?fields=title,formatStreams",
  "https://vid.puffyan.us/api/v1/videos/jNQXAC9IVRw?fields=title,formatStreams",
]
for u in urls:
    try:
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=12) as r:
            body = r.read(180)
            print("OK", r.status, u.split("/")[2], body[:80])
    except Exception as e:
        print("FAIL", u.split("/")[2], type(e).__name__, str(e)[:80])
PY
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=80)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print(err[-1200:])
client.close()
