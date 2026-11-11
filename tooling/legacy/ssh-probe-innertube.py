# Историческая внешняя проба Android-контекста YouTube, не путь актуального VK-плеера.
import pathlib
import json
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

# Подключение использует историческое автоматическое доверие неизвестному SSH host key; перед новым запуском требуется отдельная сверка хоста.
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

# Следующий текст — удалённая команда; её содержимое сохранено как историческое и не исполняется при чтении исходника.
cmd = r"""
python3 - <<'PY'
import json, urllib.request
body = {
  "context": {"client": {"clientName": "ANDROID", "clientVersion": "19.10.39", "androidSdkVersion": 30, "hl": "en", "gl": "US"}},
  "videoId": "jNQXAC9IVRw",
}
req = urllib.request.Request(
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
  data=json.dumps(body).encode(),
  headers={"Content-Type": "application/json", "User-Agent": "com.google.android.youtube/19.10.39 (Linux; U; Android 14)"},
  method="POST",
)
with urllib.request.urlopen(req, timeout=20) as r:
    data = json.loads(r.read().decode())
status = data.get("playabilityStatus", {})
print("status", status.get("status"), status.get("reason", "")[:80])
formats = (data.get("streamingData") or {}).get("formats") or []
print("formats", len(formats))
if formats:
    print("itag", formats[0].get("itag"), "mime", (formats[0].get("mimeType") or "")[:40], "hasUrl", bool(formats[0].get("url")))
PY
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=40)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print(err[-1500:])
client.close()
