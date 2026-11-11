# Передаёт read-only счётчик S3 на VPS и запускает его с серверным env; сеть и SSH всё равно реально используются.
"""Measure S3 bucket size from VPS (same network as Timeweb S3)."""
import pathlib
import subprocess
import paramiko

root = pathlib.Path(__file__).resolve().parents[2]
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

script = (root / "tooling" / "legacy" / "_s3-bucket-size.mjs").read_text(encoding="utf-8")

# Подключение использует историческое автоматическое доверие неизвестному SSH host key; перед новым запуском требуется отдельная сверка хоста.
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    env["DEPLOY_HOST"],
    username=env["DEPLOY_USER"],
    password=env["DEPLOY_PASSWORD"],
    timeout=60,
    banner_timeout=60,
    auth_timeout=60,
    allow_agent=False,
    look_for_keys=False,
)

remote_script = "/var/www/daryadarcy/scripts/_s3-bucket-size.mjs"
with client.open_sftp() as sftp:
    sftp.put(str(root / "tooling" / "legacy" / "_s3-bucket-size.mjs"), remote_script)

# Следующий текст — удалённая команда; её содержимое сохранено как историческое и не исполняется при чтении исходника.
cmd = "cd /var/www/daryadarcy && node scripts/_s3-bucket-size.mjs /var/www/daryadarcy/.env"
stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
print(out)
if err.strip():
    print("STDERR:", err)
client.close()
