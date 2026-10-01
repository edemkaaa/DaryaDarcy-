"""List web-dist backups on the VPS."""
import pathlib
import paramiko

root = pathlib.Path(__file__).resolve().parents[1]
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
    timeout=60,
    banner_timeout=60,
    auth_timeout=60,
    allow_agent=False,
    look_for_keys=False,
)

cmd = (
    "ls -la /var/www/daryadarcy/backups/\n"
    "for f in /var/www/daryadarcy/backups/*; do "
    "echo \"--- $f ---\"; "
    "if [ -f \"$f/index.html\" ]; then "
    "grep -o 'dd-deploy[^>]*' \"$f/index.html\" 2>/dev/null || echo '(no dd-deploy)'; "
    "grep -o 'entry-[^\"]*\\.js' \"$f/index.html\" 2>/dev/null | head -1 || true; "
    "grep -c dd-boot-layer \"$f/index.html\" 2>/dev/null || true; "
    "fi; "
    "done\n"
)
stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print(err)
client.close()
