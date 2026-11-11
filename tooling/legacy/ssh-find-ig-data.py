# Ищет старые JSON/Instagram-источники и необычные S3-ключи с VPS; не восстанавливает данные автоматически.
import pathlib
import socket
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

# Подключение использует историческое автоматическое доверие неизвестному SSH host key; перед новым запуском требуется отдельная сверка хоста.
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

# Следующий текст — удалённая команда; её содержимое сохранено как историческое и не исполняется при чтении исходника.
cmd = r"""
set -e
echo '--- find json on server ---'
find /var/www/daryadarcy -maxdepth 3 -name '*.json' 2>/dev/null | head -40
echo '--- grep ig/processed ---'
find /var/www /root /tmp -maxdepth 4 \( -name '*ig*' -o -name '*instagram*' -o -name '*processed*' \) 2>/dev/null | head -30
echo '--- s3 non-photo feed keys sample ---'
cd /var/www/daryadarcy
node - <<'NODE'
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l&& !l.startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
const client = new S3Client({ endpoint: env.S3_ENDPOINT, region: 'ru-1', credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY }, forcePathStyle: true });
let token; const odd=[];
do {
  const res = await client.send(new ListObjectsV2Command({ Bucket: env.S3_BUCKET, Prefix: 'feed/', ContinuationToken: token, MaxKeys: 1000 }));
  for (const o of res.Contents||[]) {
    const k=o.Key||'';
    if (!/photo_\d+\.(jpg|jpeg|png|webp)$/i.test(k)) odd.push(k);
  }
  token = res.NextContinuationToken;
} while (token && odd.length < 20);
console.log('odd keys', odd.slice(0,20));
NODE
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=180)
print(stdout.read().decode("utf-8", errors="replace").encode("ascii", "replace").decode("ascii"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print("ERR:", err.encode("ascii", "replace").decode("ascii")[:800])
client.close()
