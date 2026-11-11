#!/bin/bash
# Исторически настраивает системные службы и доступ VPS. Требует прав администратора; это не локальная проверка и не нынешний Docker-порядок выпуска.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# Устанавливаются системные пакеты и глобальные инструменты; сценарий предназначен для прежнего выделенного VPS.
apt-get update
apt-get install -y curl nginx

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

npm install -g pm2 pnpm

# Правила firewall изменяются до включения UFW, сохраняя SSH-доступ.
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
