import os
import pathlib
import socket
import time
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

local_web = root / "web-dist"
remote_web = "/var/www/daryadarcy/web-dist"
BATCH = 4

files = [local_web / "index.html"]
for extra in ("index.html.gz", "privacy.html", "privacy.html.gz", "manifest.webmanifest", "manifest.webmanifest.gz", "apple-touch-icon.png"):
    extra_path = local_web / extra
    if extra_path.exists():
        files.append(extra_path)

static = local_web / "_expo" / "static"
for dirpath, _, filenames in os.walk(static):
    for name in filenames:
        files.append(pathlib.Path(dirpath) / name)


def connect():
    last_error = None
    for attempt in range(1, 4):
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            sock = socket.create_connection((env["DEPLOY_HOST"], 22), 45)
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
            return client
        except OSError as error:
            last_error = error
            print(f"ssh connect attempt {attempt}/3 failed: {error}")
            time.sleep(3)
    raise last_error


def ensure_dir(sftp, remote_dir):
    try:
        sftp.stat(remote_dir)
        return
    except FileNotFoundError:
        pass
    parts = remote_dir.split("/")
    cur = ""
    for part in parts:
        if not part:
            continue
        cur += "/" + part
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            sftp.mkdir(cur)


uploaded = 0
bytes_ = 0
index = 0
while index < len(files):
    batch = files[index:index + BATCH]
    last_error = None
    for attempt in range(3):
        client = None
        try:
            client = connect()
            sftp = client.open_sftp()
            for local in batch:
                rel = local.relative_to(local_web).as_posix()
                remote = f"{remote_web}/{rel}"
                ensure_dir(sftp, remote.rsplit("/", 1)[0])
                sftp.put(str(local), remote)
                remote_size = sftp.stat(remote).st_size
                local_size = local.stat().st_size
                if remote_size != local_size:
                    raise SystemExit(f"size mismatch {rel}: local={local_size} remote={remote_size}")
                uploaded += 1
                bytes_ += local_size
                print(rel, flush=True)
            sftp.close()
            client.close()
            last_error = None
            break
        except Exception as err:
            last_error = err
            print(f"retry {attempt + 1} after {err}", flush=True)
            try:
                if client:
                    client.close()
            except Exception:
                pass
            time.sleep(2 + attempt * 2)
    if last_error:
        raise last_error
    index += BATCH

client = connect()
_, stdout, stderr = client.exec_command(
    "systemctl reload nginx; curl -sS -o /dev/null -w 'home=%{http_code} size=%{size_download}\\n' --max-time 15 https://daryadarcy.com/",
    timeout=30,
)
out = stdout.read().decode("utf-8", errors="replace")
code = stdout.channel.recv_exit_status()
client.close()
print(f"uploaded {uploaded} files {bytes_} bytes")
print(out.encode("ascii", "replace").decode("ascii"))
print("exit", code)
