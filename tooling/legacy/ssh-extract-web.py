import pathlib
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

cmd = (
    "set -e\n"
    "curl -fsSL -o /tmp/web-dist.tgz https://s3.twcstorage.ru/daryadarcy-s3/deploy/web-dist.tgz\n"
    "rm -rf /var/www/daryadarcy/web-dist\n"
    "tar -xzf /tmp/web-dist.tgz -C /var/www/daryadarcy\n"
    "mkdir -p /var/www/daryadarcy/web-dist/.well-known/acme-challenge\n"
    "echo ok > /var/www/daryadarcy/web-dist/.well-known/acme-challenge/ping\n"
    "systemctl reload nginx\n"
    "rm -f /tmp/web-dist.tgz\n"
    "ls /var/www/daryadarcy/web-dist/_expo/static/js/web/entry-*.js\n"
    "curl -sS -o /dev/null -w 'home=%{http_code} size=%{size_download}\\n' --max-time 15 https://daryadarcy.com/\n"
    "echo DONE\n"
)

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
stdin, stdout, stderr = client.exec_command(cmd, timeout=180)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
code = stdout.channel.recv_exit_status()
(root / "tooling" / "scripts" / ".ssh-last-out.txt").write_text(out + "\n" + err + f"\nexit {code}\n", encoding="utf-8")
print("exit", code)
print(out.encode("ascii", "replace").decode("ascii"))
client.close()
