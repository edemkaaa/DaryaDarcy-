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

ssh_port = int((env.get("DEPLOY_SSH_PORT") or "22").strip() or "22")

sock = None
last_error = None
for attempt in range(1, 4):
    try:
        sock = socket.create_connection((env["DEPLOY_HOST"], ssh_port), 45)
        break
    except OSError as error:
        last_error = error
        print(f"ssh connect attempt {attempt}/3 failed: {error}")
        time.sleep(3)
if sock is None:
    raise last_error

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    env["DEPLOY_HOST"],
    port=ssh_port,
    username=env["DEPLOY_USER"],
    password=env["DEPLOY_PASSWORD"],
    sock=sock,
    timeout=25,
    banner_timeout=30,
    auth_timeout=25,
    allow_agent=False,
    look_for_keys=False,
)

sftp = client.open_sftp()
sftp.put(str(root / "dist" / "index.mjs"), "/var/www/daryadarcy/dist/index.mjs")
sftp.close()
print("uploaded dist/index.mjs")

cmd = r"""
set -e
cd /var/www/daryadarcy
pm2 delete daryadarcy-api >/dev/null 2>&1 || true
NODE_ENV=production PORT=3000 HOST=127.0.0.1 pm2 start /usr/bin/node --name daryadarcy-api --cwd /var/www/daryadarcy --interpreter none -- dist/index.mjs
pm2 save
sleep 2
curl -sS --max-time 8 http://127.0.0.1:3000/api/health || true
echo
echo DONE
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
code = stdout.channel.recv_exit_status()
(root / "scripts" / ".ssh-last-out.txt").write_text(out + "\n" + err + f"\nexit {code}\n", encoding="utf-8")
print("exit", code)
print(out.encode("ascii", "replace").decode("ascii"))
client.close()
