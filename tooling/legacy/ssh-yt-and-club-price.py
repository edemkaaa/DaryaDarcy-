# Исторически меняет цену/TEST-флаг и ставит latest yt-dlp без закреплённого digest; не текущий порядок релиза.
import pathlib
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
set -e
python3 - <<'PY'
from pathlib import Path
p = Path("/var/www/daryadarcy/.env")
text = p.read_text(encoding="utf-8")
lines = text.splitlines()
out = []
seen_price = False
seen_demo = False
for line in lines:
    if line.startswith("CLUB_PRICE="):
        out.append("CLUB_PRICE=790")
        seen_price = True
    elif line.startswith("PRODAMUS_SHOP_DEMO="):
        out.append("PRODAMUS_SHOP_DEMO=1")
        seen_demo = True
    else:
        out.append(line)
if not seen_price:
    out.append("CLUB_PRICE=790")
if not seen_demo:
    out.append("PRODAMUS_SHOP_DEMO=1")
p.write_text("\n".join(out) + "\n", encoding="utf-8")
print("env club price and shop demo updated")
PY
if [ ! -x /usr/local/bin/yt-dlp ]; then
  curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" -o /usr/local/bin/yt-dlp
  chmod +x /usr/local/bin/yt-dlp
fi
/usr/local/bin/yt-dlp --version
echo YT_OK
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print(err[-1500:])
client.close()
