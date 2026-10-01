"""Collect VPS infra facts for Roskomnadzor audit (OpenSSL, log rotation)."""
import pathlib
import paramiko

root = pathlib.Path(__file__).resolve().parents[1]
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

cmd = r"""
echo '=== HOST ==='
hostname
echo '=== OPENSSL ==='
openssl version -a 2>/dev/null | head -10
nginx -v 2>&1
echo '=== PM2 LOG ROTATION ==='
pm2 conf 2>/dev/null | grep -iE 'log|rotate|max|retain|module' || true
pm2 module:list 2>/dev/null || true
pm2 show daryadarcy-api 2>/dev/null | grep -iE 'log path|error log|out log' || true
ls -la ~/.pm2/logs/ 2>/dev/null | tail -8
echo '=== LOGROTATE NGINX ==='
cat /etc/logrotate.d/nginx 2>/dev/null || echo 'no nginx logrotate'
echo '=== LOGROTATE PM2 ==='
ls /etc/logrotate.d/ 2>/dev/null
grep -l pm2 /etc/logrotate.d/* 2>/dev/null | while read f; do echo "--- $f ---"; cat "$f"; done
echo '=== NGINX LOG PATHS ==='
grep -rE 'access_log|error_log' /etc/nginx/sites-enabled/ /etc/nginx/nginx.conf 2>/dev/null | head -15
echo '=== LOG SIZES ==='
du -sh /var/log/nginx 2>/dev/null
du -sh ~/.pm2/logs 2>/dev/null
echo DONE
"""

out_path = root / "docs" / "VPS-INFRA-PROBE.txt"
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    env["DEPLOY_HOST"],
    username=env["DEPLOY_USER"],
    password=env["DEPLOY_PASSWORD"],
    timeout=30,
    banner_timeout=60,
    auth_timeout=30,
    allow_agent=False,
    look_for_keys=False,
)
stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
text = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
client.close()

out_path.write_text(text + ("\nSTDERR:\n" + err if err.strip() else ""), encoding="utf-8")
print(f"Wrote {out_path}")
