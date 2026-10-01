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
echo '=== PRODAMUS env (masked) ==='
grep -E '^(PRODAMUS_|CLUB_|SHOP_DIGITAL|PUBLIC_APP|SMTP_)' /var/www/daryadarcy/.env | sed -E 's/(SECRET|PASS)=.*/\1=***/'
echo '=== recent prodamus logs ==='
grep -i prodamus /root/.pm2/logs/daryadarcy-api-out.log | tail -n 30 || true
echo '=== recent email logs ==='
grep -iE '\[email\]|shop purchase|deliverShop' /root/.pm2/logs/daryadarcy-api-out.log | tail -n 20 || true
echo '=== nodemailer ==='
cd /var/www/daryadarcy && node -e "import('nodemailer').then(()=>console.log('nodemailer ok')).catch(e=>console.error('fail', e.message))"
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=60000)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
(root / "scripts" / ".ssh-prodamus-check.txt").write_text(out + "\n" + err, encoding="utf-8")
print(out.encode("ascii", "replace").decode("ascii"))
if err.strip():
    print(err.encode("ascii", "replace").decode("ascii"))
client.close()
