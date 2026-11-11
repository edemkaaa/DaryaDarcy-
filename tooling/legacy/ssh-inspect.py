# Читает пакеты, порты и firewall прежнего сервера; факты этой пробы не доказывают текущую доступность нового хоста.
import pathlib
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

# Следующий текст — удалённая команда; её содержимое сохранено как историческое и не исполняется при чтении исходника.
cmd = r"""
echo HOST=$(hostname)
echo '--- packages ---'
for b in node npm nginx pm2 git curl ufw docker; do
  printf '%-8s ' "$b"
  if command -v "$b" >/dev/null 2>&1; then
    "$b" --version 2>/dev/null | head -1
  else
    echo MISSING
  fi
done
echo '--- listen ---'
ss -tlnp
echo '--- dirs ---'
ls -la /var/www /opt /home /root 2>/dev/null | head -80
echo '--- ufw ---'
ufw status
echo DONE
"""

# Подключение использует историческое автоматическое доверие неизвестному SSH host key; перед новым запуском требуется отдельная сверка хоста.
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    env["DEPLOY_HOST"],
    username=env["DEPLOY_USER"],
    password=env["DEPLOY_PASSWORD"],
    timeout=30,
    banner_timeout=60,
    auth_timeout=30,
    allow_agent=False,
    look_for_keys=False,
)
stdin, stdout, stderr = client.exec_command(cmd, timeout=45)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print("STDERR", err)
print("exit", stdout.channel.recv_exit_status())
client.close()
