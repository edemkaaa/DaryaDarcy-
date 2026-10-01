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

cmd = r"""
/usr/local/bin/yt-dlp --extractor-args 'youtube:player_client=android,ios,tv' -f 18 -g --no-warnings --no-playlist 'https://www.youtube.com/watch?v=jNQXAC9IVRw' | head -c 120
echo
echo DONE
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=45)
print(stdout.read().decode("utf-8", "replace"))
print(stderr.read().decode("utf-8", "replace")[-1500:])
client.close()
