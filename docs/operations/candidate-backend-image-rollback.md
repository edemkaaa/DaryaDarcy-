# БД-кандидат: backend artifact и откат приложения

## Граница разрешения —19 октября 2026

Разрешена **только локальная подготовка** образа и процедуры отката. Этот документ
и example override не разрешают upload/load на сервер, deployment, restart,
switch, grants, seeds, SQL apply, S3 mutations или включение private flags.
Текущая БД, frontend и существующая конфигурация rollout остаются прежними.
Результаты схемы/API кандидата: [основной runbook](teamassist-staging.md).

Состояние подготовки: **локальный image/archive готовы**, native offline image
acceptance2/2 и configuration round-trip1/1 прошли. Серверная проверка именно
финального image, native backup/restore с его client и switch не выполнялись.
Разрешения на upload/deploy/switch нет.

Проверенный источник image — `20839114f6cc4236f477ecd6c2c15a80059c66ca`;
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
Docker save exit0, archive tag/config SHA/source/platform и checksum проверены;
archive load на сервере не выполнялся. Не подменять OCI index/config/manifest IDs.

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
Schema39/HTTP8 на candidate уже проверялись отдельно в FRESH-C3; новую сборку
ещё нужно отдельно принять на candidate перед любым switch.

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
6. Перед switch проверить точный финальный image на candidate с composition-only
   SELECT account, без workers/providers/egress, как FRESH-C3. Закрыть тестовый
   процесс/учётку. Native backup/restore именно с image client на own disposable
   MySQL8.4 проверить до включения расписания backup: `--version` недостаточно.
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
