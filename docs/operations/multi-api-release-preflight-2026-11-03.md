# Несколько API: проверка перед выпуском

03.11.2026. Это подготовка выпуска, не выполненное переключение сервера.
Текущая рабочая конфигурация не подтверждена: SSH завершился до авторизации
(banner timeout), HTTPS — без HTTP-ответа (TLS timeout). Эти наблюдения не
доказывают остановку сервера. БД/аккаунты/старые файлы не менялись.

## Что подготовлено

- 0050 и общая координация API — из предыдущего локального среза.
- `compose.multi-api.example.yaml` — отдельный кандидат: два основных API,
  MySQL max_connections50/TempTable64MiB, прежний buffer pool128MiB,
  API1536MiB на реплику, web2048MiB, MySQL2048MiB, stop grace15s.
  Это не профиль для существующего общего 4-ГБ стенда и не автоматическая
  настройка сервера. Не применять поверх неизвестных command overrides.
- В обоих штатных edge-шаблонах API upstream обновляется через Docker DNS.
  Pinned Nginx в локальной проверке — 1.30.5; `resolve` доступен в OSS с1.27.3.
- Read-only offline gate: `tooling/scripts/multi-api-preflight.ts`.
  Он проверяет итоговый resolved Compose, но сам не выполняет Docker up,
  запросы к рабочей БД, миграции, SSH или отправку сообщений.

## Порядок DevOps

1. Снять read-only факты с целевого хоста: MemTotal/MemAvailable, диск,
   работающие сервисы и их лимиты. Из MySQL получить фактический
   `@@max_connections`, текущие/пиковые соединения и историю миграций.
   Не подставлять паспортную RAM вместо фактического бюджета общего хоста.
2. Проверить весь private runtime stack, включая SMTP/egress/image-cache и TEST.
   На два API плюс один TEST-ingress приходится три пула по10; с резервом10
   соединений нужно минимум40. Прежних30 не хватает для этого бюджета.
   Кандидат50 — потолок для отдельной проверки, а не замер пикового расхода.
3. В закрытом api.env у всех API/TEST задать API_COORDINATION_MODE=mysql и
   API_REPLICA_COUNT=2. DATABASE_URL/JWT_SECRET/AUTH_LINK_ENCRYPTION_KEY должны
   совпадать между публичными API/TEST. SMS остаётся выключенным. Имеющиеся
   private-file/payment/strict flags не менять вслед за примером.
4. Добавить multi-api profile последним в существующий список overlays.
   Сохранить полный resolved config приватно: он содержит секреты. Файл не
   передавать фронтендеру, не коммитить, не печатать в CI.

```sh
umask 077
RELEASE_CHECK_DIR=$(mktemp -d /tmp/darcy-multi-preflight.XXXXXX)
# В исходной runtime-директории, используя тот же полный список -f overlays:
# docker compose ... -f compose.multi-api.example.yaml config --format json \
#   > "$RELEASE_CHECK_DIR/private-resolved.json"
# Числа ниже — только пример проверки, заменить реальными фактами хоста/БД.
pnpm exec tsx tooling/scripts/multi-api-preflight.ts \
  --config "$RELEASE_CHECK_DIR/private-resolved.json" \
  --host-memory-mib 16384 --mysql-max-connections 50
```

Gate учитывает лимит каждой реплики, всех остальных контейнеров и1GiB резерва
хоста, требует непубличные API-порты и достаточное время остановки. Проверены
топологии api и api+prodamus-test; candidate-api требует отдельного рассмотрения.
`ok:true` всегда сопровождается `productionApproval:false`: это не согласование
выкладки и не доказательство производительности, доставки писем или резервирования.
Проверка не пытается автоматически определять роли неизвестных дополнительных
API-сервисов: такие изменения требуют обновления перечня и отдельного ревью.

При старом 8GiB профиле простой scale API до2 превышает выбранный бюджет
сервисов с резервом. Не обходить отказ gate уменьшением RAM одного сервиса без
репетиции и не менять текущие лимиты лишь ради зелёной проверки.

5. Перед применением 0050 — свежий бэкап, проверка восстановления и истории.
   Сначала одинаковый проверенный backend/TEST bundle и mysql-mode на одной
   реплике, потом проверка схемы/API, затем масштабирование. Не оставлять старый
   TEST-код с локальными квотами рядом с новыми публичными API.
6. Выполнить nginx -t для окончательного edge config. Реальные private-конфиги
   могут содержать дополнительные защитные locations: перенести только resolver/
   upstream и ссылки API/media, не заменять файл базовым шаблоном вслепую.
   Сохранены запреты payment routes; `non_idempotent` retry не включать.
7. После выпуска проверить health каждой реплики, общий login quota, вход/отзыв
   сессии через разные реплики, отказ одной реплики и смену её адреса. Проверить
   graceful stop с начатым запросом и текущие приватные файлы разрешённым actor.
   Не выполнять реальные списания/письма ради инфраструктурного smoke.

## Откат

Сначала вернуть одну основную реплику и дождаться drain. Вернуть сохранённые
image pins, TEST bundle и edge config. Не удалять0050/таблицу счётчиков: она
аддитивная; старый код её не использует. Не менять accounts/receipts/leases вручную.
Восстановление БД из бэкапа не является штатным откатом этого изменения.

## Выполненные локальные доказательства

- Два независимых native API-процесса/MySQL: общие квоты и worker ownership.
- Real Nginx1.30.5 + Docker DNS в своей internal network: оба edge-шаблона
  распределяют запросы между двумя transport fixtures, видят новую реплику на
  другом IP без рестарта edge и не повторяют POST после неизвестного ответа.
  Это проверка прокси, не контейнерная сборка всего приложения.
- Реальный Docker Compose merge base/full-TEST + кандидат: budgets/env priority/
  неизменность private flags и безопасный CLI-ответ. Рабочие env не читались.
- Native HTTP/SQL graceful shutdown — существующий набор в полном mysql project.

Повторить опциональные проверки локально/на выделенном Docker runner:

```sh
API_EDGE_DOCKER_ACCEPTANCE=true pnpm exec vitest run --project unit tests/api-replica-edge.test.ts
API_MULTI_COMPOSE_ACCEPTANCE=true pnpm exec vitest run --project unit tests/multi-api-compose.test.ts
```

Используются только заранее загруженные pinned Nginx/Python fixtures (`--pull=never`).
Проектные API в SQL-сценариях запускаются настоящими Node22-процессами на хосте.
Контейнеры/сети помечены случайным owner label и удаляются только по нему.
Никакой Docker prune, удаления образов, томов или чужих контейнеров нет.
