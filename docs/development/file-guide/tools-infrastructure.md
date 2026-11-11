# Инструменты и инфраструктура: файлы и блоки

Справочник извлечён из путей, комментариев и объявлений. Он не подтверждает ручной разбор каждого блока или готовность выпуска.

[Общая карта](index.md)

## [apps/video-service/cache.mjs](../../../apps/video-service/cache.mjs)

Хранит только временные подготовленные публичные ролики. Активные читатели удерживают файл от вытеснения, а последняя отмена зрителя прекращает общую подготовку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `busy` | 5 | Функция. Подробности и ограничения — в исходнике. |
| `createVideoCache` | 10 | Owns only directories created inside a private, non-shared cache mount. |
| `remove` | 32 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `prepareEntry` | 39 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `acquire` | 78 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `close` | 141 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [apps/video-service/Dockerfile](../../../apps/video-service/Dockerfile)

Закрепляет runtime и контрольную сумму загрузчика, устанавливая FFmpeg из подписанного Debian-репозитория. Обновление бинарников при запуске контейнера не выполняется. Use Debian's signed security repositories, not a third-party media binary.

## [apps/video-service/Dockerfile.dockerignore](../../../apps/video-service/Dockerfile.dockerignore)

Ограничивает контекст самостоятельной сборки video-worker его исходниками, без тестовых и локальных операционных файлов.

## [apps/video-service/main.mjs](../../../apps/video-service/main.mjs)

Связывает HTTP-сервер с временным кешем и точечной проверкой публикации через edge. У worker нет SQL-доступа и пользовательских сессий.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `cache` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `server` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/video-service/prepare.mjs](../../../apps/video-service/prepare.mjs)

Подготавливает совместимый MP4 без перекодирования, ограничивая время, размер и дочерние процессы. URL выводится из проверенного ID, cookies и плагины загрузчика не используются.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `runCommand` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `prepareVideo` | 59 | Функция. Подробности и ограничения — в исходнике. |

## [apps/video-service/README.md](../../../apps/video-service/README.md)

Public-video worker. Инструкция или навигация по проекту.

## [apps/video-service/server.mjs](../../../apps/video-service/server.mjs)

Выдаёт только опубликованные ролики и проверенные обложки с поддержкой Range. Повторная проверка публикации после подготовки не даёт кешу обойти снятие доступа.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `byteRange` | 6 | Функция. Подробности и ограничения — в исходнике. |
| `error` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `createVideoServer` | 25 | Public catalog playback only; never accepts upstream URLs or credentials. |

## [apps/video-service/test/cache.test.mjs](../../../apps/video-service/test/cache.test.mjs)

Проверяет объединение подготовки, отмену зрителей и вытеснение только свободных временных файлов; использует собственные каталоги и управляемое время.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `cleanups` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `id` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `otherId` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `exists` | 23 | Функция. Подробности и ограничения — в исходнике. |
| `rejectionWithin` | 28 | Функция. Подробности и ограничения — в исходнике. |
| `cacheWith` | 39 | Функция. Подробности и ограничения — в исходнике. |

## [apps/video-service/test/prepare.test.mjs](../../../apps/video-service/test/prepare.test.mjs)

Проверяет аргументы и остановку дочерних процессов подготовки без загрузки настоящего YouTube-ролика.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `directories` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `directory` | 14 | Функция. Подробности и ограничения — в исходнике. |
| `media` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `metadata` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/video-service/test/server.test.mjs](../../../apps/video-service/test/server.test.mjs)

Проверяет HTTP-границы выдачи, публикацию и byte range на управляемых источниках, а не на рабочем каталоге.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `cleanups` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `id` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `start` | 16 | Функция. Подробности и ограничения — в исходнике. |

## [apps/video-service/test/thumbnail-cache.test.mjs](../../../apps/video-service/test/thumbnail-cache.test.mjs)

Проверяет TTL, размер и ошибки кеша обложек; ошибочный ответ источника не должен становиться сохранённой картинкой.

## [apps/video-service/test/upstream.test.mjs](../../../apps/video-service/test/upstream.test.mjs)

Проверяет ограничение и разбор ответов внешних источников без доверия произвольному JSON или клиентскому URL.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `servers` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `upstream` | 15 | Функция. Подробности и ограничения — в исходнике. |

## [apps/video-service/upstream.mjs](../../../apps/video-service/upstream.mjs)

Читает ограниченные ответы каталога и обложек с фиксированных источников. Ошибки не превращаются в разрешённую публикацию или бесконечный кеш.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `boundedBody` | 2 | Функция. Подробности и ограничения — в исходнике. |
| `readPublicCatalog` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `readPublicYoutubeState` | 55 | Функция. Подробности и ограничения — в исходнике. |
| `readThumbnail` | 72 | Функция. Подробности и ограничения — в исходнике. |
| `createThumbnailReader` | 95 | Cache validated public thumbnail bytes only. Publication is still checked by the HTTP handler before AND after every read, including cache hits. |

## [infrastructure/ci/gitlab-runner/compose.yaml](../../../infrastructure/ci/gitlab-runner/compose.yaml)

Запускает только manager отдельного CI-runner. Docker socket даёт ему контроль выделенного хоста; рабочим job-контейнерам socket не передаётся.

## [infrastructure/ci/gitlab-runner/config.toml.example](../../../infrastructure/ci/gitlab-runner/config.toml.example)

Служебный файл проекта; назначение уточняется по каталогу и связанному README.

## [infrastructure/ci/gitlab-runner/README.md](../../../infrastructure/ci/gitlab-runner/README.md)

Отдельный runner для проверок Daryadarcy. Инструкция или навигация по проекту.

## [infrastructure/deploy/apply-ip-nginx.sh](../../../infrastructure/deploy/apply-ip-nginx.sh)

Исторически настраивает Nginx для доступа по IP. Не применять поверх актуального доменного Docker-стека без сверки конфигурации.

## [infrastructure/deploy/ecosystem.config.cjs](../../../infrastructure/deploy/ecosystem.config.cjs)

Описывает прежний PM2-процесс API. Не является конфигурацией количества реплик текущего Compose.

## [infrastructure/deploy/fix-nginx.sh](../../../infrastructure/deploy/fix-nginx.sh)

Исправляет прежнюю серверную конфигурацию Nginx. Перед применением требуется сравнение с фактическим доменным vhost.

## [infrastructure/deploy/install.sh](../../../infrastructure/deploy/install.sh)

Устанавливает прежний архив приложения в серверные каталоги. Это изменяющий систему сценарий, не сборка контейнерного runtime.

## [infrastructure/deploy/nginx-daryadarcy.conf](../../../infrastructure/deploy/nginx-daryadarcy.conf)

Конфигурация прежнего статического сайта и API. Для актуального Next/Compose используется отдельный teamassist edge и доменный vhost. HTTP: ACME + redirect domain to HTTPS. IP stays on HTTP, but never serves API credentials.

## [infrastructure/deploy/restart.sh](../../../infrastructure/deploy/restart.sh)

Перезапускает прежний серверный процесс. Не заменяет проверку image digest, миграций и готовности реплик в Compose. Restart after reboot. Run as root: bash /var/www/daryadarcy/infrastructure/deploy/restart.sh

## [infrastructure/deploy/s3-backup-lifecycle.json](../../../infrastructure/deploy/s3-backup-lifecycle.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [infrastructure/deploy/setup-local-mysql.sh](../../../infrastructure/deploy/setup-local-mysql.sh)

Подготавливает системный локальный MySQL прежнего VPS. Не запускать на машине с существующими БД вместо создания одноразового контейнера. Install MariaDB on the VPS and apply drizzle schema migrations. Safe to re-run: skips CREATE errors, keeps existing data.

## [infrastructure/deploy/start-api.sh](../../../infrastructure/deploy/start-api.sh)

Запускает прежний API по серверным путям. Для нынешнего Compose порядок запуска и образ задаются отдельно.

## [infrastructure/deploy/teamassist/build.public.env.example](../../../infrastructure/deploy/teamassist/build.public.env.example)

Служебный файл проекта; назначение уточняется по каталогу и связанному README.

## [infrastructure/deploy/teamassist/compose.build.yaml](../../../infrastructure/deploy/teamassist/compose.build.yaml)

Только описание сборки образов с обязательной ревизией. Не объединять с runtime-стеком для up: базы и рабочие env при сборке не нужны. BUILD ONLY. Never merge this file into the runtime Compose or run 'up' with it. Build from a clean git archive; this file does not load any deployment secrets.

## [infrastructure/deploy/teamassist/compose.candidate-api.example.yaml](../../../infrastructure/deploy/teamassist/compose.candidate-api.example.yaml)

Подставляет отдельные образ и env БД-кандидата только для API. Замена списка env через !override не должна незаметно наследовать старое подключение. Offline preparation only. Applying this requires separate switch approval. Keep STAGING_IMAGE at the recorded baseline: it still controls the web image

## [infrastructure/deploy/teamassist/compose.images.yaml](../../../infrastructure/deploy/teamassist/compose.images.yaml)

Даёт Next доступ к публичным источникам и отдельному image-cache. Сеть не открывает исходящий доступ API и не меняет защиту закрытых файлов. Opt-in: public S3 previews require outbound HTTPS from web, never from api. Use together with the SMTP/video overlays, not instead of them.

## [infrastructure/deploy/teamassist/compose.multi-api.example.yaml](../../../infrastructure/deploy/teamassist/compose.multi-api.example.yaml)

Пример двух API требует общей SQL-координации и суммарного бюджета памяти/соединений. Не применять масштабирование без отдельного preflight целевого хоста. Reviewed candidate profile, not a command to scale the existing shared host. Append after all runtime overlays; run multi-api-preflight against

## [infrastructure/deploy/teamassist/compose.private-uploads.yaml](../../../infrastructure/deploy/teamassist/compose.private-uploads.yaml)

Добавляет ограниченный выход API к S3 через внутренний alias. Флаги загрузок остаются отдельным решением после проверки схемы, прав и TLS. Reviewed opt-in overlay. Keep flags false in private-uploads.env until the same-DB/schema/policy/identity/TLS preflight has passed. Never publish ports.

## [infrastructure/deploy/teamassist/compose.prodamus-test.yaml](../../../infrastructure/deploy/teamassist/compose.prodamus-test.yaml)

Отдельный TEST ingress использует принятый runtime и versioned bundle. Наличие этого сервиса не разрешает реальные списания или автоматическое включение на боевом хосте. Append to existing dev overlays; never enable this service on a live-money host.

## [infrastructure/deploy/teamassist/compose.release-images.example.yaml](../../../infrastructure/deploy/teamassist/compose.release-images.example.yaml)

Меняет только закреплённые API/web-образы поверх полного прежнего стека. Остальные env, volume и overlays должны быть сохранены отдельно. Image pins only. Append to the COMPLETE accepted runtime stack after its overlays. Preserve the current database, private manifests, egress/SMTP and image-cache m

## [infrastructure/deploy/teamassist/compose.resources-8gb.example.yaml](../../../infrastructure/deploy/teamassist/compose.resources-8gb.example.yaml)

Профиль верхних лимитов для выделенного хоста; CPU-лимиты не резервируют ядра. Это не разрешение применить их к малому общему серверу. Resource ceilings only, for a dedicated host with at least 4 vCPU and 8 GiB RAM. Append AFTER all existing overlays. This is not a complete production config. Do not

## [infrastructure/deploy/teamassist/compose.video.yaml](../../../infrastructure/deploy/teamassist/compose.video.yaml)

Изолирует прежний YouTube-worker от БД и пользовательских секретов. Временные файлы живут в ограниченном tmpfs, VK iframe этот сервис не требует. Opt-in staging-only overlay. Preserve the existing SMTP/local override too.

## [infrastructure/deploy/teamassist/compose.yaml](../../../infrastructure/deploy/teamassist/compose.yaml)

Базовый staging-стек разделяет API, Next, MySQL и edge по сетям. Локальные egress/кеш/секретные overlays добавляются отдельно и не восстанавливаются одним этим файлом.

## [infrastructure/deploy/teamassist/compose.yookassa.yaml](../../../infrastructure/deploy/teamassist/compose.yookassa.yaml)

Разрешает только отдельный TEST-выход к платёжному API. Сетевой доступ сам не включает checkout и не подтверждает боевые настройки. Opt-in TEST-only payment egress, not permission to enable checkout. Append to ALL existing SMTP/video/image overlays; do not replace them.

## [infrastructure/deploy/teamassist/Dockerfile](../../../infrastructure/deploy/teamassist/Dockerfile)

Собирает общий web/API runtime из зафиксированного исходного среза. Публичные NEXT_PUBLIC-флаги встраиваются в Next при сборке; секреты в build args не передаются. Build from a git-archive context, not a working tree containing local secrets.

## [infrastructure/deploy/teamassist/Dockerfile.backend](../../../infrastructure/deploy/teamassist/Dockerfile.backend)

Отдельный runtime содержит API и TEST-bundle, но не запускает миграции. Установка production-зависимостей отделена от сборочных инструментов, процесс работает без root. Separate API artifact; the existing combined web/API rollout is unchanged. All workspace manifests are required by the authoritativ

## [infrastructure/deploy/teamassist/Dockerfile.backend.dockerignore](../../../infrastructure/deploy/teamassist/Dockerfile.backend.dockerignore)

Разрешает только исходники и manifest-файлы, необходимые API-образу. Локальные ключи, frontend assets и рабочие данные не должны попадать в контекст.

## [infrastructure/deploy/teamassist/Dockerfile.dockerignore](../../../infrastructure/deploy/teamassist/Dockerfile.dockerignore)

Исключает локальные зависимости, результаты сборок и типовые секретные файлы из контекста. Для выпуска всё равно нужен чистый Git-архив, а не произвольная рабочая папка.

## [infrastructure/deploy/teamassist/edge.conf](../../../infrastructure/deploy/teamassist/edge.conf)

Внутренний edge проксирует web/API и обновляет адреса реплик через Docker DNS. Защита внешнего домена и его ограничения задаются отдельным vhost.

## [infrastructure/deploy/teamassist/edge.video.conf](../../../infrastructure/deploy/teamassist/edge.video.conf)

Дополняет внутренний edge маршрутами старого video-worker. Проверка публикации ролика остаётся в worker, а не заменяется фактом существования маршрута.

## [infrastructure/deploy/teamassist/nginx.conf](../../../infrastructure/deploy/teamassist/nginx.conf)

Внешний TLS-vhost staging направляет запросы в loopback edge. TEST-ограничения этого шаблона не следует переносить на боевую оплату без отдельного решения. Install only after expose-app has issued this test domain's certificate.

## [infrastructure/deploy/teamassist/README.build.md](../../../infrastructure/deploy/teamassist/README.build.md)

Сборка Daryadarcy для DevOps. Инструкция или навигация по проекту.

## [infrastructure/deploy/teamassist/s3-egress.conf](../../../infrastructure/deploy/teamassist/s3-egress.conf)

TLS passthrough сохраняет проверку сертификата S3 на стороне API; VK-шлюз принимает только разрешённые хосты обложек. Закреплённый S3 IP требует проверки перед применением. S3 TLS passthrough plus a private, fixed-destination VK preview gateway. Recheck host DNS and verified endpoint certificate bef

## [infrastructure/deploy/teamassist/yookassa-egress.conf](../../../infrastructure/deploy/teamassist/yookassa-egress.conf)

Ограничивает платёжный TLS-выход по SNI и внешнему DNS, чтобы внутренний alias не создал петлю. Повтор неидемпотентной внешней операции здесь не включается. TLS passthrough: Node verifies the provider certificate end to end. Never resolve the upstream through Docker's api.yookassa.ru alias (DNS loop

## [infrastructure/deploy/vps-fresh.sh](../../../infrastructure/deploy/vps-fresh.sh)

Историческая установка на новый VPS меняет системные пакеты и службы. Перед новым размещением нужен актуальный Docker-пакет и проверенный план восстановления данных. Wipe the previous app and install a fresh IP-only build. Run as root. Keeps /root/daryadarcy.env.bak

## [tooling/assets/compress-garden-video.py](../../../tooling/assets/compress-garden-video.py)

Подготавливает отдельный сжатый ролик по прежним путям проекта. Это ручная обработка конкретного исходника, а не изменение общего upload-контракта.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `download_url` | 15 | Именованный блок инструмента. Побочные эффекты и условия запуска проверяются в исходнике. |

## [tooling/assets/extract-woolen-font.mjs](../../../tooling/assets/extract-woolen-font.mjs)

Извлекает шрифт Woolen в публичные каталоги прежних клиентов; операция меняет локальные ресурсы, не настройки браузерного кеша.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `assets` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `zipPath` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `py` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `siteFonts` | 41 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/assets/fetch-quiz-yandex.mjs](../../../tooling/assets/fetch-quiz-yandex.mjs)

Сопоставляет каталоги публичного Яндекс Диска с иллюстрациями теста. Перед записью нужно сверить наборы эстетик; доступность источника зависит от сети.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PUBLIC_KEY` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `API` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FOLDER_MAP` | 16 | Folder names on https://disk.yandex.ru/d/KJ2NPBMLMGoO6w |
| `AESTHETIC_MAP` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `api` | 32 | Функция. Подробности и ограничения — в исходнике. |
| `downloadHref` | 42 | Функция. Подробности и ограничения — в исходнике. |
| `parseAesthetic` | 49 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 56 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/assets/fix-asset-webp-refs.mjs](../../../tooling/assets/fix-asset-webp-refs.mjs)

Меняет локальные require-ссылки после конвертации PNG в WebP. Запускать только вместе с проверкой реально созданных файлов.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `frontendRoot` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `skip` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `codeExt` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `changed` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `walkCode` | 13 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/assets/generate-frontend-image-catalog.mjs](../../../tooling/assets/generate-frontend-image-catalog.mjs)

Создаёт отпечатки используемых локальных изображений для статических импортов Next, не перекодируя пиксели.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `frontend` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `output` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `retired` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `manifest` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `walk` | 16 | Функция. Подробности и ограничения — в исходнике. |
| `uris` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `entries` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `imports` | 34 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `mapping` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `variants` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/assets/generate-private-library-retirement.mjs](../../../tooling/assets/generate-private-library-retirement.mjs)

Формирует точный manifest старых платных копий для маршрутизации. Сам не удаляет оригиналы и не закрывает объекты в хранилище.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `frontend` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `registry` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `output` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `previous` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `paths` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hashes` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sha` | 25 | Функция. Подробности и ограничения — в исходнике. |
| `variants` | 46 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `legacyBuildPaths` | 55 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `media` | 56 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/assets/lossless-png.mjs](../../../tooling/assets/lossless-png.mjs)

Перефильтровывает и перепаковывает PNG без изменения образцов и дополнительных chunks. Это сохраняет 16-битный цвет и профили, которые теряются при неосторожной конвертации.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `signature` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `channels` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `chunks` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `paeth` | 23 | Функция. Подробности и ограничения — в исходнике. |
| `predictor` | 28 | Функция. Подробности и ограничения — в исходнике. |
| `unfilter` | 38 | Функция. Подробности и ограничения — в исходнике. |
| `refilter` | 52 | Функция. Подробности и ограничения — в исходнике. |
| `idat` | 75 | Функция. Подробности и ограничения — в исходнике. |
| `optimizeLosslessPng` | 83 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/assets/lossless-png.test.mjs](../../../tooling/assets/lossless-png.test.mjs)

Проверяет сохранение образцов и структуры PNG при перепаковке, включая случаи, где меньший размер не должен покупаться изменением цвета.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `decode` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `rgba` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/assets/make-placeholders.mjs](../../../tooling/assets/make-placeholders.mjs)

Создаёт отсутствующие локальные заглушки; наличие заглушки не означает, что исходный пользовательский файл восстановлен.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `assets` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PNG` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `JPG` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `writeIfMissing` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `list` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `created` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `icons` | 39 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/assets/manus-cdn-urls.txt](../../../tooling/assets/manus-cdn-urls.txt)

Служебный файл проекта; назначение уточняется по каталогу и связанному README.

## [tooling/assets/missing-local-assets.txt](../../../tooling/assets/missing-local-assets.txt)

Служебный файл проекта; назначение уточняется по каталогу и связанному README.

## [tooling/assets/normalize-frontend-images.mjs](../../../tooling/assets/normalize-frontend-images.mjs)

Нормализует только локальные статические изображения и сохраняет отчёт. Удалённые S3-объекты и медиа API не являются целями операции.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `frontend` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `publicDir` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `manifestPath` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hash` | 13 | Функция. Подробности и ограничения — в исходнике. |
| `iconUris` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `pattern` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `isLosslessWebp` | 17 | Функция. Подробности и ограничения — в исходнике. |
| `walk` | 27 | Функция. Подробности и ограничения — в исходнике. |
| `normalizeFrontendImages` | 34 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/assets/optimize-frontend-external-images.mjs](../../../tooling/assets/optimize-frontend-external-images.mjs)

Сверяет внешние публичные картинки и при явном разрешении сохраняет проверенные локальные копии меньшего размера. В S3 не записывает.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sourceDir` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `publicDir` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `write` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `argument` | 16 | Функция. Подробности и ограничения — в исходнике. |
| `cacheDir` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `reportPath` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `resumePath` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `downloadTimeout` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `attempts` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hash` | 23 | Функция. Подробности и ограничения — в исходнике. |
| `walk` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `sources` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `urls` | 34 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `dynamicPatterns` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `download` | 47 | Функция. Подробности и ограничения — в исходнике. |
| `pixels` | 70 | Функция. Подробности и ограничения — в исходнике. |
| `jpegtranAvailable` | 73 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `results` | 76 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `replacements` | 77 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `index` | 78 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `queue` | 79 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `before` | 154 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `after` | 155 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `report` | 156 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/assets/optimize-frontend-images.mjs](../../../tooling/assets/optimize-frontend-images.mjs)

Принимает только подтверждённое уменьшение без изменения декодированных пикселей; запись включается отдельно от анализа.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `publicDir` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sourceDir` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `write` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `reportPath` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `walk` | 17 | Функция. Подробности и ограничения — в исходнике. |
| `pixels` | 27 | Функция. Подробности и ограничения — в исходнике. |
| `sources` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `results` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `tempDir` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `jpegtranAvailable` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `before` | 106 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `after` | 107 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `report` | 108 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/assets/optimize-local-assets.mjs](../../../tooling/assets/optimize-local-assets.mjs)

Прежний пакетный оптимизатор локальных assets допускает перекодирование. Его нельзя считать доказательством lossless-качества для всех изображений.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `assetsDir` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SKIP_BASENAMES` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `dryRun` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `minKb` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `skipDir` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `pathMap` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `saved` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `count` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `walk` | 31 | Функция. Подробности и ограничения — в исходнике. |
| `processFile` | 43 | Функция. Подробности и ограничения — в исходнике. |
| `walkCode` | 112 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tooling/assets/optimize-site-images.mjs](../../../tooling/assets/optimize-site-images.mjs)

Скачивает выбранные публичные картинки S3 и готовит локальные варианты сайта. Уменьшение размеров и quality здесь не являются lossless-операцией.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `outDir` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `jobs` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/assets/prepare-frontend-image-variants.mjs](../../../tooling/assets/prepare-frontend-image-variants.mjs)

Готовит уменьшенные варианты публичной статики для экранов. Полноразмерные загрузки и объекты S3 не переписывает.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `frontend` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `publicDir` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sourceDir` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `manifestPath` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `write` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `reuse` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `cacheDir` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sha` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `imagePattern` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `walk` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `sources` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `refs` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `audit` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `external` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `previousOutputs` | 38 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `previous` | 39 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `previousByFull` | 44 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `zoomable` | 45 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `about` | 46 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `patterns` | 50 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `products` | 52 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `replacements` | 57 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `images` | 58 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `widths` | 59 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `outputDir` | 60 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `existingNames` | 62 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/assets/promo-bake-paper.py](../../../tooling/assets/promo-bake-paper.py)

Собирает промо-картинки поверх бумажной текстуры, чтобы прозрачность совпадала с фоном экрана. Это создание новых локальных вариантов.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `load_paper` | 20 | Именованный блок инструмента. Побочные эффекты и условия запуска проверяются в исходнике. |
| `bake` | 28 | Именованный блок инструмента. Побочные эффекты и условия запуска проверяются в исходнике. |
| `main` | 42 | Именованный блок инструмента. Побочные эффекты и условия запуска проверяются в исходнике. |

## [tooling/assets/promo-black-to-alpha.py](../../../tooling/assets/promo-black-to-alpha.py)

Убирает только близкий к чистому чёрному фон промо-картинок; консервативный порог нужен, чтобы сохранить тени внутри фотографий.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `convert` | 13 | Именованный блок инструмента. Побочные эффекты и условия запуска проверяются в исходнике. |
| `main` | 26 | Именованный блок инструмента. Побочные эффекты и условия запуска проверяются в исходнике. |

## [tooling/assets/promo-flatten-cream.py](../../../tooling/assets/promo-flatten-cream.py)

Формирует непрозрачный WebP на кремовом фоне приложения, устраняя чёрные ореолы от неверной обработки прозрачности.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `replace_black_background` | 14 | Именованный блок инструмента. Побочные эффекты и условия запуска проверяются в исходнике. |
| `save_webp` | 32 | Именованный блок инструмента. Побочные эффекты и условия запуска проверяются в исходнике. |
| `main` | 38 | Именованный блок инструмента. Побочные эффекты и условия запуска проверяются в исходнике. |

## [tooling/data/.s3-url-map.json](../../../tooling/data/.s3-url-map.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [tooling/data/apply-s3-url-map.mjs](../../../tooling/data/apply-s3-url-map.mjs)

Применяет заранее подготовленную карту замен URL к локальным исходникам. Не проверяет права доступа удалённых объектов вместо оператора.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `mapPath` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `map` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `codeExt` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `skipDir` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `filesChanged` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `walk` | 20 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/audio-rendition-policy.ts](../../../tooling/data/audio-rendition-policy.ts)

Выбирает битрейт совместимой аудиокопии в пределах прежней квоты 32 МиБ, оставляя запас на контейнер и дрейф среднего битрейта.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `audioRenditionBitrate` | 6 | Offline copies must fit the existing 32 MiB audio quota, not bypass it. Reserve 2 MiB for container overhead and the AAC encoder's average-rate drift. |

## [tooling/data/backend-load/2026-10-15-index-trial.json](../../../tooling/data/backend-load/2026-10-15-index-trial.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [tooling/data/backend-load/2026-10-15-indexed.json](../../../tooling/data/backend-load/2026-10-15-indexed.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [tooling/data/backend-load/2026-10-15.json](../../../tooling/data/backend-load/2026-10-15.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [tooling/data/backfill-feed-text-from-json.mjs](../../../tooling/data/backfill-feed-text-from-json.mjs)

Восстанавливает подписи ленты из обработанного Instagram-экспорта. Это запись в выбранную БД, а не безопасная проверка без изменений.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ensureUtf8Mb4` | 14 | Функция. Подробности и ограничения — в исходнике. |
| `root` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DRY_RUN` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FORCE` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LIMIT` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `JSON_PATH` | 33 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `main` | 36 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/backfill-instagram-captions.mjs](../../../tooling/data/backfill-instagram-captions.mjs)

Дополняет пустые подписи через внешние данные Instagram oEmbed. Отсутствие подписи и сетевой отказ источника нельзя приравнивать к разрешению затереть текст.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LIMIT` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DRY_RUN` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DELAY_MS` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sleep` | 30 | Функция. Подробности и ограничения — в исходнике. |
| `decodeHtml` | 34 | Функция. Подробности и ограничения — в исходнике. |
| `fetchCaption` | 45 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 87 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/backfill-tg-thumbnails.mjs](../../../tooling/data/backfill-tg-thumbnails.mjs)

Восстанавливает обложки импортированных Telegram-видео, скачивая исходники и создавая объекты S3. Требует отдельного плана и резервной копии привязок.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `YANDEX_PUBLIC` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `RESULT_JSON` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CACHE_DIR` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `s3` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `S3_PUBLIC` | 33 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `yandexDiskPath` | 35 | Функция. Подробности и ограничения — в исходнике. |
| `getCachedOrDownload` | 43 | Функция. Подробности и ограничения — в исходнике. |
| `uploadS3` | 62 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 75 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/backfill-video-filenames.mjs](../../../tooling/data/backfill-video-filenames.mjs)

Дополняет имена видео в выбранной БД по сохранённым данным. Переменная подключения должна быть проверена до ручного запуска.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `url` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `conn` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `[result]` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/data/check-feed-media.mjs](../../../tooling/data/check-feed-media.mjs)

Сверяет медиа записей ленты через выбранное SQL-подключение; это операторская диагностика, не HTTP-проверка доступа к каждому объекту.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `env` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `conn` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `[manyPhotos]` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `[videoPosts]` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `[firstPage]` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/data/check-feed-posts.mjs](../../../tooling/data/check-feed-posts.mjs)

Исследует импортированные посты ленты и их поля в БД. Счётчики не подтверждают полноту исходного экспорта без отдельного сравнения.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `env` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `conn` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `[rows]` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `issues` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `[all]` | 78 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `nullText` | 81 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `nullPhotos` | 82 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `badPhotos` | 83 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/data/check-first-page.mjs](../../../tooling/data/check-first-page.mjs)

Показывает первую выборку постов из выбранной БД для проверки порядка и наполнения; не меняет клиентскую пагинацию.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `env` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `conn` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `[firstPage]` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/data/check-import.ts](../../../tooling/data/check-import.ts)

Сверяет результат импорта через общую SQL-схему. Загрузка окружения выбирает подключение, поэтому запуск требует проверки целевой БД.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `check` | 7 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/classify-posts.ts](../../../tooling/data/classify-posts.ts)

Вычисляет теги по прежним правилам и данным публикации Instagram. Исторический sortOrder интерпретируется отдельно от текущей хронологической выдачи.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `DATABASE_URL` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `db` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `timestampMap` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `TAG_KEYWORDS` | 34 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getSeasonByMonth` | 139 | Функция. Подробности и ограничения — в исходнике. |
| `matchesKeywords` | 148 | Функция. Подробности и ограничения — в исходнике. |
| `countKeywordMatches` | 154 | Функция. Подробности и ограничения — в исходнике. |
| `classifyPost` | 160 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 284 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/collect-vk-oembed.ts](../../../tooling/data/collect-vk-oembed.ts)

Собирает player URL и метаданные только для валидированных VK-ссылок. Неполный ответ oEmbed отмечается отдельно, не подменяется выдуманной обложкой.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `parseSources` | 10 | Функция. Подробности и ограничения — в исходнике. |
| `VideoMetadata` | 36 | Контракт типов. Подробности и ограничения — в исходнике. |
| `parseOembedPlayer` | 45 | Функция. Подробности и ограничения — в исходнике. |
| `collectVideo` | 61 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 191 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/count-videos.mjs](../../../tooling/data/count-videos.mjs)

Считает видео в локальных данных экспорта; такой отчёт не подтверждает опубликованный каталог или запуск плееров.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `conn` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `[rows]` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `[sample]` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/data/delete-test-posts.ts](../../../tooling/data/delete-test-posts.ts)

Историческая эвристика считает посты без instagramId тестовыми. Она может затронуть вручную созданный контент, поэтому не подходит для очистки рабочей БД.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `deleteTestPosts` | 6 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/fetch-club-music-yandex.mjs](../../../tooling/data/fetch-club-music-yandex.mjs)

Переносит согласованную музыку из Яндекс Диска в S3. Лицензия и целевой ключ проверяются оператором до внешней записи.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PUBLIC_KEY` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `API` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `MUSIC_PATH` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `S3_KEY` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `publicMeta` | 26 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 35 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/fix-tg-album-photos.mjs](../../../tooling/data/fix-tg-album-photos.mjs)

Восстанавливает альбомы импортированных Telegram-постов через исходный экспорт и Яндекс Диск; меняет медиа и их привязки.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `YANDEX_PUBLIC` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `RESULT_JSON` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CACHE_DIR` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `s3` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `S3_PUBLIC` | 34 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `yandexDiskPath` | 36 | Функция. Подробности и ограничения — в исходнике. |
| `getCachedOrDownload` | 44 | Функция. Подробности и ограничения — в исходнике. |
| `uploadPhoto` | 63 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 81 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/fix-tg-missing-media.mjs](../../../tooling/data/fix-tg-missing-media.mjs)

Ищет пропущенные Telegram-вложения в файловом экспорте и создаёт недостающие привязки. Совпадение исходного сообщения важнее похожего имени файла.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `YANDEX_PUBLIC` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `RESULT_JSON` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CACHE_DIR` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FILE_NOT_INCLUDED` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `s3` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `S3_PUBLIC` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `guessContentType` | 38 | Функция. Подробности и ограничения — в исходнике. |
| `listDiskFiles` | 52 | Функция. Подробности и ограничения — в исходнике. |
| `yandexDownload` | 74 | Функция. Подробности и ограничения — в исходнике. |
| `getCachedOrDownload` | 87 | Функция. Подробности и ограничения — в исходнике. |
| `uploadS3` | 97 | Функция. Подробности и ограничения — в исходнике. |
| `diskPathForFile` | 110 | Функция. Подробности и ограничения — в исходнике. |
| `resolveMediaPaths` | 114 | Функция. Подробности и ограничения — в исходнике. |
| `resolvePhotoPaths` | 131 | Функция. Подробности и ограничения — в исходнике. |
| `dateSuffix` | 158 | Функция. Подробности и ограничения — в исходнике. |
| `expectedPhotoName` | 169 | Функция. Подробности и ограничения — в исходнике. |
| `resolveThumbPath` | 173 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 177 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/fix-tg-post-tags.mjs](../../../tooling/data/fix-tg-post-tags.mjs)

Приводит текст, richText и теги уже импортированных клубных постов к данным экспорта. Запуск изменяет выбранную БД.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `RESULT_JSON` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `main` | 25 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/fix-tg-wrong-photos.mjs](../../../tooling/data/fix-tg-wrong-photos.mjs)

Сопоставляет Telegram-фотографии по точному имени с датой, чтобы не прикрепить другой файл с тем же числовым ID.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `YANDEX_PUBLIC` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `RESULT_JSON` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CACHE_DIR` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DRY_RUN` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ONLY` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `s3` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `S3_PUBLIC` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `dateSuffix` | 39 | Функция. Подробности и ограничения — в исходнике. |
| `expectedPhotoName` | 50 | Функция. Подробности и ограничения — в исходнике. |
| `resolveDiskPhotoNames` | 54 | Функция. Подробности и ограничения — в исходнике. |
| `guessContentType` | 76 | Функция. Подробности и ограничения — в исходнике. |
| `listDiskFiles` | 83 | Функция. Подробности и ограничения — в исходнике. |
| `yandexDownload` | 105 | Функция. Подробности и ограничения — в исходнике. |
| `getCachedOrDownload` | 118 | Функция. Подробности и ограничения — в исходнике. |
| `uploadS3` | 128 | Функция. Подробности и ограничения — в исходнике. |
| `albumSiblingMessages` | 142 | Функция. Подробности и ограничения — в исходнике. |
| `expectedPhotoNamesForPost` | 148 | Функция. Подробности и ограничения — в исходнике. |
| `urlBasename` | 161 | Функция. Подробности и ограничения — в исходнике. |
| `photosMatch` | 165 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 170 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/frontend-audits/frontend-external-image-audit-2026-10-06.json](../../../tooling/data/frontend-audits/frontend-external-image-audit-2026-10-06.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [tooling/data/frontend-audits/frontend-image-audit-2026-10-06.json](../../../tooling/data/frontend-audits/frontend-image-audit-2026-10-06.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [tooling/data/frontend-audits/frontend-loading-audit-2026-10-06.json](../../../tooling/data/frontend-audits/frontend-loading-audit-2026-10-06.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [tooling/data/frontend-audits/frontend-long-lists-audit-2026-10-07.json](../../../tooling/data/frontend-audits/frontend-long-lists-audit-2026-10-07.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [tooling/data/import-instagram.ts](../../../tooling/data/import-instagram.ts)

Импортирует подготовленные Instagram-записи в SQL-схему проекта. Это инструмент наполнения данных, а не часть обработки пользовательского HTTP-запроса.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ProcessedPost` | 25 | Контракт типов. Подробности и ограничения — в исходнике. |
| `main` | 38 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/import-public-staging.d.mts](../../../tooling/data/import-public-staging.d.mts)

Описывает типы автономного импортёра публичного staging-снимка для TypeScript-потребителей JavaScript-модуля. Наличие этих типов не обходит runtime-проверки назначения и пустой БД.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PublicSnapshot` | 2 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ImportReport` | 42 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ImportConnection` | 49 | Контракт типов. Подробности и ограничения — в исходнике. |
| `preparePublicSnapshot` | 56 | Функция. Подробности и ограничения — в исходнике. |
| `assertStagingDestination` | 57 | Функция. Подробности и ограничения — в исходнике. |
| `exportPublicSnapshot` | 61 | Функция. Подробности и ограничения — в исходнике. |
| `importPublicContent` | 62 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/import-public-staging.mjs](../../../tooling/data/import-public-staging.mjs)

Переносит только публичный снимок в строго ограниченную пустую staging-БД. Идентификаторы и даты сохраняются; повторный запуск не должен перезаписывать существующий контент.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `integer` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `id` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `date` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hostedUrl` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `post` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `video` | 44 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `tag` | 58 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `schema` | 65 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `preparePublicSnapshot` | 71 | Функция. Подробности и ограничения — в исходнике. |
| `assertStagingDestination` | 98 | Функция. Подробности и ограничения — в исходнике. |
| `tables` | 116 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `lockName` | 137 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `summary` | 138 | Функция. Подробности и ограничения — в исходнике. |
| `importPublicContent` | 146 | Функция. Подробности и ограничения — в исходнике. |
| `exportPublicSnapshot` | 206 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 226 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/import-telegram-club.mjs](../../../tooling/data/import-telegram-club.mjs)

Импортирует сообщения Telegram и вложения из экспорта с журналом прогресса. Внешние загрузки и запись в БД требуют согласованного запуска.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `YANDEX_PUBLIC` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `RESULT_JSON` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PROGRESS_FILE` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CACHE_DIR` | 33 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `args` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DRY_RUN` | 42 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LIMIT` | 43 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FILTER` | 44 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `s3` | 46 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `S3_PUBLIC` | 52 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `loadProgress` | 54 | Функция. Подробности и ограничения — в исходнике. |
| `saveProgress` | 59 | Функция. Подробности и ограничения — в исходнике. |
| `plainFromMessage` | 63 | Функция. Подробности и ограничения — в исходнике. |
| `matchesFilter` | 67 | Функция. Подробности и ограничения — в исходнике. |
| `FILE_NOT_INCLUDED` | 72 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `isMissingExportFile` | 74 | Функция. Подробности и ограничения — в исходнике. |
| `yandexDiskPath` | 78 | Функция. Подробности и ограничения — в исходнике. |
| `yandexDiskPathFromFileName` | 89 | When TG export omits file paths, map file_name to Yandex Disk folders. |
| `ALT_DISK_PATHS` | 102 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `localMediaCandidates` | 111 | Функция. Подробности и ограничения — в исходнике. |
| `loadMediaBody` | 119 | Функция. Подробности и ограничения — в исходнике. |
| `resolveMediaFile` | 139 | Функция. Подробности и ограничения — в исходнике. |
| `resolveThumbnailFile` | 156 | Функция. Подробности и ограничения — в исходнике. |
| `yandexDownload` | 168 | Функция. Подробности и ограничения — в исходнике. |
| `getCachedOrDownload` | 181 | Функция. Подробности и ограничения — в исходнике. |
| `uploadS3` | 191 | Функция. Подробности и ограничения — в исходнике. |
| `guessContentType` | 205 | Функция. Подробности и ограничения — в исходнике. |
| `importThumbnail` | 216 | Функция. Подробности и ограничения — в исходнике. |
| `importPhotoPath` | 224 | Функция. Подробности и ограничения — в исходнике. |
| `importMedia` | 233 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 267 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/inspect-post-targets.mjs](../../../tooling/data/inspect-post-targets.mjs)

Сверяет target постов с историческими клубными тегами. С --apply меняет target в БД; эвристика тегов не заменяет проверку согласованной области переноса.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CLUB_ONLY` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `apply` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `conn` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `[counts]` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `[rows]` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `leaky` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/data/legacy-audio-repair.ts](../../../tooling/data/legacy-audio-repair.ts)

Применяет проверенные совместимые аудиокопии к точным прежним привязкам. Receipt связывает результат с исходником и не разрешает перезаписывать посторонние вложения.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `id` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `digest` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `legacyUrl` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `repairSchema` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LegacyAudioRepair` | 68 | Контракт типов. Подробности и ограничения — в исходнике. |
| `url` | 69 | Функция. Подробности и ограничения — в исходнике. |
| `repaired` | 70 | Функция. Подробности и ограничения — в исходнике. |
| `receiptMatches` | 78 | Функция. Подробности и ограничения — в исходнике. |
| `repair` | 97 | Функция. Подробности и ограничения — в исходнике. |
| `applyLegacyAudioRepair` | 231 | Changes four metadata fields and inserts bound receipts in one transaction; no storage writes. |
| `rollbackLegacyAudioRepair` | 237 | Refuses later edits; restores originals, removes only own receipts and retains audit history. |

## [tooling/data/legacy-club-import.ts](../../../tooling/data/legacy-club-import.ts)

Преобразует исторические клубные записи в текущий формат без сетевых обращений. Разбор данных отделён от оператора, который выбирает БД и выполняет запись.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `id` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `order` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `flag` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `timestamp` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `asset` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `link` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `jsonField` | 43 | Функция. Подробности и ограничения — в исходнике. |
| `richText` | 53 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `post` | 70 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `section` | 93 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `article` | 114 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `media` | 127 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `snapshot` | 141 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LegacyClubContent` | 150 | Контракт типов. Подробности и ограничения — в исходнике. |
| `prepareLegacyClubStagingContent` | 153 | User approved only this known overdue source post to become an unscheduled draft. |
| `prepareLegacyClubContent` | 181 | Content-only boundary; no source accounts, payments, settings or video catalog. |

## [tooling/data/legacy-club-rehearsal.ts](../../../tooling/data/legacy-club-rehearsal.ts)

Репетирует объединение клубного контента на собственной локальной fixture. Общий merge принимает уже проверенное соединение, а не произвольный production URL.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `RehearsalTarget` | 18 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ContentTable` | 19 | Контракт типов. Подробности и ограничения — в исходнике. |
| `DataRow` | 20 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Fingerprint` | 21 | Контракт типов. Подробности и ограничения — в исходнике. |
| `LegacyClubPlan` | 22 | Контракт типов. Подробности и ограничения — в исходнике. |
| `tables` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `canonical` | 31 | Функция. Подробности и ограничения — в исходнике. |
| `hash` | 41 | Функция. Подробности и ограничения — в исходнике. |
| `identifier` | 45 | Функция. Подробности и ограничения — в исходнике. |
| `rows` | 49 | Функция. Подробности и ограничения — в исходнике. |
| `connect` | 58 | Verify container identity, tmpfs and exact loopback port before opening SQL. |
| `snapshot` | 121 | Функция. Подробности и ограничения — в исходнике. |
| `fingerprints` | 159 | Функция. Подробности и ограничения — в исходнике. |
| `mappedRows` | 182 | Функция. Подробности и ограничения — в исходнике. |
| `sameValue` | 210 | Функция. Подробности и ограничения — в исходнике. |
| `verifyImported` | 221 | Функция. Подробности и ограничения — в исходнике. |
| `planLegacyClubMerge` | 237 | Функция. Подробности и ограничения — в исходнике. |
| `applyLegacyClubMerge` | 303 | Caller guards identity and supplies dateStrings/jsonStrings/bigNumberStrings, supportBigNumbers and UTC; never pass an application's ordinary pool here. |
| `planLegacyClubRehearsal` | 424 | Функция. Подробности и ограничения — в исходнике. |
| `applyLegacyClubRehearsal` | 435 | Функция. Подробности и ограничения — в исходнике. |
| `rollbackLegacyClubMerge` | 448 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/legacy-media-inventory.ts](../../../tooling/data/legacy-media-inventory.ts)

Инвентаризирует локальные старые вложения по типу, размеру и отпечатку. Отчёт сам не загружает объекты и не меняет их доступность.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `reference` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `snapshotSchema` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `identify` | 37 | Функция. Подробности и ограничения — в исходнике. |
| `inventoryLegacyMedia` | 83 | Metadata only: no DB/S3 client, network requests, mutation mode or deletion approval. |
| `main` | 138 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/legacy-media-plan.ts](../../../tooling/data/legacy-media-plan.ts)

Строит воспроизводимый план переноса по инвентарю и хешам. План не является разрешением выполнить запись на рабочем хранилище.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Report` | 5 | Контракт типов. Подробности и ограничения — в исходнике. |
| `planLegacyMedia` | 8 | A work list, never an import/ACL approval. Source bytes must be verified separately. |

## [tooling/data/merge-tg-burst-photos.mjs](../../../tooling/data/merge-tg-burst-photos.mjs)

Объединяет соседние фото Telegram-серии с опорным постом. Применение изменяет записи и требует сверки конкретной группы сообщений.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `YANDEX_PUBLIC` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `RESULT_JSON` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CACHE_DIR` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DRY_RUN` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `s3` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `S3_PUBLIC` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `dateSuffix` | 38 | Функция. Подробности и ограничения — в исходнике. |
| `listDiskFiles` | 49 | Функция. Подробности и ограничения — в исходнике. |
| `yandexDownload` | 71 | Функция. Подробности и ограничения — в исходнике. |
| `getCachedOrDownload` | 84 | Функция. Подробности и ограничения — в исходнике. |
| `uploadS3` | 94 | Функция. Подробности и ограничения — в исходнике. |
| `resolveBurstPhotoNames` | 108 | Функция. Подробности и ограничения — в исходнике. |
| `urlBasename` | 121 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 125 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/merge-tg-tickets-post.mjs](../../../tooling/data/merge-tg-tickets-post.mjs)

Историческая операция объединяет конкретные сообщения с фото и документом в один пост. Не использовать её как универсальный merge любых публикаций.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ANCHOR` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PHOTO_SIBLING` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DOC_SIBLING` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DRY_RUN` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `parseJson` | 27 | Функция. Подробности и ограничения — в исходнике. |
| `urlBasename` | 39 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 43 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/remap-manus-to-s3.mjs](../../../tooling/data/remap-manus-to-s3.mjs)

Сопоставляет прежние CDN-ресурсы с ключами S3 и меняет локальные ссылки. Совпадение имени не подтверждает правильность файла без проверки результата.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `endpoint` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bucket` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `client` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `MANUS_PREFIX` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `listKeys` | 31 | Функция. Подробности и ограничения — в исходнике. |
| `originalName` | 51 | Функция. Подробности и ограничения — в исходнике. |
| `walk` | 56 | Функция. Подробности и ограничения — в исходнике. |
| `keys` | 67 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `byName` | 68 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `resolveFile` | 76 | Функция. Подробности и ограничения — в исходнике. |
| `files` | 80 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `replaced` | 81 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `missing` | 82 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/data/reupload-photos-s3.ts](../../../tooling/data/reupload-photos-s3.ts)

Переносит фотографии Instagram CDN в S3 с журналом прогресса и обновляет ссылки. Скачивание и запись происходят во внешних системах.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BATCH_SIZE` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DELAY_BETWEEN_PHOTOS` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DELAY_BETWEEN_BATCHES` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PROGRESS_FILE` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Progress` | 30 | Контракт типов. Подробности и ограничения — в исходнике. |
| `loadProgress` | 37 | Функция. Подробности и ограничения — в исходнике. |
| `saveProgress` | 44 | Функция. Подробности и ограничения — в исходнике. |
| `sleep` | 49 | Функция. Подробности и ограничения — в исходнике. |
| `getS3Client` | 53 | Функция. Подробности и ограничения — в исходнике. |
| `isInstagramUrl` | 73 | Функция. Подробности и ограничения — в исходнике. |
| `getContentType` | 77 | Функция. Подробности и ограничения — в исходнике. |
| `downloadPhoto` | 83 | Функция. Подробности и ограничения — в исходнике. |
| `uploadToS3` | 106 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 126 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/sanitize-post-text.mjs](../../../tooling/data/sanitize-post-text.mjs)

Нормализует управляющие символы и richText в сохранённых постах. Одноразовую очистку данных не следует путать с валидацией каждого нового запроса.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `sanitizePlainPostText` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `sanitizeRichTextForDisplay` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `url` | 42 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `conn` | 48 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `[rows]` | 49 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `updated` | 50 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/data/seed-videos.ts](../../../tooling/data/seed-videos.ts)

Исторически наполняет таблицу YouTube-каталога. Для нынешнего VK-каталога это не штатный источник данных.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `videoData` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `main` | 24 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/data/shortcode-timestamps.json](../../../tooling/data/shortcode-timestamps.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [tooling/data/sync-youtube-channel.mjs](../../../tooling/data/sync-youtube-channel.mjs)

Обновляет локальный список роликов прежнего YouTube-канала через внешний загрузчик; не является синхронизацией VK.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `listed` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `videos` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `conn` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `[rows]` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `existing` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `imported` | 38 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `[count]` | 49 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/data/youtube-videos.json](../../../tooling/data/youtube-videos.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [tooling/lib/media-reference-map.ts](../../../tooling/lib/media-reference-map.ts)

Строит карту точных ссылок из снимков постов и статей, различая общие и закрытые объекты. URL хешируются без нормализации, чтобы не смешать разные подписанные адреса и не раскрыть их в отчёте.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `snapshot` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Visibility` | 19 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ReferenceMap` | 20 | Контракт типов. Подробности и ограничения — в исходнике. |
| `referenceReport` | 29 | Функция. Подробности и ограничения — в исходнике. |
| `collectArticleReferences` | 122 | Offline reference evidence only: never an object inventory or ACL decision. |
| `decorationSnapshot` | 200 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `postSnapshot` | 246 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `collectPostReferences` | 292 | Selected references only; omitted sources are never an inventory or ACL. |
| `inventorySnapshot` | 452 | Presence of selected fields is not proof of all database rows or objects. |
| `mapDeclaredObjects` | 468 | Функция. Подробности и ограничения — в исходнике. |
| `collectMediaSnapshot` | 519 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/operations/bootstrap-vps.sh](../../../tooling/operations/bootstrap-vps.sh)

Исторически настраивает системные службы и доступ VPS. Требует прав администратора; это не локальная проверка и не нынешний Docker-порядок выпуска.

## [tooling/operations/check-club-checkout-url.mjs](../../../tooling/operations/check-club-checkout-url.mjs)

Собирает диагностический подписанный payload из настроек Prodamus, не выполняя оплату. Пример ссылки не подтверждает боевой тариф или автопродление.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CLUB_PRICE` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `subId` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `secret` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `payform` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sortDeep` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `stringifyValues` | 30 | Функция. Подробности и ограничения — в исходнике. |
| `sign` | 40 | Функция. Подробности и ограничения — в исходнике. |
| `payload` | 46 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `signature` | 56 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `params` | 57 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/check-s3.mjs](../../../tooling/operations/check-s3.mjs)

Выполняет подписанные запросы списка к выбранному S3. Использует внешнее хранилище и локальное окружение, поэтому не запускается как unit-тест.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `envPath` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `accessKey` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `secretKey` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bucket` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `host` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `region` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `service` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hmac` | 27 | Функция. Подробности и ограничения — в исходнике. |
| `sha256Hex` | 31 | Функция. Подробности и ограничения — в исходнике. |
| `listPage` | 35 | Функция. Подробности и ограничения — в исходнике. |
| `prefixes` | 86 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `total` | 87 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `token` | 88 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/check-shop-urls.mjs](../../../tooling/operations/check-shop-urls.mjs)

Сверяет прежние ссылки Магазина с S3. Флаг --acl меняет доступ найденных объектов на public-read и требует отдельного согласования.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `src` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `urls` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `unique` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `client` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `listed` | 33 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `missing` | 50 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `present` | 51 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/deploy-api.mjs](../../../tooling/operations/deploy-api.mjs)

Старый путь выпуска через SSH/PM2, оставленный для прежнего окружения. Тесты перед запуском не исправляют Windows-пути и не заменяют проверку Docker-релиза.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `run` | 12 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/operations/deploy-web.mjs](../../../tooling/operations/deploy-web.mjs)

Сохраняет прежний статический pipeline, но останавливается при обнаружении Next. Новый серверный frontend нельзя публиковать как Expo web-dist.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `frontendPackage` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `run` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `webDist` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/find-shop-keys.mjs](../../../tooling/operations/find-shop-keys.mjs)

Ищет конкретные прежние ключи иллюстраций Магазина в списке S3. Ничего не загружает, но обращается к рабочему хранилищу с выданным доступом.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `needles` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `client` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `token` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `scanned` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hits` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/generate-admin-totp.mjs](../../../tooling/operations/generate-admin-totp.mjs)

Создаёт и выводит новый TOTP-секрет для ручной настройки. Вывод является секретом; наличие генератора не означает, что 2FA включена в приложении.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `alphabet` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bytes` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bits` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `value` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `secret` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/host-video-thumbs.mjs](../../../tooling/operations/host-video-thumbs.mjs)

Переносит обложки старого YouTube-каталога в S3 и меняет thumbnailUrl. Для VK используется отдельный механизм метаданных.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SIZES` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PROXY` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `s3Client` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `fetchThumb` | 33 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 45 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/operations/import-legacy-club.ts](../../../tooling/operations/import-legacy-club.ts)

Применяет подготовленный клубный импорт только после проверки точного staging-подключения и схемы. Наличие старого экспорта не даёт права заменять пользователей или оплаты.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `assertLegacyClubStagingIdentity` | 15 | Функция. Подробности и ограничения — в исходнике. |
| `assertLegacyClubStagingConnection` | 32 | Функция. Подробности и ограничения — в исходнике. |
| `Profile` | 45 | Контракт типов. Подробности и ограничения — в исходнике. |
| `assertLegacyClubSchemaProfile` | 46 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 61 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/operations/list-shop-s3.mjs](../../../tooling/operations/list-shop-s3.mjs)

Перечисляет объекты Магазина; с --acl дополнительно делает их public-read. Режим изменения доступа не следует включать для закрытого контента.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `client` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `apply` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `keys` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `token` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/load-probe.mjs](../../../tooling/operations/load-probe.mjs)

Отправляет нагрузочные запросы к внешнему прежнему production-домену. Для безопасной локальной нагрузки используется отдельная синтетическая fixture.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BASE` | 2 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `TARGETS` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CONCURRENCY` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PER_TARGET` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `TIMEOUT_MS` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `percentile` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `hit` | 27 | Функция. Подробности и ограничения — в исходнике. |
| `runTarget` | 50 | Функция. Подробности и ограничения — в исходнике. |
| `startedAt` | 83 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `wallStart` | 84 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `rows` | 85 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `summary` | 89 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `worker` | 53 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tooling/operations/measure-frontend-loading.mjs](../../../tooling/operations/measure-frontend-loading.mjs)

Измеряет гостевую загрузку через браузер и сравнивает опубликованный baseline с локальной сборкой. Замер не меняет данные, но создаёт реальный сетевой трафик.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `option` | 12 | Функция. Подробности и ограничения — в исходнике. |
| `baseline` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `current` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `output` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `runs` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `windowMs` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `port` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `apiMode` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `snapshotFile` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `targets` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `settings` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `apiSnapshots` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `localServer` | 40 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `proxy` | 55 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `browser` | 73 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `results` | 74 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `audit` | 75 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `originalSizes` | 76 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `localAudit` | 77 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `observe` | 80 | Функция. Подробности и ограничения — в исходнике. |
| `measure` | 117 | Функция. Подробности и ограничения — в исходнике. |
| `estimatedImageBytes` | 174 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tooling/operations/optimize-s3-assets.mjs](../../../tooling/operations/optimize-s3-assets.mjs)

Прежний оптимизатор может перезаписывать JPEG по тому же S3-ключу и создавать WebP-соседей. Перед применением нужны оригиналы, карта ссылок и отдельное разрешение.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `dryRun` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `minKb` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `s3` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `S3_PREFIX` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `codeExt` | 38 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `skipDir` | 39 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `urls` | 42 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `walkCode` | 44 | Функция. Подробности и ограничения — в исходнике. |
| `widthHints` | 62 | Per-asset max display width (px |
| `hintWidth` | 75 | Функция. Подробности и ограничения — в исходнике. |
| `optimize` | 80 | Функция. Подробности и ограничения — в исходнике. |
| `urlMap` | 127 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `saved` | 128 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `processed` | 129 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/pack-deploy.mjs](../../../tooling/operations/pack-deploy.mjs)

Упаковывает прежний статический выпуск с API-bundle и установочными сценариями. Не заменяет нынешнюю сборку проверенных Docker-образов.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `deployDir` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `out` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `staging` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `copy` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `webDist` | 42 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `tar` | 47 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `stat` | 54 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/prepare-audio-rendition.ts](../../../tooling/operations/prepare-audio-rendition.ts)

Готовит отдельную совместимую аудиокопию с проверкой исходника и результата. Оригинал сохраняется; обновление привязки выполняется отдельным оператором.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `execute` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `probeSchema` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hash` | 33 | Функция. Подробности и ограничения — в исходнике. |
| `probe` | 39 | Функция. Подробности и ограничения — в исходнике. |
| `hasFastStart` | 71 | Функция. Подробности и ограничения — в исходнике. |
| `prepareAudioRendition` | 92 | Offline operator only: no URL fetching, credentials, DB writes or runtime jobs. |
| `main` | 206 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/operations/probe-video-thumbs.py](../../../tooling/operations/probe-video-thumbs.py)

Проверяет доступность заданных внешних обложек. Сетевой статус зависит от маршрута и не доказывает работу плеера.

## [tooling/operations/probe-youtube-channel.mjs](../../../tooling/operations/probe-youtube-channel.mjs)

Исследует доступность прежнего YouTube-источника. Не является синхронизацией нынешнего VK-каталога.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `html` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ytInitial` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ids` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `conn` | 34 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `[rows]` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `existing` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `missing` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/rollback-deploy-web-dist2.py](../../../tooling/operations/rollback-deploy-web-dist2.py)

Исторически выкладывает сохранённый сентябрьский web-dist2. Такой откат статического клиента не подходит для нынешнего Next runtime.

## [tooling/operations/s3-backup-restore-test.mjs](../../../tooling/operations/s3-backup-restore-test.mjs)

Создаёт тестовые копии внутри backup-бакета и читает их байты. Прежние пути требуют ремонта; запуск не является операцией только чтения.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `envPath` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `loadEnv` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `env` | 34 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `endpoint` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `backupBucket` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `testPrefix` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `client` | 39 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sampleKeys` | 49 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `pickSampleKeys` | 55 | Функция. Подробности и ограничения — в исходнике. |
| `copySource` | 86 | Функция. Подробности и ограничения — в исходнике. |
| `publicUrl` | 90 | Функция. Подробности и ограничения — в исходнике. |
| `verifyObject` | 94 | Функция. Подробности и ограничения — в исходнике. |
| `samples` | 122 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `restored` | 125 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `report` | 144 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `out` | 152 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/s3-media-backup.mjs](../../../tooling/operations/s3-media-backup.mjs)

Прежнее append-only резервирование копирует медиа в backup-бакет без удаления исходников. Setup меняет политики; актуальность путей и восстановление проверяются отдельно.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `args` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `envPath` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `loadEnv` | 34 | Функция. Подробности и ограничения — в исходнике. |
| `env` | 48 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `endpoint` | 50 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `sourceBucket` | 51 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `backupBucket` | 52 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `appAccessKey` | 53 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `client` | 55 | Функция. Подробности и ограничения — в исходнике. |
| `sourceClient` | 64 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `backupClient` | 68 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `backupBucketPolicy` | 70 | Функция. Подробности и ограничения — в исходнике. |
| `bucketExists` | 92 | Функция. Подробности и ограничения — в исходнике. |
| `setupBackup` | 101 | Функция. Подробности и ограничения — в исходнике. |
| `headEtag` | 163 | Функция. Подробности и ограничения — в исходнике. |
| `runBackup` | 173 | Функция. Подробности и ограничения — в исходнике. |
| `verifyBackup` | 244 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/operations/server-inspect.sh](../../../tooling/operations/server-inspect.sh)

Собирает системную диагностику на машине запуска. Выполнять только на согласованном сервере; вывод окружения и конфигурации может быть приватным.

## [tooling/operations/set-hidemy-vps-bypass.py](../../../tooling/operations/set-hidemy-vps-bypass.py)

Исторически меняет локальную маршрутизацию hidemy.name для VPS. Это настройка сети компьютера, а не исправление приложения.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `main` | 25 | Именованный блок инструмента. Побочные эффекты и условия запуска проверяются в исходнике. |

## [tooling/operations/smoke-image-previews.mjs](../../../tooling/operations/smoke-image-previews.mjs)

Проверяет WebP и повторное чтение публичных превью отдельным клиентом на разрешённом локальном стенде. Закрытые источники должны получать отказ, а не попадать в кеш.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `base` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `get` | 16 | Функция. Подробности и ограничения — в исходнике. |
| `catalog` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `posts` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `albums` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `album` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `photos` | 39 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `previewPath` | 41 | Функция. Подробности и ограничения — в исходнике. |
| `warmStarted` | 55 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `warm` | 56 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/smoke-production.mjs](../../../tooling/operations/smoke-production.mjs)

Проверяет опубликованный прежний домен после выпуска реальными HTTP-запросами. Ответы страниц не заменяют проверку ролей, платежей и сохранности БД.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BASE` | 5 | Post-deploy smoke check for daryadarcy.com |
| `TIMEOUT_MS` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `checks` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `failed` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/smoke-staging.mjs](../../../tooling/operations/smoke-staging.mjs)

Проверяет основные публичные API и ограничения staging. Отсутствующий пост должен оставаться отсутствующим, а недоступная функция не маскироваться успешным ответом.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `base` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `payments` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `read` | 27 | Функция. Подробности и ограничения — в исходнике. |
| `emptyPost` | 38 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/operations/ssh-check-prodamus-env.py](../../../tooling/operations/ssh-check-prodamus-env.py)

Читает настройки Prodamus через прежнее SSH-окружение с маскированием отчёта. Windows-пути и целевой сервер проверяются до запуска.

## [tooling/operations/ssh-check-smtp-env.py](../../../tooling/operations/ssh-check-smtp-env.py)

Проверяет прежние SMTP-настройки на сервере через SSH. Сетевое соединение не подтверждает доставку конкретного письма получателю.

## [tooling/operations/ssh-deploy-api.py](../../../tooling/operations/ssh-deploy-api.py)

Исторически загружает API-bundle и пересоздаёт PM2-процесс на фиксированном серверном пути. Windows-корень и доверие SSH не подходят как универсальный новый deploy.

## [tooling/operations/ssh-deploy-web.py](../../../tooling/operations/ssh-deploy-web.py)

Исторически заменяет статический web-dist и конфигурацию Nginx через SSH. Удаление прежней сборки здесь не является безопасным откатом Next-контейнера.

## [tooling/operations/ssh-setup-s3-backup.py](../../../tooling/operations/ssh-setup-s3-backup.py)

Старый установщик меняет серверные файлы, S3-политику и cron резервирования. Исторические пути и область действия ключей нужно проверить до любых внешних изменений.

## [tooling/operations/upload-deploy-tarball.mjs](../../../tooling/operations/upload-deploy-tarball.mjs)

Загружает прежние архив и установочные файлы в deploy-префикс S3. Объекты выпуска не должны содержать env, пользовательские данные или секреты.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `client` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `upload` | 26 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/operations/upload-garden-video.mjs](../../../tooling/operations/upload-garden-video.mjs)

Загружает конкретные публичные ролик и постер главной в S3. Пишет по заданным ключам и не предназначен для клубных файлов.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `client` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `files` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/upload-music-license-image.mjs](../../../tooling/operations/upload-music-license-image.mjs)

Публикует согласованную иллюстрацию лицензии музыки по выбранному S3-ключу. Это ручная внешняя запись, не часть проигрывания аудио.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `src` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `key` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `client` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `body` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/upload-web-dist.mjs](../../../tooling/operations/upload-web-dist.mjs)

Упаковывает и загружает прежнюю статическую сборку в S3. Не использовать вместо выпуска серверного Next-приложения.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `staging` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `out` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `webDist` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `tar` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `client` | 33 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `body` | 39 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/operations/verify-s3.ts](../../../tooling/operations/verify-s3.ts)

Сверяет ссылки фотографий постов в выбранной БД. Наличие URL в записи не является проверкой выдачи закрытого файла пользователю.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `verify` | 5 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/operations/vpn-bypass-daryadarcy.ps1](../../../tooling/operations/vpn-bypass-daryadarcy.ps1)

Служебный файл проекта; назначение уточняется по каталогу и связанному README.

## [tooling/operations/vps-console-ssh-diag.sh](../../../tooling/operations/vps-console-ssh-diag.sh)

Выводит сетевую и SSH-диагностику из консоли выбранного VPS. Подсказки изменения firewall только печатаются; вывод системных журналов может быть приватным. Paste into Timeweb VPS web console (root). Diagnose why SSH from outside fails.

## [tooling/operations/vps-console-ssh-port-2222.sh](../../../tooling/operations/vps-console-ssh-port-2222.sh)

Исторически добавляет дополнительный SSH-порт на сервере. Изменение доступных портов требует проверки firewall и согласования доступа. Timeweb web console (root): SSH on port 2222 in addition to 22 (VPN often blocks 22 only).

## [tooling/README.md](../../../tooling/README.md)

Инструменты репозитория. Инструкция или навигация по проекту.

## [tooling/scripts/accept-backend-image.mjs](../../../tooling/scripts/accept-backend-image.mjs)

Принимает уже собранный API-образ на собственной одноразовой БД. Не загружает рабочее окружение и не заменяет проверку на целевом сервере.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `args` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `accept` | 29 | Функция. Подробности и ограничения — в исходнике. |
| `run` | 49 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/accept-content-editors.mjs](../../../tooling/scripts/accept-content-editors.mjs)

Собирает изолированный стенд редакторов и запускает выбранный сквозной сценарий. Созданные процессы и временные ресурсы принадлежат только этому прогону.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `profile` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `recovery` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `checkout` | 33 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `temp` | 34 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `container` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixtureFile` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `children` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `env` | 38 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `owned` | 46 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `closing` | 47 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `memoryTimer` | 48 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `peakUsed` | 49 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `memoryLimit` | 50 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `usedMemory` | 51 | Функция. Подробности и ограничения — в исходнике. |
| `launch` | 60 | Функция. Подробности и ограничения — в исходнике. |
| `run` | 71 | Функция. Подробности и ограничения — в исходнике. |
| `freePort` | 79 | Функция. Подробности и ограничения — в исходнике. |
| `waitFor` | 87 | Функция. Подробности и ограничения — в исходнике. |
| `cleanup` | 101 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/api-load-fixture.ts](../../../tooling/scripts/api-load-fixture.ts)

Готовит синтетические записи и API-процесс для локальной нагрузки; проверка владельца контейнера предшествует работе с тестовой БД.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `exec` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `root` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `inspectLoad` | 15 | Функция. Подробности и ограничения — в исходнике. |
| `rows` | 30 | Функция. Подробности и ограничения — в исходнике. |
| `seedLoad` | 36 | Функция. Подробности и ограничения — в исходнике. |
| `startLoadApi` | 125 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/api-load-local.ts](../../../tooling/scripts/api-load-local.ts)

Нагрузочный прогон запускается только с явным разрешением и собственной fixture. Результаты описывают этот стенд, а не ёмкость рабочего сервера.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ensure` | 25 | Функция. Подробности и ограничения — в исходнике. |
| `methods` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `mix` | 40 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `main` | 41 | Функция. Подробности и ограничения — в исходнике. |
| `accessChecks` | 348 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `invariants` | 376 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `sample` | 431 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `baseline` | 521 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/api-load-policy.ts](../../../tooling/scripts/api-load-policy.ts)

Отделяет проверку одноразового стенда и расчёт метрик от запуска нагрузки. Плановые моменты запросов позволяют увидеть очередь, а не только скорость последовательного клиента.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `LoadFixture` | 4 | Контракт типов. Подробности и ограничения — в исходнике. |
| `assertLoadFixture` | 12 | Функция. Подробности и ограничения — в исходнике. |
| `LoadSample` | 40 | Контракт типов. Подробности и ограничения — в исходнике. |
| `summarizeLoad` | 47 | Функция. Подробности и ограничения — в исходнике. |
| `runArrivalStage` | 73 | Open arrivals: do not silently lower offered load when requests become slow. |

## [tooling/scripts/build-normal-guest.mjs](../../../tooling/scripts/build-normal-guest.mjs)

Собирает отдельный клиентский вариант гостевой оплаты и проверяет встроенные флаги. Переменные окружения запущенного Next не могут заменить эти build-time значения.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `child` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/scripts/candidate-api-environment.ts](../../../tooling/scripts/candidate-api-environment.ts)

Минимальное синтетическое окружение для проверки композиции API на БД-кандидате; боевые ключи и внешние отправки сюда не наследуются.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `candidateApiEnvironment` | 3 | Synthetic composition settings, never production credentials or provider config. |

## [tooling/scripts/candidate-data-transfer.ts](../../../tooling/scripts/candidate-data-transfer.ts)

Переносит только совместимые столбцы между заранее проверенными соединениями. Проверку контейнеров и прав делает вызывающий оператор; история миграций не копируется как обычные данные.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `TransferColumn` | 11 | Контракт типов. Подробности и ограничения — в исходнике. |
| `TransferTable` | 22 | Контракт типов. Подробности и ограничения — в исходнике. |
| `transferIdentifier` | 23 | Функция. Подробности и ограничения — в исходнике. |
| `transferColumnPlan` | 28 | Функция. Подробности и ограничения — в исходнике. |
| `dataRows` | 75 | Функция. Подробности и ограничения — в исходнике. |
| `rowDigest` | 78 | Функция. Подробности и ограничения — в исходнике. |
| `transferColumns` | 102 | Функция. Подробности и ограничения — в исходнике. |
| `copyCandidateData` | 116 | Caller guards containers, scoped grants and exact schema/history fingerprints. Connections must use dateStrings/jsonStrings/supportBigNumbers/bigNumberStrings with timezone Z; source values stay opaque. No files or providers are used. |

## [tooling/scripts/candidate-database.ts](../../../tooling/scripts/candidate-database.ts)

Инициализирует только согласованную пустую БД-кандидат либо проверяет её API-композицию. Совпадение плана и server UUID проверяется до DDL; переключения приложения здесь нет.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `phase` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `main` | 26 | Функция. Подробности и ограничения — в исходнике. |
| `checkApi` | 160 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/check-boundaries.ts](../../../tooling/scripts/check-boundaries.ts)

Определяет слой по пути импорта и проверяет допустимость зависимости. Это проверка архитектурных границ, а не выполнение импортируемых модулей.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `layers` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `layer` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `inspectBoundary` | 10 | Check actual syntax, including export/dynamic import/require, not source grep. |
| `check` | 16 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `visit` | 40 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/check-checkout-browser.mjs](../../../tooling/scripts/check-checkout-browser.mjs)

Собирает независимые варианты TEST и гостевой LIVE-формы и проверяет обязательные браузерные сценарии. Пропуски или flaky-результаты не считаются успешной приёмкой.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `legacyGuest` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `profiles` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `run` | 49 | Вложенная функция. Подробности и ограничения — в исходнике. |
| `inspect` | 73 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/check-chunks.mjs](../../../tooling/scripts/check-chunks.mjs)

Сверяет размещение модулей в собранных клиентских чанках; результаты зависят от конкретного артефакта сборки.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `dir` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BASE` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ROUTE_CHECKS` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `chunkFor` | 40 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/check-docs.ts](../../../tooling/scripts/check-docs.ts)

Проверяет локальные ссылки документов из Git-инвентаря. Внешние сайты не открывает, исторические снимки не переоценивает как текущую документацию.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `inventory` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `files` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `currentDocuments` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `failures` | 41 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/scripts/check-prod-bundle.mjs](../../../tooling/scripts/check-prod-bundle.mjs)

Сравнивает локальный legacy-bundle с реальными ответами прежнего production-домена. Наличие строки в сборке не доказывает работу пользовательского сценария.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `webDist` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `MARKERS` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `checkBundle` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `BASE` | 42 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `html` | 43 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `entryMatch` | 44 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `prodHits` | 47 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/scripts/check-prod-version.mjs](../../../tooling/scripts/check-prod-version.mjs)

Делает внешний запрос к прежнему production-домену, обходя клиентский кеш. Это сетевой операторский инструмент, а не локальная проверка исходников.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `html` | 2 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `tokens` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/scripts/check-web-bundle.mjs](../../../tooling/scripts/check-web-bundle.mjs)

Ищет ожидаемые фрагменты в локальной web-сборке; проверка относится к артефакту, а не к опубликованной версии сайта.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `dir` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/scripts/compress-web-dist.mjs](../../../tooling/scripts/compress-web-dist.mjs)

Готовит сжатые копии статической legacy-сборки после проверки необходимых ресурсов. Это не обработка пользовательских загрузок и не пересоздание Next-кеша.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `projectRoot` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `root` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `frontendRoot` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `requiredPublicFiles` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `iconSrc` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `compressExt` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `walk` | 29 | Функция. Подробности и ограничения — в исходнике. |
| `files` | 38 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `html` | 72 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `entryFiles` | 77 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bytesIn` | 85 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bytesOut` | 86 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `count` | 87 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/scripts/content-count-index-trial.ts](../../../tooling/scripts/content-count-index-trial.ts)

Сравнивает подсчёты до и после индекса только на охраняемой синтетической БД. Измерение не разрешает автоматически применять индекс к рабочей схеме.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `main` | 13 | Функция. Подробности и ограничения — в исходнике. |
| `measure` | 51 | Вложенная функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/copy-web-public.mjs](../../../tooling/scripts/copy-web-public.mjs)

Копирует публичные ресурсы для legacy Vite-сборки; не является механизмом миграции медиа из S3.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `publicDir` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `copyDir` | 9 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/documentation-links.ts](../../../tooling/scripts/documentation-links.ts)

Разбирает локальные Markdown-ссылки с учётом блоков кода и относительных путей. Не пытается подтверждать доступность внешних URL.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BrokenDocumentationLink` | 4 | Контракт типов. Подробности и ограничения — в исходнике. |
| `checkDocumentationLinks` | 12 | Checks local file/directory destinations; does not fetch URLs or check headings. |
| `readDestination` | 88 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/email-identity-preflight.ts](../../../tooling/scripts/email-identity-preflight.ts)

Проверяет данные идентификации перед почтовым переходом и возвращает признаки конфликтов. Диагностика не связывает аккаунты и не отправляет письма.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `inspectEmailIdentityData` | 8 | Функция. Подробности и ограничения — в исходнике. |
| `readEmailIdentityIssues` | 57 | Never load application .env files or repair identities during inspection. |

## [tooling/scripts/extract-api-contract.cjs](../../../tooling/scripts/extract-api-contract.cjs)

Извлекает выходные типы tRPC средствами TypeScript, не запуская сервер. Поэтому неполный серверный тип воспроизводится в контракте и требует исправления в источнике.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `fs` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `path` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `source` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `routerPath` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `schemaPath` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ts` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `c` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `options` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `program` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `checker` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `file` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `routerSymbol` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `router` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `prop` | 21 | Функция. Подробности и ограничения — в исходнике. |
| `flags` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `count` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `render` | 32 | Функция. Подробности и ограничения — в исходнике. |
| `schema` | 73 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `schemaExports` | 74 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `aliases` | 77 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `namespaceExports` | 78 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `localize` | 91 | Функция. Подробности и ограничения — в исходнике. |
| `record` | 133 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `result` | 158 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `outputIndex` | 161 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `outputPath` | 162 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `dest` | 165 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `writeContract` | 168 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/fresh-database.ts](../../../tooling/scripts/fresh-database.ts)

Создаёт или проверяет схему только на точно определённой пустой локальной БД. Рабочее подключение не подставляется вместо одноразового по умолчанию.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `main` | 23 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/generate_qr.mjs](../../../tooling/scripts/generate_qr.mjs)

Сохраняет QR-код для выбранного адреса в локальный временный каталог. Сам QR не публикует приложение и не проверяет доступность адреса.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `url` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `output` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/scripts/list-bundle-routes.mjs](../../../tooling/scripts/list-bundle-routes.mjs)

Читает маршруты из заданного legacy-bundle; имя старого файла по умолчанию не является указанием актуального production-артефакта.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `file` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `s` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `routes` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/scripts/load-env.js](../../../tooling/scripts/load-env.js)

Загружает локальное окружение, сохраняя приоритет уже заданных системных переменных. CommonJS нужен прежним потребителям конфигурации Expo.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `fs` | 6 | Custom environment loader that prioritizes system environment variables over .env file values. CommonJS so Expo can load it from app.config.ts. |
| `path` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `envPath` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `mappings` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/scripts/media-reference-map.ts](../../../tooling/scripts/media-reference-map.ts)

Принимает снимок связей через stdin и выводит карту использования медиа. Не подключается к БД и не скачивает либо закрывает найденные файлы.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `main` | 9 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/migration-history.ts](../../../tooling/scripts/migration-history.ts)

Читает историю миграций и наличие индекса через ограниченное соединение. Проверка истории отделена от применения DDL.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `withReadOnlyConnection` | 4 | Функция. Подробности и ограничения — в исходнике. |
| `readMigrationHistory` | 25 | Fixed metadata queries only; no creation of Drizzle's migration table. |
| `readFeedListingIndexAvailable` | 45 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/migration-policy.ts](../../../tooling/scripts/migration-policy.ts)

Сопоставляет журнал, SQL-файлы и фактическую историю по контрольным суммам. Не чинит несовпадения автоматически и не переписывает прежние миграции.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `journalSchema` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `MigrationIdentity` | 18 | Контракт типов. Подробности и ограничения — в исходнике. |
| `candidateIdentityAllowed` | 19 | Функция. Подробности и ограничения — в исходнике. |
| `candidateTargetAllowed` | 37 | One reviewed new-database target; never an upgrade or a general server installer. |
| `inspectFreshInstallManifest` | 69 | Canonical manifest, or the explicitly recognized historical fresh-only layout. |
| `inspectMigrationManifest` | 123 | Функция. Подробности и ограничения — в исходнике. |
| `inspectMigrationHistory` | 168 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/migration-preflight.ts](../../../tooling/scripts/migration-preflight.ts)

Проверяет комплект миграций, а при явном требовании — историю выбранной БД. Успешный отчёт сам не применяет изменения схемы.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `main` | 14 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/multi-api-policy.ts](../../../tooling/scripts/multi-api-policy.ts)

Проверяет уже разрешённый Compose и суммарные бюджеты реплик/пулов. Отчёт содержит коды проблем, но не раскрывает секретные значения конфигурации.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `service` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `model` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `poolSize` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `connectionReserve` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hostReserveMiB` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `seconds` | 25 | Функция. Подробности и ограничения — в исходнике. |
| `inspectMultiApiDeployment` | 33 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/multi-api-preflight.ts](../../../tooling/scripts/multi-api-preflight.ts)

Читает приватный снимок Compose и сверяет его с ресурсами хоста и MySQL. Ошибки разбора намеренно не выводят входной файл с паролями.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `main` | 5 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/normal-guest-profile.mjs](../../../tooling/scripts/normal-guest-profile.mjs)

Задаёт и проверяет публичные флаги отдельной сборки гостевого восстановления оплаты; настройки платёжного провайдера здесь не хранятся.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `normalGuestFlags` | 3 | Explicit build-time profile; no provider credentials or server configuration. |
| `assertNormalGuestBuild` | 10 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/pack-web-dist.mjs](../../../tooling/scripts/pack-web-dist.mjs)

Упаковывает готовый статический web-dist; запуск не собирает Next-приложение и не обновляет сервер.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `webDist` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `staging` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `out` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `tar` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [tooling/scripts/prepare-dev-database.ts](../../../tooling/scripts/prepare-dev-database.ts)

Подготавливает схему локальной разработки с явной проверкой целевого подключения. Загрузка env не даёт разрешения заменять рабочую БД.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `uri` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `target` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `main` | 30 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/prodamus-sandbox-link.ts](../../../tooling/scripts/prodamus-sandbox-link.ts)

Формирует ссылку из явно переданного sandbox-окружения. Не подгружает ключи автоматически и не подтверждает успешность платежа.

## [tooling/scripts/retired-access-email-cleanup.ts](../../../tooling/scripts/retired-access-email-cleanup.ts)

Очищает почтовые данные обезличенных аккаунтов только на собственной локальной БД. Запись требует отдельного флага, связи оплаченных заказов сохраняются.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `exec` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `batchSize` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `main` | 21 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/source-file-guide.ts](../../../tooling/scripts/source-file-guide.ts)

Справочник строится по Git-инвентарю и объявлениям исходников, без выполнения кода.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `FileEntry` | 8 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Block` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `destination` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `groups` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Group` | 21 | Контракт типов. Подробности и ограничения — в исходнике. |
| `sourcePattern` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `otherTextPattern` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `commentText` | 25 | Функция. Подробности и ограничения — в исходнике. |
| `summarizeSource` | 36 | Фиксируем имена и пояснения блоков; тела функций и значения переменных не публикуем. |
| `sqlBlocks` | 128 | SQL-историю только читаем: описываем именованные DDL-операции без изменения их хешей. |
| `scriptBlocks` | 144 | Имена Python/shell-блоков извлекаем как текст: импорт опасного инструмента не нужен. |
| `groupFor` | 159 | Функция. Подробности и ограничения — в исходнике. |
| `purposeFor` | 181 | Функция. Подробности и ограничения — в исходнике. |
| `clean` | 258 | Функция. Подробности и ограничения — в исходнике. |
| `fileLink` | 264 | Функция. Подробности и ограничения — в исходнике. |
| `buildFileGuide` | 274 | Каждый путь попадает в один раздел. Сгенерированные страницы описывают себя без чтения своих тел. |
| `main` | 343 | CLI читает только Git-инвентарь; записи ограничены каталогом справочника. |

## [tooling/scripts/sql-test-setup.ts](../../../tooling/scripts/sql-test-setup.ts)

Даёт тестам временный loopback-маршрут к разрешённому CI MySQL. Защита production maintenance от произвольных удалённых адресов при этом не ослабляется.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `setup` | 7 | Keep destructive SQL fixtures serial and local-only, including GitLab's service. |

## [tooling/scripts/staging-baseline-policy.ts](../../../tooling/scripts/staging-baseline-policy.ts)

Проверяет доказательства резервирования, репетиции и исходной схемы перед историческим baseline-переходом. Контрольные суммы не заменяются предположением по имени БД.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `StageBaselineSnapshot` | 5 | Контракт типов. Подробности и ограничения — в исходнике. |
| `STAGE_BASELINE_HASH` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `STAGE_UPGRADE_SQL_HASH` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `STAGE_CHECKOUT_HASH` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hashStageTables` | 20 | Функция. Подробности и ограничения — в исходнике. |
| `digest` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `restoreProof` | 33 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `inspectRestoreProof` | 49 | Функция. Подробности и ограничения — в исходнике. |
| `rehearsalReceipt` | 81 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `inspectRehearsalReceipt` | 94 | Функция. Подробности и ограничения — в исходнике. |
| `inspectStageBaseline` | 130 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/staging-baseline-upgrade.ts](../../../tooling/scripts/staging-baseline-upgrade.ts)

Выполняет узкий согласованный baseline-переход после проверки закрытых файлов доказательств. Исторический профиль не предназначен для произвольной актуальной БД.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `sha256` | 15 | Функция. Подробности и ограничения — в исходнике. |
| `lockName` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `protectedFile` | 20 | Credentials and restored row digests never leave the protected release directory. |
| `snapshot` | 53 | Функция. Подробности и ограничения — в исходнике. |
| `main` | 122 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/test-database-policy.ts](../../../tooling/scripts/test-database-policy.ts)

Ограничивает SQL-тесты одноразовой backend_test на разрешённых адресах. Параметры URI не должны обходить ограничение через Unix socket.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `assertTestDatabase` | 3 | Safety guard shared by local tests and isolated CI service readiness. |

## [tooling/scripts/verify-boundaries.ts](../../../tooling/scripts/verify-boundaries.ts)

Обходит исходники и применяет правила зависимостей слоёв. Код приложений при проверке не исполняется.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `violations` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `checked` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `walk` | 8 | Функция. Подробности и ограничения — в исходнике. |

## [tooling/scripts/wait-test-database.ts](../../../tooling/scripts/wait-test-database.ts)

Ожидает доступность только разрешённого тестового MySQL перед CI-прогоном. Повторные подключения ограничены временем ожидания.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `wait` | 6 | Функция. Подробности и ограничения — в исходнике. |
