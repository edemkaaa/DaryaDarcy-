#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y curl nginx

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

npm install -g pm2 pnpm

ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable

echo "---- versions ----"
node -v
npm -v
nginx -v
pm2 -v
pnpm -v
echo "---- done ----"
