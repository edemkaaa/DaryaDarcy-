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

sftp = client.open_sftp()
sftp.put(str(root / "tooling" / "legacy" / "loshadka-cover.jpg"), "/tmp/loshadka-cover.jpg")
sftp.put(str(root / "tooling" / "legacy" / "_upload-loshadka-cover.mjs"), "/var/www/daryadarcy/scripts/_upload-loshadka-cover.mjs")
sftp.close()

_, stdout, stderr = client.exec_command(
    "cd /var/www/daryadarcy && node scripts/_upload-loshadka-cover.mjs",
    timeout=60,
)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print(err)
print("exit", stdout.channel.recv_exit_status())
client.close()
