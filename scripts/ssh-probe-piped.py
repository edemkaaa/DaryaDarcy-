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
  "https://pipedapi.kavin.rocks/streams/jNQXAC9IVRw",
  "https://pipedapi.adminforge.de/streams/jNQXAC9IVRw",
  "https://pipedapi.meissereconomics.com/streams/jNQXAC9IVRw",
  "https://api.piped.yt/streams/jNQXAC9IVRw",
]
for u in urls:
    try:
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=12) as r:
            print("OK", r.status, u.split("/")[2], r.read(60))
    except Exception as e:
        print("FAIL", u.split("/")[2], type(e).__name__, str(e)[:90])
PY
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=80)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print(err[-800:])
client.close()
