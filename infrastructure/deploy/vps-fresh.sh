#!/bin/bash
# Историческая установка на новый VPS меняет системные пакеты и службы. Перед новым размещением нужен актуальный Docker-пакет и проверенный план восстановления данных.
# Wipe the previous app and install a fresh IP-only build.
# Run as root. Keeps /root/daryadarcy.env.bak
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

APP=/var/www/daryadarcy
TGZ_URL="https://s3.twcstorage.ru/daryadarcy-s3/deploy/daryadarcy-src.tgz"

if [ -f "$APP/.env" ]; then
  cp "$APP/.env" /root/daryadarcy.env.bak
  echo "Saved $APP/.env -> /root/daryadarcy.env.bak"
fi

pm2 delete daryadarcy-api >/dev/null 2>&1 || true
pm2 save >/dev/null 2>&1 || true
rm -rf "$APP"
mkdir -p "$APP"

apt-get update
apt-get install -y curl nginx

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm
fi

cd /tmp
curl -fsSL -o daryadarcy-src.tgz "$TGZ_URL"
tar -xzf daryadarcy-src.tgz -C "$APP"

if [ -f /root/daryadarcy.env.bak ]; then
  cp /root/daryadarcy.env.bak "$APP/.env"
fi

if [ ! -f "$APP/.env" ]; then
  echo "Put .env at $APP/.env then run: bash $APP/infrastructure/deploy/install.sh"
  exit 1
fi

sed -i 's|^PUBLIC_APP_URL=.*|PUBLIC_APP_URL=http://200.165.234.36|' "$APP/.env"

bash "$APP/infrastructure/deploy/install.sh"
