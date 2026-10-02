#!/bin/bash
# Restart after reboot. Run as root:
#   bash /var/www/daryadarcy/infrastructure/deploy/restart.sh
set -euo pipefail

APP=/var/www/daryadarcy
cd "$APP"

if [ ! -f .env ]; then
  echo "Missing $APP/.env"
  exit 1
fi

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 8080/tcp
ufw --force enable >/dev/null

cp "$APP/infrastructure/deploy/nginx-daryadarcy.conf" /etc/nginx/sites-available/daryadarcy
ln -sfn /etc/nginx/sites-available/daryadarcy /etc/nginx/sites-enabled/daryadarcy
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl restart nginx

pm2 delete daryadarcy-api >/dev/null 2>&1 || true
pm2 start "$APP/infrastructure/deploy/ecosystem.config.cjs"
pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

echo "---- ports ----"
ss -lntp | grep -E ':80 |:8080 |:3000 ' || true
echo "---- nginx ----"
systemctl is-active nginx
echo "---- api ----"
pm2 ls
curl -sS --max-time 8 http://127.0.0.1:3000/api/health || true
echo
curl -sS -o /dev/null -w "local80=%{http_code} size=%{size_download}\n" --max-time 8 http://127.0.0.1/
echo "Open http://200.165.234.36"
