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
echo 'ytimg'
curl -sI --max-time 10 -o /dev/null -w '%{http_code}\n' https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg
echo 'youtube'
curl -sI --max-time 10 -o /dev/null -w '%{http_code}\n' https://www.youtube.com/
echo 'googlevideo'
curl -sI --max-time 10 -o /dev/null -w '%{http_code}\n' https://rr1---sn-gvnuxaxjvh-n8ml.googlevideo.com/ || true
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=40)
print(stdout.read().decode("utf-8", "replace"))
print(stderr.read().decode("utf-8", "replace")[-500:])
client.close()
