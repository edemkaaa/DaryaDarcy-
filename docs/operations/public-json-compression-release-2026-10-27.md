# Выпуск сжатия публичного JSON — 27 октября

Код `81191c8181404dbfde9b8ca3852745d72dd7dc1e` отправлен в staging и выпущен
около14:24МСК. Fresh fetch перед push: новых удалённых коммитов нет;
fast-forward0414dc9→81191c8 подтверждён ls-remote. Исправление3d34209 использует
originalUrl вместо изменяемого mounted tRPC req.path. Frontend не менялся.
Последующий коммит этого отчёта меняет только документацию/статусы.

## Проверка до переключения

- 75tests/4files GREEN: реальный mounted Nest/Express/tRPC, старые positive/
  negative compression cases, HTTP security и application. Types/API103/
  boundaries808/backend+TEST builds прошли. Изменения зависимостей/DDL отсутствуют.
- Настоящая история45 сверена по всем hash/time, pending=[]; новые миграции
  не запускались, записи истории не редактировались.
- Fresh single-transaction backup41таблица:538205B gzip/2309952B распаковано,
  SHA-256 `3097a1726dd38da5ece41403733d23040b3331e9573b83f4e27486c8ba612328`.
  Серверная/скачанная копии проверены. Реальное восстановление в own network-none
  MySQL подтвердило все строки, колонки, индексы,45ledger и3admin credentials.
  Одноразовый контейнер удалён поID/owner/tmpfs guard, OOM=false/restarts0.
- Новый Linux-образ проверен до переключения:13API checks и9compression checks
  с текущей БД. Workers/mail/payment/S3 не запускались; только auth activity
  timestamps могли обновляться. Полный рабочий snapshot после этого сохранён.

## Что изменено на сервере

| Сервис | Новый образ |
| --- | --- |
| API | `sha256:51a76d2963ec6f8fe6c85620c88ad699c05d26c38311d2d18b24724fbd15ba7e` |
| TEST | `sha256:7dd56be8b5d486994e85ffc4191381566572a228af7a43a2b327f6d69785456c` |

Оба имеют revision81191c8, healthy/restarts0/OOM=false. Компактные образы
собраны без сети/новых базовых образов/установки пакетов. В config изменены
только два image pin и readonly TEST bundle path. Фактические SHA файлов API
и смонтированного TEST bundle совпадают с манифестом выпуска. Compose --no-deps
пересоздал только API/TEST; nginx test/reload обновил адреса без правки конфигурации.

Webce56ebe и video5c0df13 сохранили image/ID/StartedAt; остальные контейнеры
также прежние. Resolved Compose/хеши файлов подтвердили прежние environment,
флаги, лимиты, SMTP/JWT/S3 и сетевые границы. БД не переключалась и не
восстанавливалась. Сохранены все строки41таблицы, колонки, индексы,45ledger,
три admin password/role/sessionVersion/block fingerprints; исключены только
обычные отметки активности входа. Платежей, писем и S3 PUT/DELETE не было.
Прежние образы/backup/исходные файлы сохранены. После выпуска свободно около833МиБ.

## Результат через настоящий HTTPS

`feed.listPaginated(limit12)`, один стабильный публичный ответ:

| Accept-Encoding | Content-Encoding | Байты тела |
| --- | --- | ---: |
| identity | нет | 16573 |
| gzip | gzip | 4025 |
| br | br | 3915 |
| br, gzip | br | 3915 |

После распаковки каждый ответ побайтно совпал с identity. Gzip уменьшил тело
на75,7%, Brotli — на76,4%; это уменьшение передачи JSON, не обещание такого же
ускорения всего экрана. Vary содержит Accept-Encoding. Качество/байты фото и
видео не менялись, новая политика кеширования персональных данных не вводилась.

9 внешних проверок также подтвердили отсутствие сжатия cookie/Authorization/
Range/смешанного auth.me пакета и400ошибки. Authorization через HTTPS проверен
с недействительным токеном на публичном чтении; отдельно9проверок внутри
настоящей сети API использовали действительную admin-сессию. Оба слоя GREEN.
Сжатие анонимного JSON не означает включения сжатия персональных ответов.

После переключения также прошли34API checks: admin/page API, две страницы
Ленты/Клуба без дублей и с клубной хронологией, comments/saved/calendar/counts,
DTO,400/401/413controls и22VK-карточки. Дополнительно35HTTP checks сохранили
готовность страниц,16SHA опубликованных JS/CSS и404/private,no-store для
четырёх старых закрытых путей. Новая проверка внешнего VK playback не заявляется.
Контроль после переключения подтвердил сохранность данных и сервисов.

## Артефакты и откат

Сервер: `/home/edem/apps/daryadarcy-staging/compression-release-20261027-f87635b9`.
Mac: `.local-artifacts/compression-release-20261027-f87635b9` родительского workspace.
Родительские каталоги700, secret/config/backup/receipts600, вне Git.
Сохранены baseline, backup,45expected migrations, image pins, manifest,
candidate/live/public-wire результаты и оператор.

При необходимости сначала исключить более поздний выпуск/config drift;
`python3 release.py rollback` из закрытого серверного каталога вернёт прежние
API/TEST образы и прежний TEST bundle, выполнит reload edge. Рабочая БД при
этом не восстанавливается; web/video/S3 не меняются. Старые образы проверены
наличием; откат подготовлен, но на здоровом выпуске не запускался.

Следующие ограничения прежние:32/80МиБ/нагрузка/пилот отложены, боевой Prodamus
ждёт настроек, старые клубные источники ещё не перенесены/не закрыты.
[Актуальный остаток](../audits/backend-remaining-after-release-2026-10-27.md),
[единый документ фронтендеру](../development/frontend-audit-handoff-2026-10-27.md).
