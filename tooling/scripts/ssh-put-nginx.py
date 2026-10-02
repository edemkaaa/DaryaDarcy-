import pathlib
import socket
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

local_nginx = root / "infrastructure" / "deploy" / "nginx-daryadarcy.conf"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
sock = socket.create_connection((env["DEPLOY_HOST"], 22), 20)
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

client.exec_command("mkdir -p /var/www/daryadarcy/infrastructure/deploy")[1].channel.recv_exit_status()
sftp = client.open_sftp()
sftp.put(str(local_nginx), "/etc/nginx/sites-available/daryadarcy")
sftp.put(str(local_nginx), "/var/www/daryadarcy/infrastructure/deploy/nginx-daryadarcy.conf")
sftp.close()
print("uploaded nginx conf")

cmd = r"""
set -e
nginx -t
systemctl reload nginx
echo DONE
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
code = stdout.channel.recv_exit_status()
(root / "tooling" / "scripts" / ".ssh-last-out.txt").write_text(out + "\n" + err + f"\nexit {code}\n", encoding="utf-8")
print("exit", code)
print(out.encode("ascii", "replace").decode("ascii"))
if err.strip():
    print(err.encode("ascii", "replace").decode("ascii"))
client.close()
if code != 0:
    raise SystemExit(code)
