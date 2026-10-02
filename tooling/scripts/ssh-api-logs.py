import pathlib
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
pm2 ls
echo '=== logs ==='
pm2 logs daryadarcy-api --lines 40 --nostream 2>&1 | tail -60
echo '=== node test import ==='
cd /var/www/daryadarcy
node -e "import('nodemailer').then(()=>console.log('nodemailer ok')).catch(e=>console.log('nodemailer fail', e.message))"
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=45)
out = stdout.read().decode("utf-8", errors="replace")
(root / "tooling" / "scripts" / ".ssh-api-logs.txt").write_text(out, encoding="utf-8")
print(out.encode("ascii", "replace").decode("ascii"))
client.close()
