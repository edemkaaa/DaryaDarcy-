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

sock = socket.create_connection((env["DEPLOY_HOST"], 22), 45)
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

cmd = r"""
set -e
echo '--- PM2 LOGS ---'
pm2 logs daryadarcy-api --lines 120 --nostream --raw 2>&1 | tail -n 150
echo '--- NGINX SMS ---'
grep -E 'sms|/api/auth' /var/log/nginx/access.log 2>/dev/null | tail -n 40 || true
echo '--- ENV HAS SMS ---'
grep -c '^SMS_RU_API_ID=.' /var/www/daryadarcy/.env || true
echo '--- DONE ---'
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=40)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
code = stdout.channel.recv_exit_status()
# Strip possible api ids from output just in case
api_id = env.get("SMS_RU_API_ID", "")
if api_id:
    out = out.replace(api_id, "[redacted]")
    err = err.replace(api_id, "[redacted]")
(root / "tooling" / "scripts" / ".ssh-last-out.txt").write_text(out + "\n" + err + f"\nexit {code}\n", encoding="utf-8")
print(out)
print(err)
print("exit", code)
client.close()
