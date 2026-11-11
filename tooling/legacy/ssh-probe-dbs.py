# Исторически помещает строки подключения в удалённый временный JS-файл для счётчиков таблиц; файл требует закрытого обращения и отдельной уборки.
import pathlib
import socket
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

old_url = env["DATABASE_URL"].replace('"', '\\"')
new_url = env["NEW_DATABASE_URL"].replace('"', '\\"')
new_private_url = env.get("NEW_PRIVATE_DATABASE_URL", new_url).replace('"', '\\"')

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

# Диагностический JS включает приватные подключения; сохранять и передавать его следует только закрыто, не печатая значения.
probe = f"""
const mysql=require('mysql2/promise');
(async()=>{{
  const urls={{
    old: "{old_url}",
    new: "{new_url}",
    newPrivate: "{new_private_url}"
  }};
  for (const [label, url] of Object.entries(urls)) {{
    try {{
      const c=await mysql.createConnection(url);
      const [tables]=await c.query('SHOW TABLES');
      const counts={{}};
      for (const row of tables) {{
        const t=Object.values(row)[0];
        const [[r]]=await c.query('SELECT COUNT(*) AS c FROM `'+t+'`');
        counts[t]=r.c;
      }}
      console.log(label, JSON.stringify({{ok:true, counts}}));
      await c.end();
    }} catch (e) {{
      console.log(label, JSON.stringify({{ok:false, msg:e.message.slice(0,160)}}));
    }}
  }}
}})();
"""

sftp = client.open_sftp()
with sftp.open("/tmp/probe-dbs.mjs", "w") as f:
    f.write(f"import mysql from 'mysql2/promise';\n{probe}")
sftp.close()

# Следующий текст — удалённая команда; её содержимое сохранено как историческое и не исполняется при чтении исходника.
cmd = "cd /var/www/daryadarcy && node /tmp/probe-dbs.mjs 2>&1"
stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
print(stdout.read().decode("utf-8", errors="replace"))
print(stderr.read().decode("utf-8", errors="replace")[:1000])
client.close()
