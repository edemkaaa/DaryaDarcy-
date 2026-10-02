"""Deploy web-dist.tgz via SFTP when S3 upload from local network fails."""
import pathlib
import subprocess
import paramiko

root = pathlib.Path(__file__).resolve().parents[2]
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

web_dist = root / "web-dist"
tgz = root / "infrastructure" / "deploy" / "web-dist.tgz"
pack_script = root / "tooling" / "scripts" / "pack-web-dist.mjs"

if not (web_dist / "index.html").exists():
    raise SystemExit(f"Missing {web_dist / 'index.html'} — run npm run build:web first")

print("packing fresh web-dist.tgz from web-dist/")
subprocess.run(["node", str(pack_script)], cwd=root, check=True)

if not tgz.exists():
    raise SystemExit(f"Missing {tgz} after pack")

boot_lock = web_dist / "boot-lock.png"
if boot_lock.exists():
    print(f"boot-lock.png {boot_lock.stat().st_size} bytes")

entry_dir = root / "web-dist" / "_expo" / "static" / "js" / "web"
entry_files = sorted(p.name for p in entry_dir.glob("entry-*.js") if not p.name.endswith(".gz"))
if not entry_files:
    raise SystemExit(f"Missing web entry bundle in {entry_dir}")
entry_js = entry_files[0]
print("entry bundle", entry_js)

nginx = (root / "infrastructure" / "deploy" / "nginx-daryadarcy.conf").read_text(encoding="utf-8")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    env["DEPLOY_HOST"],
    username=env["DEPLOY_USER"],
    password=env["DEPLOY_PASSWORD"],
    timeout=60,
    banner_timeout=60,
    auth_timeout=60,
    allow_agent=False,
    look_for_keys=False,
)

print(f"uploading {tgz.stat().st_size} bytes via SFTP")
with client.open_sftp() as sftp:
    sftp.put(str(tgz), "/tmp/web-dist.tgz")

cmd = (
    "set -e\n"
    "cat > /etc/nginx/sites-available/daryadarcy << 'NGINX'\n"
    + nginx
    + "\nNGINX\n"
    "nginx -t\n"
    "rm -rf /var/www/daryadarcy/web-dist\n"
    "tar -xzf /tmp/web-dist.tgz -C /var/www/daryadarcy\n"
    "mkdir -p /var/www/daryadarcy/web-dist/.well-known/acme-challenge\n"
    "echo ok > /var/www/daryadarcy/web-dist/.well-known/acme-challenge/ping\n"
    "systemctl reload nginx\n"
    "rm -f /tmp/web-dist.tgz\n"
    f"test -f /var/www/daryadarcy/web-dist/_expo/static/js/web/{entry_js}\n"
    "curl -sS -o /dev/null -w 'home=%{http_code} size=%{size_download}\\n' --max-time 15 https://daryadarcy.com/\n"
    f"curl -sS -o /dev/null -w 'expojs=%{{http_code}}\\n' --max-time 15 https://daryadarcy.com/_expo/static/js/web/{entry_js}\n"
    "curl -sS -o /dev/null -w 'bootlock=%{http_code} size=%{size_download}\\n' --max-time 15 https://daryadarcy.com/boot-lock.png\n"
    "echo DONE\n"
)

stdin, stdout, stderr = client.exec_command(cmd, timeout=180)
print(stdout.read().decode("utf-8", errors="replace"))
print(stderr.read().decode("utf-8", errors="replace"))
print("exit", stdout.channel.recv_exit_status())
client.close()
