import pathlib
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

nginx = (root / "infrastructure" / "deploy" / "nginx-daryadarcy.conf").read_text(encoding="utf-8")
cmd = (
    "set -e\ncat > /etc/nginx/sites-available/daryadarcy << 'NGINX'\n"
    + nginx
    + "\nNGINX\nnginx -t\nsystemctl reload nginx\n"
    "mkdir -p /var/www/daryadarcy/infrastructure/deploy\n"
    "cp /etc/nginx/sites-available/daryadarcy /var/www/daryadarcy/infrastructure/deploy/nginx-daryadarcy.conf\n"
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
stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
print(stdout.read().decode("utf-8", errors="replace"))
print(stderr.read().decode("utf-8", errors="replace"))
print("exit", stdout.channel.recv_exit_status())
client.close()
