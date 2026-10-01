import pathlib
import paramiko

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
env = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

nginx = r"""# HTTP: ACME + redirect domain to HTTPS. IP stays on HTTP.
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 8080 default_server;
    listen [::]:8080 default_server;
    server_name 200.165.234.36 daryadarcy.com www.daryadarcy.com _;

    root /var/www/daryadarcy/web-dist;
    index index.html;
    client_max_body_size 25m;
    absolute_redirect off;
    server_name_in_redirect off;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/daryadarcy/web-dist;
        default_type text/plain;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_read_timeout 60s;
        proxy_connect_timeout 5s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        if ($host = daryadarcy.com) { return 301 https://$host$request_uri; }
        if ($host = www.daryadarcy.com) { return 301 https://$host$request_uri; }
        try_files $uri $uri.html $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name daryadarcy.com www.daryadarcy.com 200.165.234.36 _;

    ssl_certificate     /etc/letsencrypt/live/daryadarcy.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/daryadarcy.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    root /var/www/daryadarcy/web-dist;
    index index.html;
    client_max_body_size 25m;
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    absolute_redirect off;
    server_name_in_redirect off;

    gzip on;
    gzip_static on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss image/svg+xml font/ttf;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_read_timeout 60s;
        proxy_connect_timeout 5s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        try_files $uri =404;
    }

    location /fonts/ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        try_files $uri =404;
    }

    location /home/ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri.html $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}
"""

cmd = r"""
set -e
mkdir -p /var/www/daryadarcy/web-dist/.well-known/acme-challenge
echo ok > /var/www/daryadarcy/web-dist/.well-known/acme-challenge/ping
certbot certonly --webroot -w /var/www/daryadarcy/web-dist \
  -d daryadarcy.com -d www.daryadarcy.com \
  --non-interactive --agree-tos --email daryadarcy19@gmail.com \
  --preferred-challenges http
cat > /etc/nginx/sites-available/daryadarcy << 'NGINX'
""" + nginx + r"""
NGINX
nginx -t
systemctl reload nginx
cp /etc/nginx/sites-available/daryadarcy /var/www/daryadarcy/deploy/nginx-daryadarcy.conf
systemctl enable --now certbot.timer
echo '==== cert ===='
openssl x509 -in /etc/letsencrypt/live/daryadarcy.com/fullchain.pem -noout -issuer -subject -dates
echo '==== https ===='
curl -sS -o /dev/null -w "https=%{http_code}\n" --max-time 10 https://daryadarcy.com/
curl -sS -o /dev/null -w "http_redirect=%{http_code} loc=%{redirect_url}\n" --max-time 10 http://daryadarcy.com/
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
stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
(root / "scripts" / "certbot.out.txt").write_text(out + "\nSTDERR\n" + err, encoding="utf-8")
print("exit", stdout.channel.recv_exit_status())
client.close()
