# Передаёт старый backfill подписей на VPS и запускает его с LIMIT/DRY_RUN; пути и режим записи проверяются до запуска.
import pathlib
import socket
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

limit = env.get("BACKFILL_LIMIT", "3")
dry = env.get("BACKFILL_DRY", "1")
extra = ""
if limit:
    extra += f" LIMIT={limit}"
if dry:
    extra += f" DRY_RUN={dry}"

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

sftp = client.open_sftp()
sftp.put(
    str(root / "tooling" / "data" / "backfill-instagram-captions.mjs"),
    "/var/www/daryadarcy/scripts/backfill-instagram-captions.mjs",
)
sftp.close()

# Следующий текст — удалённая команда; её содержимое сохранено как историческое и не исполняется при чтении исходника.
cmd = f"""
set -e
cd /var/www/daryadarcy
{extra.strip()} node scripts/backfill-instagram-captions.mjs 2>&1
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=7200)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
print(out.encode("ascii", "replace").decode("ascii"))
if err.strip():
    print("ERR:", err.encode("ascii", "replace").decode("ascii"))
print("exit", stdout.channel.recv_exit_status())
client.close()
