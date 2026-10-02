"""Install pm2-logrotate on VPS for RKN compliance."""
import pathlib
import socket
import sys
import time

import paramiko

root = pathlib.Path(__file__).resolve().parents[2]
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

cmd = r"""
set -e
pm2 -v
echo '--- pm2 list ---'
pm2 list
echo '--- log sizes before ---'
ls -lh /root/.pm2/logs/ 2>/dev/null || true
if pm2 describe pm2-logrotate >/dev/null 2>&1; then
  echo 'pm2-logrotate already installed'
else
  pm2 install pm2-logrotate
fi
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
pm2 save
echo '--- pm2-logrotate config ---'
pm2 conf pm2-logrotate
echo 'DONE'
"""

sock = None
last_error = None
for attempt in range(1, 4):
    try:
        print(f"ssh connect attempt {attempt}/3...")
        sock = socket.create_connection((env["DEPLOY_HOST"], 22), 45)
        break
    except OSError as error:
        last_error = error
        print(f"failed: {error}")
        time.sleep(5)
if sock is None:
    raise SystemExit(str(last_error))

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
stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
out = stdout.read().decode("utf-8", "replace")
err = stderr.read().decode("utf-8", "replace")
code = stdout.channel.recv_exit_status()
sys.stdout.buffer.write(out.encode("utf-8", "replace"))
sys.stdout.buffer.write(err.encode("utf-8", "replace"))
print("exit", code)
client.close()
raise SystemExit(code)
