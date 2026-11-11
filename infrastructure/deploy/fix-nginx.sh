#!/bin/bash
# Исправляет прежнюю серверную конфигурацию Nginx. Перед применением требуется сравнение с фактическим доменным vhost.
set -euo pipefail
APP=/var/www/daryadarcy

if [ ! -f /etc/ssl/certs/daryadarcy.crt ] || [ ! -f /etc/ssl/private/daryadarcy.key ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout /etc/ssl/private/daryadarcy.key \
    -out /etc/ssl/certs/daryadarcy.crt \
    -subj "/CN=200.165.234.36"
  chmod 600 /etc/ssl/private/daryadarcy.key
fi

curl -fsSL -o "$APP/infrastructure/deploy/nginx-daryadarcy.conf" https://s3.twcstorage.ru/daryadarcy-s3/deploy/nginx-daryadarcy.conf
cp "$APP/infrastructure/deploy/nginx-daryadarcy.conf" /etc/nginx/sites-available/daryadarcy
ln -sfn /etc/nginx/sites-available/daryadarcy /etc/nginx/sites-enabled/daryadarcy
rm -f /etc/nginx/sites-enabled/default

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8080/tcp
ufw --force enable >/dev/null

nginx -t
systemctl reload nginx

echo "---- local ----"
curl -sS -o /dev/null -w "local80=%{http_code}\n" --max-time 5 http://127.0.0.1/
curl -skS -o /dev/null -w "local443=%{http_code}\n" --max-time 5 https://127.0.0.1/
curl -sS --max-time 5 http://127.0.0.1:3000/api/health || true
echo
