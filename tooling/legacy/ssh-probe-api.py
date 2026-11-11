# Читает прежние API, mtime bundle и PM2-логи; PM2 jlist может содержать env, вывод нельзя считать обезличенным.
import json
import pathlib
import socket
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

# Следующий текст — удалённая команда; её содержимое сохранено как историческое и не исполняется при чтении исходника.
cmd = r"""
set -e
cd /var/www/daryadarcy
echo '=== pm2 ==='
pm2 jlist | head -c 4000 || true
echo
echo '=== api health ==='
curl -sS --max-time 8 http://127.0.0.1:3000/api/health || true
echo
echo '=== feed count ==='
curl -sS --max-time 12 'http://127.0.0.1:3000/api/trpc/feed.listPaginated?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22limit%22%3A1%7D%7D%7D' | head -c 800 || true
echo
echo '=== videos ==='
curl -sS --max-time 12 'http://127.0.0.1:3000/api/trpc/videos.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D' | head -c 400 || true
echo
echo '=== dist mtime ==='
stat -c '%y %s' dist/index.mjs || ls -la dist/index.mjs
echo '=== index html ==='
grep -o 'v=[^"]*' web-dist/index.html | head -1 || true
echo
echo '=== pm2 logs tail ==='
pm2 logs daryadarcy-api --lines 20 --nostream 2>&1 | tail -n 25 || true
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=90)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
(root / "tooling" / "scripts" / ".ssh-last-out.txt").write_text(out + "\n" + err, encoding="utf-8")
print(out.encode("ascii", "replace").decode("ascii"))
client.close()
