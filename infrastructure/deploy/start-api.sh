#!/bin/bash
# Запускает прежний API по серверным путям. Для нынешнего Compose порядок запуска и образ задаются отдельно.
set -euo pipefail
cd /var/www/daryadarcy
test -f dist/index.mjs
test -f .env
pm2 delete daryadarcy-api >/dev/null 2>&1 || true
NODE_ENV=production PORT=3000 HOST=127.0.0.1 pm2 start /usr/bin/node --name daryadarcy-api --cwd /var/www/daryadarcy --interpreter none -- dist/index.mjs
pm2 save
sleep 2
ss -tlnp | grep 3000 || true
curl -sS --max-time 8 http://127.0.0.1:3000/api/health
echo
curl -sS --max-time 15 "http://127.0.0.1/api/trpc/feed.tags" | head -c 200
echo
