# БД-кандидат: backend artifact и откат приложения

## Граница разрешения —19 октября 2026

FRESH-C4 разрешала **только локальную подготовку** образа и процедуры отката.
Следующее прямое поручение FRESH-C5 разрешило transfer/load точного image только
для isolated SELECT-only API check на существующей БД-кандидате; выполнено ниже.
Этот документ и example override не разрешают deployment, restart/switch рабочих
сервисов, permanent grants, seeds, SQL apply, S3 mutations или private flags.
Текущая БД, frontend и существующая конфигурация rollout остаются прежними.
Результаты схемы/API кандидата: [основной runbook](teamassist-staging.md).

Состояние подготовки: **исправленный локальный image/archive готовы**,
native backup/restore10/10 и offline image2/2 прошли в FRESH-C6 ниже.
Original e774 image принимался в C5 на server candidate42:39 ORM +8 HTTP,
но C6 нашла backup directory0755 и подготовила исправленный0763 image.
Новый artifact ещё не проверялся на сервере. Разрешения на deployment/switch
нет; transfer/load старого image был только для C5 test, не release approval.

Исходный image C4/C5 — source `20839114f6cc4236f477ecd6c2c15a80059c66ca`;
tag `daryadarcy-backend:fresh-c4-2083911`, Linux amd64/Node22.23.3/USER node.
Image ID (OCI index):
`sha256:e774b30f3b9a04b10de094d2b0999da6be0d8dd3620721e2d1b2cd3ab56403d5`.
Platform manifest `sha256:150363760433fb07582bca20ae7fcb3d44ade2261418743bace7f3719c69015e`;
config `sha256:598b23ab47e094b8ef8d7288369ec7158f78edb4a612d82e2e3acd1226e05272`.
Bundle SHA-256 `bb9775d1da5bd418d0ccf6138f81414425f5b4f6e3f56db08f357273c5da903f`;
lockfile `5843748a36df5dc742249b848b5c56263e16d31addd2656d0f5dc08043839721`.
Archive254MiB и verification.json сохранены вне Git в private directory
`/Users/edem/Desktop/ASSIST/dina_project/.local-artifacts/backend-2083911/`.
`backend-image.tar` SHA-256:
`2ad09117275954d4207e5b97ffa7386c270cf93bed5b2a01a44dedf032a04f44`.
Docker save exit0, archive tag/config SHA/source/platform и checksum проверены.
В C5 archive с тем же SHA загружен в exact server Docker; Image ID остался
тем же OCI index e774…. Не подменять OCI index/config/manifest IDs.

## FRESH-C6 — native backup/restore и исправленный локальный image

На original e774 image настоящие dump/restore из Debian MariaDB10.11.19 с
MySQL8.4.11 прошли сравнение данных/DDL/history, но полный run:8 pass/1 fail.
Причина: Dockerfile заранее создавал `/app/backups` с0755; recursive mkdir0700
в production backup не меняет уже существующий directory. Gzip был0600,
но имена копий видны другим локальным пользователям. Не ослабляли test.
Исправлен только packaging: дополнительный `RUN chmod 0700 /app/backups`.

Контекст сборки: выбранные файлы clean Git archive2083911 +exact one-line
canonical Dockerfile patch. Не выдавать source label2083911 за полностью
неизменённый Dockerfile; его новый SHA-256:
`c5d13f3dd0980a1a45b6caae4c6d5498bcb5bc673f798fb8fc341140cc592f78`.
Build frozen install/backend stages cached; все9 old layers и runtime
User/Cmd/Entrypoint/WorkDir/Env/Labels сравнивались — неизменны, добавлен
один permission layer. Lockfile, executable bundle и dependencies прежние.
Внутри каждого probe bundle SHA-bb977… проверен; canonical backup/ENV source
сравнен с2083911. Probe монтирует только test entry, использует **image deps и
native clients**, не MySQL-container binary adapter. API executable/workers
не импортируются, S3/SMTP/working env не наследуется.

Новый tag: `daryadarcy-backend:fresh-c6-2083911-private-backups`, Linux amd64.
Image index:
`sha256:0763beb522779c97501d0ce32527ce680facc6a6d021d5dfc307c05ed370d4ba`;
platform manifest `sha256:303a5e0214e432f6ae6caac8c3d003d474f3f91e986e4ab897d0d808d29c08bb`;
config `sha256:a678266c40d9f7cf06459751f51e4f45467c79404afa1c6513554e4dcb75492d`.
Archive266596352 bytes (254MiB), SHA-256:
`1b957407c5817db07033f7e22a273ba37482ab8c14ba61cf3a75946db9c47ae6`.
Private directory вне Git:
`/Users/edem/Desktop/ASSIST/dina_project/.local-artifacts/backend-2083911-c6/`.
Export tag/config/source/platform +checksum verified, files0600/parent0700.
Original C4 archive/image сохранены, ничего не заменено на сервере.

Native acceptance10/10/0 skip/3.47s на **двух новых own** MySQL8.4.11
loopback/tmpfs `backend_test`, no persistent volumes. Image UID1000,
cap-drop/no-new-privileges/memory256MiB, network namespace exact guarded DB;
source installer применил fresh42 только к пустой own source. Restore только в
пустую отдельную target. Все40 таблиц/строки/DDL (engines/collations/generated
expressions/indexes/auto increments) и42 migration rows совпали. Проверены
Unicode/quotes/newlines/JSON, identity/article/library recovery uniqueness,
pending intents/готовые binding references, unchanged source. Повтор restore
в непустую target отказал без mutation. Реальная auth failure native dump
не оставила completed/partial gzip или temporary credential files.
Dir0700/gzip0600 подтверждены **внутри image**, а не только после docker cp.
Schema digest `2dd2cd79e6c540a6b75e96c77a0bc53e647171bb502cf2d44d1c86b0f5a50c2e`;
data digest `65a64c89b2039e7e924cb5dfcf530931b5c2d9a92f2ff84d2c6e38f02fd5c0e7`.
Synthetic gzip7863 bytes SHA-0563146… после rehearsal удалён как test fixture;
hashes/JSON report сохранены. Offline image2/2/2.43s проверила6 HTTP/native
dependencies без DB/egress. Root types/prettier pass; backup units16 pass/2
native opt-in skips, эти2 не выдавать за отдельную SQL acceptance.

Повторять только на **новых пустых** owned fixtures, как existing rehearsal:
`tests/fresh-backup-restore.mysql.test.ts`. Явно задать SOURCE/TARGET_URL и
SOURCE/TARGET_ID в `BACKUP_REHEARSAL_*`, только synthetic credentials;
добавить `BACKUP_REHEARSAL_IMAGE`, `BACKUP_REHEARSAL_IMAGE_ID`,
`BACKUP_REHEARSAL_REVISION=20839114f6cc4236f477ecd6c2c15a80059c66ca`,
`BACKUP_REHEARSAL_BUNDLE_SHA=bb9775d1da5bd418d0ccf6138f81414425f5b4f6e3f56db08f357273c5da903f`.
Без IMAGE сохраняется прежний MySQL-container-client mode; это **не** проверка
release image. Guards image/source/loopback/container ownership выполняются до
SQL init; перед cleanup проверять exact ID/owner/name/ports/tmpfs/mounts.

Own image probe/SQL containers и empty network удалены; прежние2 foreign
stopped containers/12 volumes/images сохранены, free~3.1GiB. В подготовке
internal network не публиковала loopback ports; заменена только own network
на bridge с masquerade=false. Initial readiness race устранён штатным waiter;
на этой неудачной попытке SQL init ещё не выполнялся. Это не дефекты продукта.
Receipt verification.json SHA-256:
`63faf78c6fe63678dc805e598feed8c46a990690659a7f0582cc9e4e801d705c`.

**Остаток:** corrected0763 image существует только локально; C5 ниже относится
к e774. Перед будущим switch отдельно проверить corrected image на candidate
по прежним SELECT-only guards. Backup mount может скрыть image directory:
проверить owner/0700 в будущей конфигурации, не chmod чужие рабочие mounts вслепую.
Off-site/S3 retention/restore, production-scale/concurrent-write recovery,
permanent grants/owner/seeds, production workers, downtime/write cutover и
реальный rollback этим synthetic rehearsal не проверены и не разрешены.
Server/current DB/candidate/frontend/S3/app configuration не затрагивались.

## FRESH-C5 — результат на существующей БД-кандидате

Target teamassist-dev/edem UID1001, exact MySQL container3442fbda…/UUID
`2a41f961-c168-11f1-8660-0a4124b25f9f`, internal network b64d0e6b… прежние.
Before load: history42 digest
`e8d87d9b4547b9568134a4578acf173f0ebc61b868cccde177c7808bf793c9f6`, users0,
archive/source/probe hashes проверены. Build/install на shared host не запускался.
Проверен hash actual `/app/dist/index.mjs` внутри финального image; зависимости
использовались **из image**, без overlay node_modules. Composition-only canonical
candidate CLI bundle SHA-256:
`8e871f89149b67375ffb82841df9da09cb186b67e774ca28d1e0d304dd372103`.
Он побайтно совпал с C3; runtime source6f06e09..2083911 не менялся.

Temporary account имел только SELECT на candidate, без global elevated grants.
Probe UID1001:1001/read-only root+mount/internal net/no published ports,
cap-drop/no-new-privileges/memory256MiB/CPU0.4. Запускался только `--check-api`;
не production CMD, не workers, не installer. Working env/секреты providers не
читались; MySQL administrative credential использован внутри existing container,
значения не выводились. Миграции/repair/schema DDL/seed не выполнялись;
прямые SQL/user-data reads старой БД отсутствовали. Из SQL writes были только
создание/SELECT grant/удаление собственной временной тестовой учётки.

Actual checks:39 ORM tables/columns через LIMIT0; guest auth/launch/feed/articles
200 (user:null/empty lists), protected admin401, default-off Library/content files
404. Все8 HTTP прошли, exit0/OOM=false. User count0/history digest прежние.
Own container/account/env удалены. Все24 existing running containers IDs/images/
start times/health, configuration **metadata** и volume names совпали до/после.
Это не hash-сравнение содержимого working env: его не читали. Все7 project services
healthy, current HTTPS `/`200. Application/front/current DB/S3/flags не менялись.

Server receipt (private):
`/home/edem/apps/daryadarcy-staging/candidate-image-20261019-2083911.f1vR0P/verification.json`.
Local receipt: `.local-artifacts/backend-2083911/candidate-verification.json`
рядом с сохранённым archive вне Git. SHA-256 обеих копий:
`4c1ef5ad5241298411a98de2a941ce63b42a448ffcb491f00e6fc04bca570f8a`.
После успеха только uploaded archive254MiB удалён с exact root/owner/0700/
no-symlink/SHA/positive receipt guards. Original local export и loaded image
сохранены; отдельный archive-cleanup.json, free~1.7GiB. Чужие files/images/volumes
не очищались. На shared server не запускать тяжёлые новые работы без disk/RAM gate.

Preflight-only отказы до image load/credentials: missing Health в metadata
template; directory trailing slash и macOS AppleDouble в probe tar. Исправлены
только диагностика/packaging (COPYFILE_DISABLE=1,59 allowlisted entries); target
guards не расширены. Runtime/SQL source/dependencies не менялись. Эти отказы
не являются найденными дефектами продукта. Native backup/restore image client,
production executable/worker lifecycle, owner/initial data/permanent app grants,
write cutover и реальный rollback не проверялись этим SELECT-only прогоном.

## Состав и воспроизведение образа

Отдельный [Dockerfile.backend](../../infrastructure/deploy/teamassist/Dockerfile.backend)
использует тот же pinned Node22 Debian base и pnpm9.12.0, authoritative frozen
lockfile, `--ignore-scripts` во всех установках. Build и production dependencies
устанавливаются независимо: повторная prod installation поверх dev tree на pnpm9
скачивала лишние optional platform packages и была остановлена.
Приложение собирается штатным backend target. COPY allowlist не включает
frontend source/build, environment files, ключи, backups или SQL migrations.
Runtime: `/app/dist/index.mjs`, `USER node`, CA certificates, MySQL client,
`/app/backups` принадлежит node. Установка и запуск не применяют миграции.
Обычный executable запускает workers после listen, поэтому для подготовки
используется только composition probe, не штатный CMD.

Сохраняется общий production dependency graph workspace (включая библиотеки,
нужные frontend package): это **API-only artifact, не минимизированный backend
dependency graph**. Frontend code/assets/Next build в образе отсутствуют.
Новые зависимости и изменения lockfile не нужны. OS packages берутся из Debian
repository на момент сборки: повторная сборка не обещает тот же image ID.
Для будущего переноса фиксировать **конкретный проверенный image ID/archive hash**,
а не пересобирать на shared server с ограниченной памятью.

Собирать из чистого archive выбранного Git commit, с отдельным Dockerfile и его
dockerignore из проверенного изменения; не посылать рабочую папку с секретами.
Локальный пример (не deployment):

```sh
docker build --platform linux/amd64 \
  --file infrastructure/deploy/teamassist/Dockerfile.backend \
  --build-arg SOURCE_REVISION=<full-reviewed-source-commit> \
  --tag daryadarcy-backend:<versioned-tag> <clean-source-context>
BACKEND_IMAGE_ACCEPTANCE=daryadarcy-backend:<versioned-tag> \
  BACKEND_IMAGE_REVISION=<full-reviewed-source-commit> \
  pnpm exec vitest run tests/backend-image.docker.test.ts
CANDIDATE_COMPOSE_ACCEPTANCE=true \
  pnpm exec vitest run tests/candidate-release-compose.test.ts
```

Image test использует `--pull=never`, Linux amd64, network=none/read-only/non-root,
cap-drop/no-new-privileges, без env_file/ports/volumes/SQL/S3. Проверяет metadata,
native sharp, наличие dump client, guest auth200, launch503 без DB, protected admin401,
default-off files404 через настоящий Nest composition. Это не fresh SQL check,
реальные mail/payment/S3 checks или проверка backup client с MySQL8.4.
В первом native run1 pass/1 fail: собственный test ожидал launch200 без DB.
LaunchService.database()/existing nest-application test подтверждают503/no-store
с generic body; исправлено только ожидание probe. Production route не менялся.
Финальный native2 +offline Compose1:3 pass/0 skip/8.80s; Node syntax check
actual `/app/dist/index.mjs` exit0. Production dependencies сверены внутри image:
Nest12.1.2/tRPC11.8.0/axios1.20.0/Drizzle0.45.3/mysql2 3.24.5/sharp0.35.5.
Schema39/HTTP8 на candidate проверялись в FRESH-C3; exact final image повторно
проверен в FRESH-C5 выше. Это по-прежнему не разрешение switch.

## Подготовка будущего switch — не выполнять сейчас

1. Повторно проверить exact server/MySQL identity, историю42 и plan hash
   `51616035e287f221c633d8c7975fef46229d6fbc4ef1e80e586f85e96469684a`.
   `daryadarcy_candidate_20261019` уже инициализирована: initialize повторно
   не запускать. Existing0017–0019 preflight не обходить для текущей БД.
2. До любых изменений сохранить закрытый baseline snapshot: exact API image ID,
   versioned STAGING_IMAGE (он также задаёт web image), compose file set/version,
   hashes конфигурации, защищённую копию прежнего api.env и место её хранения.
   Не печатать resolved config/env/URI и не класть секреты в Git/receipt.
   Старый image сохранить локально на сервере для rollback, не prune.
   Старые свидетельства (`2e3339c`/`sha256:cb5c7404…`) — ориентир, не свежая проверка.
3. Убедиться в запасе диска/RAM для старого и нового images, новом private backup
   месте, наличии проверенного сохранения данных. Владельца/начальные данные,
   permanent candidate app account/minimum grants и политику writes согласовать.
   Не переиспользовать удалённую временную SELECT-only probe учётку.
4. Только после отдельного разрешения на чтение конфигурации/подготовку credentials
   создать `candidate-api.env` вне Git (0600, private parent). Он должен сохранять
   согласованные настройки baseline, заменяя только DB connection на candidate.
   Не менять session secret, provider flags, CORS, quotas или backup/S3 targets
   незаметно. Проверить, что baseline явно задан и не зависит от shell defaults.
5. [Example override](../../infrastructure/deploy/teamassist/compose.candidate-api.example.yaml)
   меняет только `api.image` и **заменяет**, а не дополняет env_file. Требуется
   Compose>=2.24.4 с `!override`; unsupported version — stop, не обходить merge.
   `CANDIDATE_BACKEND_IMAGE` — проверенный immutable image ID, не latest.
   **STAGING_IMAGE не менять на backend-only**: это сломало бы web.
   Проверить resolved diff в закрытой среде: только api image/DB URI; web/mysql/
   edge/networks/volumes/resources/security/flags неизменны. Не выводить secret diff.
6. Перед switch проверить **corrected0763** image на candidate с composition-only
   SELECT account, без workers/providers/egress, как FRESH-C5. Закрыть тестовый
   процесс/учётку. Native backup/restore именно с image client на own disposable
   MySQL8.4 для0763 выполнен в C6: не повторять без изменения artifact/условий.
   При смене client/image новая native acceptance обязательна: `--version` мало.
7. Согласовать downtime, rollback triggers, владельца решения, backup/writes и
   явное разрешение switch. Будущая операция должна затрагивать только `api`,
   с `--no-deps`; не делать общий compose up/down, не пересоздавать mysql/web.

## Процедура отката после отдельно разрешённого switch

До switch отмена означает **ничего не переключать**. Candidate и artifact
сохранить для диагностики; не удалять БД и не запускать reverse migrations.

Если API не стартует/не healthy, ORM/HTTP checks не проходят или права доступа
нарушены, закрыть приём новых writes и остановить candidate API/его workers.
Сначала определить, появились ли новые записи/внешние эффекты после switch.

- **Новых writes/effects нет (подтверждено):** вернуть baseline compose file set
  без candidate override и прежний защищённый api.env; STAGING_IMAGE/exact API
  image должны совпасть с snapshot. Пересоздать только API (`--no-deps`) после
  проверки diff. Возвращается **пара старый image + старая DB connection**;
  старый image к fresh candidate42 не подключать.
- **Writes/effects появились или неизвестны:** автоматический switchback запрещён.
  Оставить приложение недоступным для writes, сохранить обе БД и защищённые
  snapshots/журналы, согласовать reconciliation/потерю новых данных с владельцем.
  Простое возвращение старой БД скрывает новые записи; lossless rollback не обещать.

После возврата: API healthy, guest auth/launch/feed/articles и admin denial,
ожидаемая session/access policy; DB identity проверяется приватно, не endpoint.
Подтвердить прежние IDs/images/configs mysql/web/edge, доступность сайта,
отсутствие второго candidate worker и неизменность S3/flags. При несовпадении
baseline — stop, не чинить исходную БД вслепую.

**Никогда:** down -v, DROP, restore поверх текущей БД, обратные SQL, удаление
candidate/новых записей, массовое удаление images/volumes или перенос старых файлов.
Offline Compose rehearsal проверяет только конфигурационный round-trip, а не
реальный серверный rollback, downtime или восстановление данных.
