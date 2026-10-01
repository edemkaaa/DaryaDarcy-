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

probe = f"""
const mysql=require('mysql2/promise');
(async()=>{{
  const urls={{
    old: "{old_url}",
    new: "REDACTED_DARYA_SECRET"rejectUnauthorized\\":false}}",
    newPrivate: "REDACTED_DARYA_SECRET"rejectUnauthorized\\":false}}"
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

cmd = "cd /var/www/daryadarcy && node /tmp/probe-dbs.mjs 2>&1"
stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
print(stdout.read().decode("utf-8", errors="replace"))
print(stderr.read().decode("utf-8", errors="replace")[:1000])
client.close()
