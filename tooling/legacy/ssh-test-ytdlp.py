# Историческая проба также добавляет YT_DLP_PATH в серверный env; это не полностью read-only проверка.
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
grep -q '^YT_DLP_PATH=' /var/www/daryadarcy/.env || echo 'YT_DLP_PATH=/usr/local/bin/yt-dlp' >> /var/www/daryadarcy/.env
# do not print .env
echo 'path set'
/usr/local/bin/yt-dlp -f 18 -g --no-warnings --no-playlist 'https://www.youtube.com/watch?v=jNQXAC9IVRw' | head -c 80
echo
echo YT_DLP_FETCH_OK
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print(err[-2000:])
client.close()
