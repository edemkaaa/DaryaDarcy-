import pathlib
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    env["DEPLOY_HOST"],
    username=env["DEPLOY_USER"],
    password=env["DEPLOY_PASSWORD"],
    timeout=25,
    banner_timeout=30,
    auth_timeout=25,
    allow_agent=False,
    look_for_keys=False,
)
stdin, stdout, stderr = client.exec_command("mkdir -p /var/www/daryadarcy/scripts")
stdout.channel.recv_exit_status()
sftp = client.open_sftp()
sftp.put(
    str(root / "scripts" / "host-video-thumbs.mjs"),
    "/var/www/daryadarcy/scripts/host-video-thumbs.mjs",
)
sftp.close()

stdin, stdout, stderr = client.exec_command(
    "cd /var/www/daryadarcy && node scripts/host-video-thumbs.mjs",
    timeout=180,
)
print(stdout.read().decode("utf-8", errors="replace"))
print(stderr.read().decode("utf-8", errors="replace"))
print("exit", stdout.channel.recv_exit_status())
client.close()
