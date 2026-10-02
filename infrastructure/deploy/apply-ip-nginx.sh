#!/bin/bash
set -euo pipefail
APP=/var/www/daryadarcy
cp "$APP/infrastructure/deploy/nginx-daryadarcy.conf" /etc/nginx/sites-available/daryadarcy
ln -sfn /etc/nginx/sites-available/daryadarcy /etc/nginx/sites-enabled/daryadarcy
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
echo "Open http://200.165.234.36"
