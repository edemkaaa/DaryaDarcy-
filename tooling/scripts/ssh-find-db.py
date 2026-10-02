import pathlib
import re
import socket
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

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

cmd = r"""
set +e
echo '=== DATABASE_URL host (no secrets) ==='
python3 - <<'PY'
import re
from urllib.parse import urlparse
text=open('/var/www/daryadarcy/.env','r',encoding='utf-8').read()
m=re.search(r'^DATABASE_URL=(.+)$', text, re.M)
if not m:
    print('MISSING')
else:
    url=m.group(1).strip().strip('"').strip("'")
    p=urlparse(url)
    print('host:', p.hostname)
    print('port:', p.port)
    print('user:', p.username)
    print('db:', p.path.lstrip('/'))
    print('is_tidb:', 'tidbcloud.com' in (p.hostname or ''))
    print('is_local:', p.hostname in ('127.0.0.1','localhost'))
PY
echo
echo '=== mysql/mariadb services ==='
systemctl is-active mysql 2>/dev/null || echo mysql:inactive
systemctl is-active mariadb 2>/dev/null || echo mariadb:inactive
ss -ltnp | grep -E ':3306|:4000' || echo 'no 3306/4000 listener'
echo
echo '=== mysql client test localhost ==='
mysql -h127.0.0.1 -uroot -e 'SELECT 1 AS ok' 2>&1 | head -3
echo
echo '=== databases on localhost (if any) ==='
mysql -h127.0.0.1 -uroot -e 'SHOW DATABASES' 2>&1 | head -15
echo
echo '=== docker containers ==='
docker ps -a 2>/dev/null | head -10 || echo 'no docker'
echo
echo '=== /var/www/daryadarcy files ==='
ls -la /var/www/daryadarcy | head -20
echo
echo '=== sql dumps ==='
find /var/www /root /tmp -maxdepth 3 -name '*.sql' -o -name '*.sql.gz' 2>/dev/null | head -20
echo
echo '=== pm2 env DATABASE host ==='
pm2 env 0 2>/dev/null | grep -E '^DATABASE_URL=' | python3 - <<'PY'
import sys,re
from urllib.parse import urlparse
line=sys.stdin.read().strip()
if not line:
    print('pm2 has no DATABASE_URL')
else:
    url=line.split('=',1)[1]
    p=urlparse(url)
    print('pm2 host:', p.hostname)
PY
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=90)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
(root / "tooling" / "scripts" / ".ssh-last-out.txt").write_text(out + "\n" + err, encoding="utf-8")
print(out.encode("ascii", "replace").decode("ascii"))
client.close()
