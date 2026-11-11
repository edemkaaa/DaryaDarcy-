# Исторически заменяет статический web-dist и конфигурацию Nginx через SSH. Удаление прежней сборки здесь не является безопасным откатом Next-контейнера.
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

entry_dir = root / "web-dist" / "_expo" / "static" / "js" / "web"
entry_files = sorted(p.name for p in entry_dir.glob("entry-*.js") if not p.name.endswith(".gz"))
if not entry_files:
    raise SystemExit(f"Missing web entry bundle in {entry_dir}")
entry_js = entry_files[0]
print("entry bundle", entry_js)

nginx = (root / "infrastructure" / "deploy" / "nginx-daryadarcy.conf").read_text(encoding="utf-8")
cmd = (
    "set -e\n"
    "cat > /etc/nginx/sites-available/daryadarcy << 'NGINX'\n"
    + nginx
    + "\nNGINX\n"
    "nginx -t\n"
    "curl -fsSL -o /tmp/web-dist.tgz https://s3.twcstorage.ru/daryadarcy-s3/deploy/web-dist.tgz\n"
    "rm -rf /var/www/daryadarcy/web-dist\n"
    "tar -xzf /tmp/web-dist.tgz -C /var/www/daryadarcy\n"
    "mkdir -p /var/www/daryadarcy/web-dist/.well-known/acme-challenge\n"
    "echo ok > /var/www/daryadarcy/web-dist/.well-known/acme-challenge/ping\n"
    "systemctl reload nginx\n"
    "rm -f /tmp/web-dist.tgz\n"
    f"test -f /var/www/daryadarcy/web-dist/_expo/static/js/web/{entry_js}\n"
    "curl -sS -o /dev/null -w 'home=%{http_code} size=%{size_download}\\n' --max-time 15 https://daryadarcy.com/\n"
    f"curl -sS -o /dev/null -w 'expojs=%{{http_code}}\\n' --max-time 15 https://daryadarcy.com/_expo/static/js/web/{entry_js}\n"
    "echo DONE\n"
)

sock = None
last_error = None
for attempt in range(1, 4):
    try:
        print(f"ssh connect attempt {attempt}/3...")
        sock = socket.create_connection((env["DEPLOY_HOST"], 22), 45)
        break
    except OSError as error:
        last_error = error
        print(f"ssh connect attempt {attempt}/3 failed: {error}")
        time.sleep(5)
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
stdin, stdout, stderr = client.exec_command(cmd, timeout=180)
print(stdout.read().decode("utf-8", errors="replace"))
print(stderr.read().decode("utf-8", errors="replace"))
print("exit", stdout.channel.recv_exit_status())
client.close()
