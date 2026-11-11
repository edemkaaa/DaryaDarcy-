#!/bin/bash
# Подготавливает системный локальный MySQL прежнего VPS. Не запускать на машине с существующими БД вместо создания одноразового контейнера.
# Install MariaDB on the VPS and apply drizzle schema migrations.
# Safe to re-run: skips CREATE errors, keeps existing data.
set -euo pipefail

APP=/var/www/daryadarcy
DB_NAME=daryadarcy
DB_USER=daryadarcy
PASS_FILE=/root/daryadarcy-db.pass
ENV_FILE=/root/daryadarcy-db.env

# Устанавливается системная MariaDB; это не одноразовая тестовая MySQL из текущего CI.
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y mariadb-server

systemctl enable --now mariadb

# Создаётся локальный пароль с закрытыми правами; он сохраняется для повторного запуска.
if [ ! -f "$PASS_FILE" ]; then
  openssl rand -base64 24 | tr -d '/+=' | head -c 24 > "$PASS_FILE"
  chmod 600 "$PASS_FILE"
fi
DB_PASS="$(tr -d '\n' < "$PASS_FILE")"

# Создаются база и пользователи с широкими правами для исторического приложения.
mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

MIG_DIR="$APP/drizzle-migrations"
if [ ! -d "$MIG_DIR" ]; then
  echo "Missing $MIG_DIR"
  exit 1
fi

# Опасный прежний режим игнорирует ошибки SQL и не ведёт надёжную историю миграций; для текущего выпуска не подходит.
for sql in $(ls "$MIG_DIR"/*.sql | sort); do
  echo "apply $(basename "$sql")"
  mysql --force "$DB_NAME" < "$sql" || true
done

DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@127.0.0.1:3306/${DB_NAME}"
printf 'DATABASE_URL=%s\n' "$DATABASE_URL" > "$ENV_FILE"
chmod 600 "$ENV_FILE"

# После локального бэкапа изменяется DATABASE_URL приложения; эта стадия фактически переключает подключение.
if [ -f "$APP/.env" ]; then
  cp "$APP/.env" "$APP/.env.bak.$(date +%Y%m%d%H%M%S)"
  if grep -q '^DATABASE_URL=' "$APP/.env"; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" "$APP/.env"
  else
    printf '\nDATABASE_URL=%s\n' "$DATABASE_URL" >> "$APP/.env"
  fi
fi

echo "OK local mysql: ${DB_NAME} on 127.0.0.1"
mysql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}'" 2>/dev/null || true
