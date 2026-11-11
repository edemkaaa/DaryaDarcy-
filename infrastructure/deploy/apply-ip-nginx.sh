#!/bin/bash
# Исторически настраивает Nginx для доступа по IP. Не применять поверх актуального доменного Docker-стека без сверки конфигурации.
set -euo pipefail
APP=/var/www/daryadarcy
# Подменяет старый сайт Nginx и отключает default; перед reload ниже проверяется синтаксис.
cp "$APP/infrastructure/deploy/nginx-daryadarcy.conf" /etc/nginx/sites-available/daryadarcy
ln -sfn /etc/nginx/sites-available/daryadarcy /etc/nginx/sites-enabled/daryadarcy
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
echo "Open http://200.165.234.36"
