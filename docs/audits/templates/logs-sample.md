# Образец обезличенных логов ошибок

> Полные production-логи не включаются в архив. Ниже — типичные паттерны без PII.

## API (PM2)

```
[Database] Connection pool ready
GET /api/health 200 2ms
POST /api/trpc/feed.listPaginated 200 45ms
[Database] Query timeout on posts (retry 1/3)
Error: ENOENT uploads/tmp/xxx — cleaned up
```

## nginx (access, обезличено)

```
xxx.xxx.xxx.xxx - - [28/Aug/2026:10:00:00 +0000] "GET /feed HTTP/1.1" 200
xxx.xxx.xxx.xxx - - [28/Aug/2026:10:00:01 +0000] "GET /api/trpc/feed.tags HTTP/1.1" 200
```

## nginx (errors)

```
upstream timed out (110: Connection timed out) while reading response header from upstream
client intended to send too large body
```

## Как запросить полный экспорт

Разработчик может выгрузить с VPS:

```bash
pm2 logs daryadarcy-api --lines 500 --nostream > api.log
# Затем вручную удалить IP, email, phone из строк
```

Срок хранения на VPS: по умолчанию PM2 log rotation (проверить `pm2 conf`).
