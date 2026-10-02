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

sftp = client.open_sftp()
for rel in ["package.json", "package-lock.json"]:
    local = root / rel
    if local.exists():
        sftp.put(str(local), f"/var/www/daryadarcy/{rel}")
        print("uploaded", rel)
sftp.close()

cmd = r"""
set -e
cd /var/www/daryadarcy
npm install nodemailer@6.10.1 --legacy-peer-deps --omit=dev --no-audit --no-fund
node -e "import('nodemailer').then(()=>console.log('nodemailer ok')).catch(e=>{console.error(e); process.exit(1)})"
pm2 restart daryadarcy-api || pm2 start /usr/bin/node --name daryadarcy-api --cwd /var/www/daryadarcy --interpreter none -- dist/index.mjs
sleep 2
curl -sS --max-time 8 http://127.0.0.1:3000/api/health
echo
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=180000)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
(root / "tooling" / "scripts" / ".ssh-deps-out.txt").write_text(out + "\n" + err, encoding="utf-8")
print(out.encode("ascii", "replace").decode("ascii"))
if err.strip():
    print(err.encode("ascii", "replace").decode("ascii"))
print("exit", stdout.channel.recv_exit_status())
client.close()
