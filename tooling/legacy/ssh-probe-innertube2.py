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
import json, urllib.request, urllib.error
clients = [
  ("IOS", "19.45.4", "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)"),
  ("TVHTML5_SIMPLY_EMBEDDED_PLAYER", "2.0", "Mozilla/5.0 (ChromiumStyle TV)"),
  ("WEB_EMBEDDED_PLAYER", "1.20241001.00.00", "Mozilla/5.0"),
]
for name, ver, ua in clients:
    body = {"context": {"client": {"clientName": name, "clientVersion": ver, "hl": "en", "gl": "US"}}, "videoId": "jNQXAC9IVRw"}
    req = urllib.request.Request(
        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false&key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "User-Agent": ua, "X-YouTube-Client-Name": "2", "X-YouTube-Client-Version": ver},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
        st = data.get("playabilityStatus", {})
        n = len((data.get("streamingData") or {}).get("formats") or [])
        print(name, r.status if False else "ok", st.get("status"), "formats", n, (st.get("reason") or "")[:60])
    except Exception as e:
        print(name, "ERR", type(e).__name__, str(e)[:80])
PY
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=50)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print(err[-800:])
client.close()
