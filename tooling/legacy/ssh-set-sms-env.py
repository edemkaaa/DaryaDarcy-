import io
import pathlib
import socket
import time
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

api_id = (env.get("SMS_RU_API_ID") or "").strip()
sender = (env.get("SMS_RU_FROM") or "daryadarcy").strip()
if not api_id:
    raise SystemExit("SMS_RU_API_ID is missing in local .env")

sock = None
last_error = None
for attempt in range(1, 4):
    try:
        sock = socket.create_connection((env["DEPLOY_HOST"], 22), 45)
        break
    except OSError as error:
        last_error = error
        print(f"ssh connect attempt {attempt}/3 failed: {error}")
        time.sleep(3)
if sock is None:
    raise last_error

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    env["DEPLOY_HOST"],
    username=env["DEPLOY_USER"],
    password=env["DEPLOY_PASSWORD"],
    sock=sock,
    timeout=25,
    banner_timeout=30,
    auth_timeout=25,
    allow_agent=False,
    look_for_keys=False,
)

remote = "/var/www/daryadarcy/.env"
sftp = client.open_sftp()
with sftp.open(remote, "r") as handle:
    text = handle.read().decode("utf-8", errors="replace")

lines = []
has_id = False
has_from = False
for raw in text.splitlines():
    if raw.startswith("SMS_RU_API_ID="):
        lines.append(f"SMS_RU_API_ID={api_id}")
        has_id = True
    elif raw.startswith("SMS_RU_FROM="):
        lines.append(f"SMS_RU_FROM={sender}")
        has_from = True
    else:
        lines.append(raw)
if not has_id:
    lines.append(f"SMS_RU_API_ID={api_id}")
if not has_from:
    lines.append(f"SMS_RU_FROM={sender}")
updated = "\n".join(lines).rstrip() + "\n"

with sftp.open(remote, "w") as handle:
    handle.write(updated)
sftp.close()
print("vps env sms keys upserted")
client.close()
