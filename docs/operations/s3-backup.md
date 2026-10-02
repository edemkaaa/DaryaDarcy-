# Резервное копирование медиа S3 — daryadarcy-s3-backup

> Материал описывает прежнюю настройку инфраструктуры. Сервер, расписание, политики бакетов и успешное восстановление в рамках уборки репозитория не проверялись. Перед использованием сверяйте окружение и [порядок выпуска](../development/workflow.md); команды настройки меняют внешние системы.

## Файлы в текущем репозитории

- [infrastructure/deploy/s3-backup-lifecycle.json](../../infrastructure/deploy/s3-backup-lifecycle.json) — конфигурация политики, остаётся среди файлов инфраструктуры.
- [Отчёт резервирования от 18.09.2026](../audits/archive/deployment-snapshots/s3-backup-last-run-2026-09-18.json) и [тест восстановления той же даты](../audits/archive/deployment-snapshots/s3-backup-restore-test-2026-09-18.json) — неизменённые исторические снимки. Они не подтверждают текущее состояние S3.
- Новые s3-backup-last-run.json и s3-backup-restore-test.json в infrastructure/deploy/ или прежнем deploy/ игнорируются Git. Наличие локального отчёта не означает успешную проверку этого этапа.

До запуска требуется отдельный ремонт и проверка операционных путей: локальный
s3-media-backup.mjs всё ещё читает политику из deploy/, тогда как она находится
в infrastructure/deploy/. Оба Node-сценария пишут отчёты в прежний deploy/.
SSH-установщик кладёт Node-сценарий в scripts/ на сервере, но его вычисление корня
ожидает глубину tooling/operations/; он также ищет отчёт по другому пути.
В рамках уборки эти сценарии не запускались и не исправлялись. Команды ниже —
историческая схема, не готовая инструкция запуска из новой структуры.

## Архитектура

| Бакет | Назначение |
|-------|------------|
| `daryadarcy-s3` | Рабочий (production) |
| `daryadarcy-s3-backup` | Резервная копия медиа (append-only) |

- **Не зеркальная синхронизация:** скрипт только копирует и **никогда не удаляет** объекты в backup-бакете.
- **Версионирование:** включено на backup-бакете.
- **Lifecycle:** предыдущие (noncurrent) версии удаляются через **90 дней**; текущие версии и файлы, удалённые из рабочего бакета, **остаются** в backup.
- **Bucket policy:** **любое удаление через S3 API запрещено** (включая ключи приложения). Восстановление/очистка — через панель Timeweb или временное снятие policy.

## Расписание

Cron на VPS: **каждое воскресенье в 03:00 MSK**

```
/etc/cron.d/daryadarcy-s3-backup
0 3 * * 0 root cd /var/www/daryadarcy && node scripts/s3-media-backup.mjs >> /var/log/daryadarcy-s3-backup.log 2>&1
```

## Credentials

Файл на VPS (не в приложении): `/etc/daryadarcy/s3-backup.env`

- `SOURCE_S3_*` — чтение рабочего бакета
- `BACKUP_S3_*` — запись в backup-бакет
- `APP_S3_ACCESS_KEY` — ID ключа приложения (для bucket policy)

Endpoint: `https://s3.twcstorage.ru`, регион: `ru-1`.

## Ручной запуск backup

```bash
ssh root@200.165.234.36
export S3_BACKUP_ENV=/etc/daryadarcy/s3-backup.env
cd /var/www/daryadarcy
node scripts/s3-media-backup.mjs          # копирование
node scripts/s3-media-backup.mjs --verify # сверка объёмов
node scripts/s3-media-backup.mjs --setup  # versioning + lifecycle + policy
```

---

## Восстановление одного файла

### Шаг 1. Найти путь к файлу в backup

Путь совпадает с рабочим бакетом, например:
- `feed/2024/photo.jpg`
- `app-assets/shop/book-1/cover.png`
- `avatars/user123.webp`

### Шаг 2. Скопировать в рабочий бакет

**Через AWS CLI** (нужны ключи из `s3-backup.env` или `.env`):

```bash
export AWS_ACCESS_KEY_ID=ВАШ_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=ВАШ_SECRET_KEY

aws s3 cp \
  s3://daryadarcy-s3-backup/feed/2024/photo.jpg \
  s3://daryadarcy-s3/feed/2024/photo.jpg \
  --endpoint-url https://s3.twcstorage.ru
```

**Через Node.js на VPS** (если AWS CLI не установлен):

```bash
ssh root@200.165.234.36
export S3_BACKUP_ENV=/etc/daryadarcy/s3-backup.env
cd /var/www/daryadarcy
node -e "
import { S3Client, CopyObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('/etc/daryadarcy/s3-backup.env','utf8').split(/\n/).filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const c = new S3Client({ endpoint: env.S3_ENDPOINT, region: 'ru-1', credentials: { accessKeyId: env.BACKUP_S3_ACCESS_KEY, secretAccessKey: env.BACKUP_S3_SECRET_KEY }, forcePathStyle: true });
const key = 'feed/2024/photo.jpg';
await c.send(new CopyObjectCommand({ Bucket: 'daryadarcy-s3', Key: key, CopySource: 'daryadarcy-s3-backup/' + key.split('/').map(encodeURIComponent).join('/') }));
console.log('restored', key);
"
```

### Шаг 3. Проверить

Откройте URL файла в браузере:

```
https://s3.twcstorage.ru/daryadarcy-s3/feed/2024/photo.jpg
```

---

## Восстановление предыдущей версии файла

Версионирование включено на backup-бакете. Если файл **перезаписывался** после backup, старые версии доступны 90 дней.

### Шаг 1. Посмотреть список версий

```bash
aws s3api list-object-versions \
  --bucket daryadarcy-s3-backup \
  --prefix feed/2024/photo.jpg \
  --endpoint-url https://s3.twcstorage.ru
```

В ответе найдите нужный `VersionId` (не `null` у `IsLatest` — это старая версия).

### Шаг 2. Восстановить конкретную версию в рабочий бакет

```bash
aws s3api copy-object \
  --bucket daryadarcy-s3 \
  --key feed/2024/photo.jpg \
  --copy-source "daryadarcy-s3-backup/feed/2024/photo.jpg?versionId=ВАШ_VERSION_ID" \
  --endpoint-url https://s3.twcstorage.ru
```

### Шаг 3. Или скачать версию локально для просмотра

```bash
aws s3api get-object \
  --bucket daryadarcy-s3-backup \
  --key feed/2024/photo.jpg \
  --version-id ВАШ_VERSION_ID \
  restored-photo.jpg \
  --endpoint-url https://s3.twcstorage.ru
```

> **Важно:** если файл **удалён** из рабочего бакета, но **не перезаписывался** в backup — достаточно обычного `aws s3 cp` (см. выше): в backup остаётся текущая версия.

---

## Восстановление всего бакета

Используйте при полной потере рабочего бакета или миграции.

### Вариант A — sync (перезапишет одноимённые файлы в рабочем бакете)

```bash
# Сначала посмотреть, что будет скопировано:
aws s3 sync s3://daryadarcy-s3-backup s3://daryadarcy-s3 \
  --endpoint-url https://s3.twcstorage.ru \
  --dryrun

# Затем выполнить:
aws s3 sync s3://daryadarcy-s3-backup s3://daryadarcy-s3 \
  --endpoint-url https://s3.twcstorage.ru
```

### Вариант B — в новый временный бакет (безопаснее для проверки)

```bash
aws s3 sync s3://daryadarcy-s3-backup s3://daryadarcy-s3-restored-test \
  --endpoint-url https://s3.twcstorage.ru
```

После проверки содержимого — переключите приложение или скопируйте в рабочий бакет.

### Оценка времени

~7 ГБ, ~5 700 файлов — обычно **10–30 минут** с VPS Timeweb.

---

## Тестовое восстановление (без изменения production)

Скрипт копирует 2–3 файла из backup в тестовую папку **внутри backup-бакета** (`restore-test/YYYY-MM-DD/`) и проверяет, что они читаются:

```bash
ssh root@200.165.234.36
export S3_BACKUP_ENV=/etc/daryadarcy/s3-backup.env
cd /var/www/daryadarcy
node scripts/s3-backup-restore-test.mjs
```

Прежний путь отчёта: `deploy/s3-backup-restore-test.json` (генерируемый, не коммитится). Сохранённый результат от 18.09.2026 находится в архиве по ссылке выше.

---

## Логи и отчёты

| Файл | Содержание |
|------|------------|
| `/var/log/daryadarcy-s3-backup.log` | Лог еженедельного backup |
| `deploy/s3-backup-last-run.json` | Прежний путь генерируемого отчёта; не актуальный снимок в Git |
| `deploy/s3-backup-restore-test.json` | Прежний путь генерируемого теста; не подтверждение текущего восстановления |

---

## Доступ в панели Timeweb

Бакет `daryadarcy-s3-backup` создан в том же аккаунте Timeweb Cloud, что и `daryadarcy-s3`.

**Путь в панели:** [timeweb.cloud](https://timeweb.cloud) → **Хранилище S3** → список бакетов.

Чтобы видеть бакет с правами владельца, нужен доступ **Administrator** к аккаунту Timeweb Cloud (приглашение на email в разделе «Команда»). После добавления `daryadarcy19@gmail.com` оба бакета будут видны в панели.
