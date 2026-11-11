# Перезаписывает SMTP-настройки прежнего VPS и перезапускает API; доставку письма этим не подтверждает.
"""Patch VPS .env with SMTP settings and restart API."""
import pathlib
import re
import socket
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

smtp_defaults = {
    "SMTP_HOST": env.get("SMTP_HOST", "smtp.yandex.ru"),
    "SMTP_PORT": env.get("SMTP_PORT", "465"),
    "SMTP_SECURE": env.get("SMTP_SECURE", "true"),
    "SMTP_USER": env.get("SMTP_USER", "daryadarcyapp@yandex.ru"),
    "SMTP_FROM": env.get("SMTP_FROM", "daryadarcyapp@yandex.ru"),
    "SMTP_PASS": env.get("SMTP_PASS", ""),
}

# Подключение использует историческое автоматическое доверие неизвестному SSH host key; перед новым запуском требуется отдельная сверка хоста.
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

read_cmd = "cat /var/www/daryadarcy/.env 2>/dev/null || echo MISSING"
stdin, stdout, stderr = client.exec_command(read_cmd, timeout=20)
remote = stdout.read().decode("utf-8", errors="replace")
if remote.strip() == "MISSING" or not remote.strip():
    raise SystemExit("VPS .env not found at /var/www/daryadarcy/.env")

lines = remote.splitlines()
keys = set()
out = []
for line in lines:
    if not line or line.startswith("#") or "=" not in line:
        out.append(line)
        continue
    key = line.split("=", 1)[0].strip()
    if key.startswith("SMTP_"):
        keys.add(key)
        if key == "SMTP_PASS" and smtp_defaults["SMTP_PASS"]:
            out.append(f"SMTP_PASS={smtp_defaults['SMTP_PASS']}")
        elif key in smtp_defaults and key != "SMTP_PASS":
            out.append(f"{key}={smtp_defaults[key]}")
        else:
            out.append(line)
        keys.add(key)
    else:
        out.append(line)

for key, value in smtp_defaults.items():
    if key not in keys:
        out.append(f"{key}={value}")

# Сформированная конфигурация содержит секреты и записывается на сервер; выводить её целиком нельзя.
new_env = "\n".join(out).rstrip() + "\n"
sftp = client.open_sftp()
with sftp.file("/var/www/daryadarcy/.env", "w") as f:
    f.write(new_env)
sftp.close()
print("updated /var/www/daryadarcy/.env (SMTP keys present)")

has_pass = bool(re.search(r"^SMTP_PASS=.+", new_env, re.M))
print("smtp_pass_set", has_pass)

restart = r"""
set -e
cd /var/www/daryadarcy
pm2 restart daryadarcy-api || pm2 start /usr/bin/node --name daryadarcy-api --cwd /var/www/daryadarcy --interpreter none -- dist/index.mjs
sleep 2
curl -sS --max-time 8 http://127.0.0.1:3000/api/health
echo
"""
stdin, stdout, stderr = client.exec_command(restart, timeout=60)
print(stdout.read().decode("utf-8", errors="replace"))
print(stderr.read().decode("utf-8", errors="replace"))
print("exit", stdout.channel.recv_exit_status())
client.close()
