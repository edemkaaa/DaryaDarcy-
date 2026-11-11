#!/bin/bash
# Устанавливает прежний архив приложения в серверные каталоги. Это изменяющий систему сценарий, не сборка контейнерного runtime.
set -euo pipefail

APP=/var/www/daryadarcy
cd "$APP"

if [ ! -f .env ]; then
  echo "Missing $APP/.env"
  exit 1
fi

if [ ! -f dist/index.mjs ]; then
  echo "Missing dist/index.mjs — upload a build first"
  exit 1
fi

if [ ! -d web-dist ]; then
  echo "Missing web-dist — upload a build first"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm
fi

pnpm install --prod --frozen-lockfile

cp "$APP/infrastructure/deploy/nginx-daryadarcy.conf" /etc/nginx/sites-available/daryadarcy
ln -sfn /etc/nginx/sites-available/daryadarcy /etc/nginx/sites-enabled/daryadarcy
rm -f /etc/nginx/sites-enabled/default

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 8080/tcp
ufw --force enable >/dev/null

nginx -t
systemctl enable --now nginx
systemctl restart nginx

pm2 delete daryadarcy-api >/dev/null 2>&1 || true
NODE_ENV=production PORT=3000 HOST=127.0.0.1 pm2 start /usr/bin/node --name daryadarcy-api --cwd "$APP" --interpreter none -- dist/index.mjs
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
sleep 2

echo "---- status ----"
systemctl is-active nginx
ss -lntp | grep -E ':80|:8080|:3000' || true
pm2 ls
curl -sS -o /dev/null -w "local80=%{http_code} size=%{size_download}\n" --max-time 8 http://127.0.0.1/
curl -sS --max-time 8 http://127.0.0.1:3000/api/health || true
echo
echo "Open http://200.165.234.36"
