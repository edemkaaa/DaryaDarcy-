# Сборка Daryadarcy для DevOps

Пакет готовит образы, но сам не обновляет сервер и не применяет миграции.
Текущий стенд использует TEST Prodamus. Боевые реквизиты ещё не получены.
Frontend source и дизайн для подготовки этого пакета не менялись.

## Назначение конфигураций

Внешний `nginx.conf` завершает TLS домена и передаёт запросы в локальный edge.
Внутренние `edge.conf` и `edge.video.conf` распределяют запросы между API и Next;
видео-вариант дополнительно знает старый YouTube-worker. Docker DNS нужен для
обновления адресов пересозданных API-реплик, а не для переключения рабочей БД.

Базовый `compose.yaml` не описывает все настройки конкретного выпуска. Файлы
`compose.images.yaml`, `compose.private-uploads.yaml`, `compose.yookassa.yaml`
и `compose.video.yaml` добавляют разные сети и ресурсы; один overlay не заменяет
другой. Разрешённый сетевой выход не включает функцию без её флага, а доступный
health endpoint не подтверждает оплату, SMTP или чтение настоящего S3-файла.

`compose.build.yaml` относится к сборке. Файлы `*example.yaml` задают отдельные
кандидатные изменения образов, подключения или ресурсов. Их комментарии описывают
границы применения, но не означают, что конфигурация проверена на новом хосте.
Секретное итоговое окружение и порядок overlays проверяются отдельно перед
применением; сами пояснения ни один контейнер не перезапускают.

## Несколько API

Есть отдельные `compose.multi-api.example.yaml` и
[offline preflight/порядок выпуска](../../../docs/operations/multi-api-release-preflight-2026-11-03.md).
Масштабирование удваивает API RAM/pool budget; прежний ресурсный профиль одного
API нельзя автоматически применить к двум репликам. Текущий сервер не переключён.

## Файлы

- `Dockerfile.backend`: API и отдельный `dist/prodamus-test.mjs`, non-root runtime.
- `Dockerfile`: существующий web/API runtime, с явными публичными build args.
- `compose.build.yaml`: только сборка api/web; video по профилю legacy-video.
- `build.public.env.example`: публичный профиль текущего стенда; секретов нет.
- `compose.release-images.example.yaml`: смена только двух image pins в полном runtime stack.
- `compose.resources-8gb.example.yaml`: отдельный ресурсный профиль нового выделенного VPS.

Dockerfile-specific `.dockerignore` исключают env/keys/node_modules/build output.
Собирать из чистого Git-архива на отдельном native amd64 builder. Не собирать
на текущем обслуживающем сервере с небольшим свободным диском/RAM.

## Воспроизводимая сборка

Выбрать проверенный полный commit SHA, содержащий этот пакет. Сначала убедиться,
что все нужные локальные изменения вошли в commit. Следующий пример создаёт
новый каталог; секретные env и приватные manifests остаются вне него.

```sh
SOURCE_REVISION=$(git rev-parse HEAD)
BUILD_DIR=$(mktemp -d /tmp/daryadarcy-build.XXXXXX)
git archive "$SOURCE_REVISION" | tar -x -C "$BUILD_DIR"
cd "$BUILD_DIR"
cp infrastructure/deploy/teamassist/build.public.env.example /tmp/daryadarcy-build.public.env
```

В копии публичного env заполнить SOURCE_REVISION тем же полным SHA и IMAGE_PREFIX
адресом registry/namespace, если образы будут отправляться в registry. Публичные
флаги сверить с согласованным выпуском. Shell env имеет приоритет над env-файлом;
проверить отсутствие старых NEXT_PUBLIC_* в окружении builder.

```sh
docker compose --env-file /tmp/daryadarcy-build.public.env \
  -f infrastructure/deploy/teamassist/compose.build.yaml config --quiet
docker compose --env-file /tmp/daryadarcy-build.public.env \
  -f infrastructure/deploy/teamassist/compose.build.yaml build api web
```

Это `build`, не `up`. MySQL, рабочие env, SMTP и S3 для сборки не нужны.
Обязательный SOURCE_REVISION не позволяет получить безымянный latest.
Дальнейший `push api web` выполняет DevOps в свой registry после проверки образов.
Зафиксировать manifest digest из registry, source label и публичный профиль.

Для существующего legacy video при необходимости отдельно:

```sh
docker compose --env-file /tmp/daryadarcy-build.public.env \
  -f infrastructure/deploy/teamassist/compose.build.yaml --profile legacy-video build video
```

VK iframe сам по себе не требует этого сервиса. Не удалять работающий video-service
без проверки старых consumers. Его существующие checksum/version pins сохранены.

## Публичные flags и TEST

Next компилирует NEXT_PUBLIC_* в клиент. Runtime env не меняет собранный клиент.
Пример явно включает VK и обложки, а также нынешний TEST и NORMAL recovery;
guest recovery и альтернативный CLUB_TEST_CHECKOUT выключены. Это staging-профиль,
не инструкция включить TEST на боевом сайте. PRIVATE_LIBRARY_FILES_ENABLED
в публичном build сейчас false; серверные library/content flags — отдельная
настройка, не менять их вслед за примером.

Один public origin: NEXT_PUBLIC_API_BASE_URL пустой; /api и /media проксируются
внутри к api:3000. Секреты не передавать в ARG/ENV Dockerfile, labels или build logs.
Для другого режима необходимы согласованные flags и отдельная приёмка.

API-образ содержит TEST bundle, но его наличие не включает функцию.
Нынешний prodamus-test Compose использует versioned bind mount. Для него извлечь
`/app/dist/prodamus-test.mjs` из принятого API-образа через временный `docker create`
и `docker cp`, без запуска, сохранить SHA256 и права файла; затем удалить только
этот временный контейнер. Передать versioned путь в PRODAMUS_TEST_BUNDLE и
принятый API digest в PRODAMUS_TEST_RUNTIME_IMAGE. На боевом денежном хосте
этот overlay не включать автоматически.

## Обновление runtime отдельно от сборки

1. Сохранить приватно resolved Compose, env, image digests и конфигурацию edge.
   Полный стек включает местные SMTP/egress/private/image-cache overrides.
   В действующем стеке edge использует edge.video.conf, а не базовый edge.conf.
2. Сохранить текущие JWT_SECRET/AUTH_LINK_ENCRYPTION_KEY, БД, password hashes,
   sessionVersion/роли, image-cache и backups volumes. Сохранить private manifest
   и image guard mounts/flags: чистый base Compose их не восстанавливает.
3. Свежий полный backup, проверка SHA второй копии, restore на отдельной БД.
   SQL-проверки выполнять последовательно отдельным ограниченным клиентом
   вне контейнера MySQL; учесть прежний OOM при параллельных проверках
   из [отчёта выпуска](../../../docs/operations/admin-recovery-release-2026-10-30.md).
   После выпуска 30 октября в истории 50 миграций: 0046–0049 уже применены.
   Использовать штатный preflight; не применять их второй раз и не исправлять
   0017–0019 вслепую.
   Включать admin_action_operations, access_email_outbox/password_tokens и
   videos.editRevision. До запуска workers на копии проверить старые status/ключи
   и конфликты ревизий. Для шифрованной очереди нужен исходный
   AUTH_LINK_ENCRYPTION_KEY; SQL-dump сам его не восстанавливает.
4. Подставить принятые API_RUNTIME_IMAGE и WEB_RUNTIME_IMAGE по digest. В полном
   прежнем стеке STAGING_IMAGE всё ещё нужен базовому Compose для interpolation;
   задать его принятым web digest, затем добавить compose.release-images.example.yaml
   последним. Сначала сравнить `config --format json` приватно: только image pins
   и, при согласованном TEST-выпуске, versioned bundle. Никакого `down -v`.
5. Проверить кандидат: native amd64, health, API/сессии/роли, фото, closed files,
   версии редакторов и публичные build flags. Только после согласования обновить
   нужные сервисы; остальные не пересоздавать. Миграции не выполняются entrypoint.
6. После: реальные image IDs/health/OOM/restarts, правильная БД и 50 записей в журнале,
   сохранённые админские входы, /api/health, /api/capabilities, страницы,22VK-карточки
   с thumbnailUrl, гостевой отказ закрытым bytes и TEST/LIVE режим.

Восстановление заполненных журналов и очереди с исходным ключом проверено локально:
[backup/restore и границы проверки](../../../docs/operations/admin-journals-restore-2026-10-30.md).
Снимок не содержит действий после времени backup; перед включением доставки
или реального биллинга сверить внешние эффекты. Восстановление старой копии
не даёт гарантии однократной доставки SMTP.

Текущий общий хост не подходит для автоматического применения8GB resource overlay.
Ресурсы и 32/80MiB/100users принимать на выделенном кандидате. Строгий content-флаг
пока false. Наличие container health не заменяет проверку API и БД.

## Откат

Вернуть сохранённые старые image pins и TEST bundle, затем пересоздать только
эти сервисы и проверить health. Additive0046–0049 и новые пользовательские данные
оставить. Восстановление старого дампа поверх новой рабочей БД не является кодовым
откатом. Старые образы/backup/оригиналы медиа не удалять.

## Проверка пакета

```sh
DEVOPS_BUILD_ACCEPTANCE=true pnpm exec vitest run tests/devops-build-config.test.ts
docker build --check -f infrastructure/deploy/teamassist/Dockerfile.backend .
docker build --check -f infrastructure/deploy/teamassist/Dockerfile .
```

Compose-тесты выполняют только config и используют пустой временный env,
не запускают контейнеры/базы и не читают рабочие секреты. `build --check` проверяет
Dockerfile, но не заменяет полную сборку/запуск нового образа на целевом builder.
