# Заменяет только index.html и необязательный gzip старой Expo-сборки; совместимость с прочими чанками не проверяет.
import pathlib
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
sftp = client.open_sftp()
sftp.put(str(root / "web-dist" / "index.html"), "/var/www/daryadarcy/web-dist/index.html")
gz = root / "web-dist" / "index.html.gz"
if gz.exists():
    sftp.put(str(gz), "/var/www/daryadarcy/web-dist/index.html.gz")
sftp.close()
print("uploaded index.html")
client.close()
