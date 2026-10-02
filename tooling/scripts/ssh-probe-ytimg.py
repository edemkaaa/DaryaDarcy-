import pathlib
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

cmd = r"""
set +e
echo '==== ytimg from VPS ===='
curl -sS -o /tmp/yt.jpg -w "hq=%{http_code} bytes=%{size_download} time=%{time_total}\n" --max-time 8 "https://i.ytimg.com/vi/sq7pY1H_fYU/hqdefault.jpg"
file /tmp/yt.jpg 2>/dev/null | head -1
echo '==== img.youtube ===='
curl -sS -o /dev/null -w "img.yt=%{http_code} time=%{time_total}\n" --max-time 8 "https://img.youtube.com/vi/sq7pY1H_fYU/hqdefault.jpg"
echo '==== s3 sample ===='
curl -sS -o /dev/null -w "s3=%{http_code}\n" --max-time 8 "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/cc53a49e1416-qxGDcExHmMNZuoWc.jpg"
echo DONE
"""

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
stdin, stdout, stderr = client.exec_command(cmd, timeout=40)
print(stdout.read().decode("utf-8", errors="replace"))
print(stderr.read().decode("utf-8", errors="replace"))
print("exit", stdout.channel.recv_exit_status())
client.close()
