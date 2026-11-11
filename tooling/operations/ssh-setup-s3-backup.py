# Старый установщик меняет серверные файлы, S3-политику и cron резервирования. Исторические пути и область действия ключей нужно проверить до любых внешних изменений.
"""Deploy S3 media backup scripts to VPS, create keys file, run setup + initial backup + cron."""
import json
import pathlib
import secrets
import string
import paramiko

root = pathlib.Path(__file__).resolve().parents[2]
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

BACKUP_BUCKET = "daryadarcy-s3-backup"
REMOTE_ROOT = "/var/www/daryadarcy"
REMOTE_ENV = "/etc/daryadarcy/s3-backup.env"
CRON_LINE = "0 3 * * 0 root cd /var/www/daryadarcy && /usr/bin/node scripts/s3-media-backup.mjs >> /var/log/daryadarcy-s3-backup.log 2>&1"

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

# Upload scripts and config
files = [
    (root / "tooling" / "operations" / "s3-media-backup.mjs", f"{REMOTE_ROOT}/scripts/s3-media-backup.mjs"),
    (
        root / "infrastructure" / "deploy" / "s3-backup-lifecycle.json",
        f"{REMOTE_ROOT}/infrastructure/deploy/s3-backup-lifecycle.json",
    ),
    (root / "tooling" / "legacy" / "_s3-bucket-size.mjs", f"{REMOTE_ROOT}/scripts/_s3-bucket-size.mjs"),
]

with client.open_sftp() as sftp:
    for local, remote in files:
        sftp.put(str(local), remote)
        print("uploaded", remote)

# Check if backup env already exists on server; if not, bootstrap with main keys
# (Timeweb S3 users are account-scoped; bucket policy blocks app key deletes)
check_cmd = f"test -f {REMOTE_ENV} && echo EXISTS || echo MISSING"
stdin, stdout, stderr = client.exec_command(check_cmd, timeout=30)
exists = "EXISTS" in stdout.read().decode()

if not exists:
    bootstrap = f"""mkdir -p /etc/daryadarcy
cat > {REMOTE_ENV} << 'EOF'
# S3 media backup credentials — NOT used by the app
S3_ENDPOINT={env.get("S3_ENDPOINT", "https://s3.twcstorage.ru")}
SOURCE_S3_BUCKET={env.get("S3_BUCKET", "daryadarcy-s3")}
BACKUP_S3_BUCKET={BACKUP_BUCKET}
SOURCE_S3_ACCESS_KEY={env["S3_ACCESS_KEY"]}
SOURCE_S3_SECRET_KEY={env["S3_SECRET_KEY"]}
BACKUP_S3_ACCESS_KEY={env["S3_ACCESS_KEY"]}
BACKUP_S3_SECRET_KEY={env["S3_SECRET_KEY"]}
APP_S3_ACCESS_KEY={env["S3_ACCESS_KEY"]}
RESTORE_ADMIN_S3_ACCESS_KEY={env["S3_ACCESS_KEY"]}
EOF
chmod 600 {REMOTE_ENV}
"""
    stdin, stdout, stderr = client.exec_command(bootstrap, timeout=30)
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err.strip():
        print("bootstrap err:", err)

setup_and_backup = f"""
set -e
mkdir -p /etc/daryadarcy /var/log
export S3_BACKUP_ENV={REMOTE_ENV}
cd {REMOTE_ROOT}
echo '=== SETUP ==='
node scripts/s3-media-backup.mjs --setup
echo '=== INITIAL BACKUP ==='
node scripts/s3-media-backup.mjs
echo '=== VERIFY ==='
node scripts/s3-media-backup.mjs --verify
echo '=== CRON ==='
grep -q 's3-media-backup.mjs' /etc/cron.d/daryadarcy-s3-backup 2>/dev/null || echo '{CRON_LINE}' > /etc/cron.d/daryadarcy-s3-backup
chmod 644 /etc/cron.d/daryadarcy-s3-backup
cat /etc/cron.d/daryadarcy-s3-backup
echo DONE
"""

stdin, stdout, stderr = client.exec_command(setup_and_backup, timeout=3600)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
print(out)
if err.strip():
    print("STDERR:", err[-4000:])

# Fetch report
try:
    with client.open_sftp() as sftp:
        report_path = f"{REMOTE_ROOT}/infrastructure/deploy/s3-backup-last-run.json"
        local_report = root / "infrastructure" / "deploy" / "s3-backup-last-run.json"
        sftp.get(report_path, str(local_report))
        print("saved", local_report)
        print(local_report.read_text(encoding="utf-8"))
except Exception as exc:
    print("report fetch:", exc)

client.close()
