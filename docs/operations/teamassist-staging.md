# Отдельный тестовый стенд TeamAssist

## 21 октября — INTEGRATED: совместный frontend/backend действительно выпущен

Новое прямое поручение разрешило frontend integration, push staging и обновление
dev. Source e8ea7f5 (включает staging39e66a2, backend security/validation и
frontend contracts) отправлен в staging. API/prodamus-test99ada7f1…, webf19115f1…,
BUILD_ID Izh-kkFmKfvnGdUW6lxdd реально работают,3 healthy/restart0/OOMfalse.
Дизайн и правки фронтендера сохранены. Подключены publicCover purpose,
cancellationStatus с reload/expired pending и regenerated API90.

Native offline17, public HTTPS53/internal admin14 GREEN;35 JS byte-exact,
22 VK/19 covers/3 null, pagination/calendar/4 winter bindings подтверждены.
Auth admin проверен signed cookie внутри deployed API: public DNS из его
изолированной сети даёт EAI_AGAIN; внешние HTTPS probes выполнены с server host.
Это не проверка реальной оплаты/отмены/S3/воспроизведения VK или мобильная приёмка.
Локально3057 tests/64 controlled-API browser/4 provider GREEN, audit0.

Candidate DB прежняя, без миграций/переноса/очистки. Backup40 tables проверен
на сервере и Mac; password digest/role/sessionVersion2/history/schema/counts/
videos digest сохранены. Обычные auth reads обновляли lastSignedIn; парольный
вход и logout не вызывались.27 остальных контейнеров неизменны. TEST=true,
flags/limits прежние; S3/старые файлы и публичные копии не менялись. Образы
отката/backup/чужие файлы не удалялись. Полный receipt и guarded rollback:
[runbook](candidate-backend-image-rollback.md#integrated--совместный-выпуск21-октября2026).

## 19 октября — RELEASE-D3: backend/frontend действительно обновлены, candidate активна

После явного разрешения обновлены api/web/prodamus-test, приложение переключено
на `daryadarcy_candidate_20261019`. Working source `da47b54`, включая AUTH-S1;
backend image b8e2a908…, web3b3011d6…, frontend BUILD_ID7i5Wu32yYc4hxf-fZKfrm.
Это выполненный публичный rollout, а не только подготовка или isolated acceptance.
Новые VK catalog и normal checkout recovery включены после согласия пользователя;
private flags off, S3/старые URLs/дизайн не менялись. Прежний админский пароль,
hash/role/sessionVersion2/JWT сохранены. Source DB не удалялась и не изменялась
после write boundary; history0017–0019 не ремонтировали/не обходили.

84 targeted regressions/types/API86/audit0, Next29 pages/native web7 checks,
server candidate39 ORM/18 HTTP и public HTTPS16 checks pass. Public catalog200,
checkout status guest401/admin200/notRecorded, subscription.hasClubAccess boolean.
Проверен настоящий вход прежним паролем, admin stats/logout и страницы стенда.
Обе DB имеют свежие private gzip copies29/40 tables; native new worker backup40
tables/file0600/dir0700 verified. Three new containers healthy/restart0/OOMfalse,
other26 unchanged. TEST режим прежний; платежи/внешние письма не запускались.
Старые публичные выкройки этим выпуском **не защищены** и остаются отдельным пунктом.
Полные immutable IDs, source/delta evidence, private receipts и граница отката:
[актуальный runbook](candidate-backend-image-rollback.md#текущий-working-dev--release-d319-октября-2026).

## 19 октября — FRESH-C6: backup/restore финальным образом на disposable DB

Две own MySQL8.4.11 `backend_test`, tmpfs/no volumes/loopback; сервер, текущая и
candidate DB, frontend, S3 и приложение не затрагивались. Native mysqldump/mysql
из original image2083911/e774… реально восстановили40 tables/42 migrations,
но проверка обнаружила backup directory0755 вместо0700. Исправлен только
Dockerfile: дополнительный chmod0700 layer. Runtime source/bundle/dependencies/
config и все9 base layers неизменны. Новый local tag
`daryadarcy-backend:fresh-c6-2083911-private-backups`, image0763…:10 SQL checks
pass/0 skip/3.47s +offline image2/2/2.43s. Exact data/DDL/history, recovery и
uniqueness; source unchanged, nonempty target refused, real wrong-password dump
не оставляет usable/partial archive или temporary credentials. Gzip0600/dir0700.

Все own probe/DB containers и network удалены с guards; foreign2 stopped
containers/12 volumes/images сохранены. Private archive254MiB/receipt/checksum
вне Git: .local-artifacts/backend-2083911-c6, archive SHA-1b957…, receipt SHA
`63faf78c6fe63678dc805e598feed8c46a990690659a7f0582cc9e4e801d705c`.
Полные hashes/границы — [runbook](candidate-backend-image-rollback.md).
Новый образ **не загружен на сервер**; C5 ниже принимала прежний e774, не0763.
Это не разрешение switch, не off-site/S3/production-scale recovery acceptance.

## 19 октября — FRESH-C5: финальный image на server candidate, без switch

По прямому поручению загружен exact image2083911/e774… только для isolated probe.
Archive и actual bundle hashes совпали с local C4; rebuild/dependency overlay нет.
Candidate UUID/контейнер/network и history42 прежние. Actual image/Nest/MySQL:
39 ORM tables/columns +8 HTTP, exit0/OOM=false; временный SELECT-only account,
без executable/workers/providers/working env/ports/SQL apply. После: users0/
history прежние, own container/account/env удалены,24 existing container IDs/
images/start times/health +config metadata/volumes совпали,7 project services
healthy/current HTTPS200. Фронт/текущая DB/приложение/S3/flags не менялись.

Полный [результат и rollout limits](candidate-backend-image-rollback.md).
Server private receipt: candidate-image-20261019-2083911.f1vR0P/verification.json,
local .local-artifacts/backend-2083911/candidate-verification.json вне Git;
SHA-256 `4c1ef5ad5241298411a98de2a941ce63b42a448ffcb491f00e6fc04bca570f8a`.
Только own uploaded archive254MiB удалён после SHA/owner/root/receipt guards;
локальный оригинал и loaded image сохранены, free~1.7GiB. Это не deployment,
не native dump/restore image client и не разрешение switch. Временные preflight
ошибки metadata template/tar portability исправлены без изменения продукта.

## 19 октября — FRESH-C4: подготовка backend image и rollback

Прямое разрешение — только локальный artifact и процедура, без server upload,
deployment/switch и без изменения frontend/текущей или candidate DB. Отдельный
[runbook образа и отката](candidate-backend-image-rollback.md) описывает backend-only
сборку, API-only override, возврат пары image/connection без reverse SQL и stop
при новых writes. Existing combined Dockerfile/compose не заменяются.

**Финальное продолжение после разрешения запуска Docker/очистки только own cache:**
Docker29.8.1 восстановлен (штатный restart timeout; точные uid/path checks,
TERM и KILL только зависшего supervisor после подтверждения отсутствия VM).
Aborted cache IDs v0aug…/qxvp… после восстановления уже отсутствовали; broad prune
не выполнялся. Existing6 images/12 volumes/2 foreign stopped containers сохранены,
free~4.7GiB до сборки. Собран clean Git archive2083911, pinned Node22/Linux amd64,
frozen prod install291 packages/26.3s и build/export exit0. Первый native run:
metadata pass, probe fail из-за собственного ожидания launch200 без DB.
Existing LaunchService/nest-application test подтверждают503/no-store с generic
body; исправлен только helper, production не менялся. Final native image2 +
offline Compose1 =3 pass/0 skip/8.80s,6 real HTTP/no DB/egress/workers/providers;
sharp pixel и actual executable syntax check pass, dump client только --version.

Image `daryadarcy-backend:fresh-c4-2083911`, index `sha256:e774b30f…56403d5`.
Archive254MiB/receipt/checksum вне Git в private .local-artifacts/backend-2083911;
Docker save/tag/config SHA/source/platform verified, не server load. Полные hashes
и обязательные gates — в linked runbook. Финальный image ещё не проверен на
candidate DB; native dump/restore с image client не запускался. Upload/deploy/
switch/DB/S3/frontend не трогались. Это завершение локальной подготовки,
**не разрешение и не приёмка выкладки или серверного отката**.

Предыдущая попытка (история диагностики, заменена результатом выше):
Offline Compose acceptance RED1→GREEN1: actual Docker Compose5.5.1 config diff
только api image/DB URI; снятие override даёт exact baseline, web/mysql/edge/
networks/volumes/security неизменны. Синтетические private temp env files удалены.
Image acceptance RED2: образ отсутствует. Backend compilation597.1kB/exit0,
frozen dev install и Debian client install успешны, но production packaging
не завершена. Первый prod-over-dev скачивал лишние optional platform packages;
отделён clean prod stage. Registry ECONNRESET/retries и free space115MiB,
Docker API timeout/Desktop stopped; обе own builds остановлены. Native image
GREEN/ID/export отсутствуют — **artifact ещё не готов**. SQL/provider checks
и серверный rollback не запускались, working env не читался.

Удалены только own extracted dependencies и pnpm store в protected
`/tmp/daryadarcy-candidate-20261019.BhP3la/runtime-linux`, после realpath/owner/
0700-parent и archive SHA-256 guards. Node_modules/store имели shared hardlinks;
свободное место после удаления обоих~760MiB. Verified archive143MiB сохранён
(`ecc4cccd…27eaf07`), данные/образы/БД/чужие containers не удалялись.
Own BuildKit cache `v0augx12yu8atgzx3hfyozdxg`2.046GB создан первой попыткой,
exact-id prune по [Docker selectors](https://docs.docker.com/reference/cli/docker/buildx/prune/)
вернул daemon timeout — результат не подтверждён, broad prune не выполнялся.
Задан вопрос о запуске Docker/только own cache cleanup. Нужны свободное место,
живой Docker, финальная сборка и native test. Наличие инструкции само по себе
не является проверкой серверного отката.

## 19 октября — LB4: Библиотека с actual S3, без старых файлов

Новый opt-in test: `tests/library-files.s3.mysql.test.ts` (Node22).
Требует явно переданные `LB_S3_ACCEPTANCE=true`, `BACKEND_TEST_DATABASE_URL`,
совпадающий `DATABASE_URL`, `LB_S3_DATABASE_CONTAINER_ID`, synthetic JWT secret
и согласованные S3 inputs только в памяти. Не загружать рабочий `.env`.
Перед DB/S3 mutation тест проверяет exact ID/name/owner, fresh-library-s3 label,
единственный loopback port, tmpfs/no persistent mounts, пустые users/bindings
и историю42 миграций.
Bucket/endpoint фиксированы, policy SHA-256 должен быть
`0484dfa2cc0164225db616bc516c53e8be377aca975d32701b6a6467ce1715e8`, versioning off.
Никаких policy/ACL/старых object writes/listing или working/candidate SQL.

Финальный изолированный прогон:4/4 pass/0 skip,80.57s/exit0. Импортируются
только6 новых synthetic files (photo/doc×recipes/peterburg/patterns). Потеря PUT
ACK инъецируется **после настоящего S3 PUT**, не mock storage; затем тот же
manifest/key восстанавливается в новом Node process. Результат committed import
отбрасывается exit23; новые процессы/concurrent replay подтверждают единственную
операцию/receipt/object на slot и отсутствие новых SDK PUT. API — настоящий
Nest/JWT/SQL с live доступом; anonymous direct GET/HEAD/Range403, byte-exact
200/HEAD/206, no-store/nosniff, service access без paid row, expiry/session/block
revoke404, чужой rollback conflict и idempotent own rollback/replay409.
Production executable/workers/SMTP/payment/frontend не запускались.

Cleanup только по own ledger actor/UUID/точному набору6 filenames, с matching
metadata/size/MIME/ETag, conditional Delete IfMatch и HEAD404. Policy hash/versioning
сверены до/после; key values не записаны в файлы/Git/logs, клиенты закрыты и
временная память очищена. Все3 own tmpfs fixtures (396788e6…/60852,
c941dc70…/61368,b3324ccb…/61908) удалены с exact guards, чужие2 stopped containers
сохранены. Их данные synthetic и воспроизводятся test/fresh installer.

Промежуточные отказы: installer PATH без `/usr/local/bin/docker` отказал до DDL;
исправлен только environment. В новом тесте `SELECT id` ошибочно использовал
таблицу с PK assetId: первый native3 pass/1 test-query fail, query исправлен.
Параллельный с full regression повтор:1 pass/3 fail после незавершённого импорта;
точный SDK error не записан, причиной без доказательства сеть/код не объявлять.
Pending не публиковался, own targets стали404. Добавлены только categorical
SDK diagnostics (command/name/status) без секретов, timeout/retry не менялись.
Отдельный финальный прогон выше успешен. Это не target performance/S3 SLA.

Full Node22:2544 pass/1578 opt-in skips/200 suites passed/92 skipped/33.91s/exit0;
4 skips нового S3 suite не засчитаны за native acceptance — оно отдельно выше.
Final root types/code prettier/diff/docs pass. Runtime/schema/API/dependencies
не менялись, неизменённую сборку повторно не запускали. LB4 закрыт только для
новых synthetic files; real sources/старые public URL, frontend integration,
second principal (отложен), devices и выпуск/флаги требуют отдельных действий.
Рабочее приложение и server candidate не переключались; push/deploy отсутствуют.

## 19 октября — FRESH-C2/C3: схема кандидата и изолированное API проверены

По прямому разрешению применён **только новый** fresh-профиль к
`daryadarcy_candidate_20261019`. Текущее приложение/БД, frontend, S3 и flags
не менялись; push/rollout/switch не выполнялись. Это не upgrade старой БД.

- Target: teamassist-dev, MySQL8.4.11, UUID
  `2a41f961-c168-11f1-8660-0a4124b25f9f`; mysql container3442fbda5e84,
  project/service labels, internal network и отсутствие DB published ports
  сверены перед доступом. До DDL:0 tables/routines/triggers/events.
- Новый `tooling/scripts/candidate-database.ts` принимает только exact candidate,
  собственную временную учётку и reviewed plan hash из C1; `.env` не загружает,
  унаследованные application/provider credentials отказывает. Existing local
  fresh/preflight guards не расширены. Advisory lock/empty-schema check до DDL;
  partial apply не ремонтирует. Настоящий Drizzle выполнил42 миграции и записал
  history. Повтор initialize отказал, история осталась неизменной.
- DDL source `1a61c261aca9979fdc284517106b6095055a58cf`; API probe source
  `6f06e09785022f0281d26272e5279edab6395081`, SQL bytes/plan прежние.
  History SHA-256:
  `e8d87d9b4547b9568134a4578acf173f0ebc61b868cccde177c7808bf793c9f6`.
- API: composition-only entrypoint без `load-env`, executable и `WorkerJobs.start`.
  Node22.23.3/Linux amd64; runtime JS dependencies установлены локально через
  pnpm9.12.0 `--prod --frozen-lockfile --ignore-scripts` в отдельном Linux container
  и переданы read-only overlay, не заменой рабочего image/node_modules.
  Lock SHA-256 `5843748a36df5dc742249b848b5c56263e16d31addd2656d0f5dc08043839721`;
  dependency archive SHA-256
  `ecc4cccd0e01a834be957a18352ef7893a3072a7cb9e51a9c7e87792127eaf07`.
  Проверены @trpc/server11.8.0, axios1.20.0, sharp0.35.5, Nest12.1.2,
  Drizzle0.45.3/mysql2 3.24.5; старые image dependencies не выданы за актуальные.
- Probe: candidate account **только SELECT**; internal network/no published ports,
  read-only root/mounts, cap-drop/no-new-privileges, UID1001, memory256MiB/CPU0.4.
  Проверены history/все39 ORM tables и columns через real SQL `LIMIT 0`;
  пользователей0. Workers/providers не включены, рабочие SMTP/payment/S3 settings
  отсутствуют, private flags выключены.
- Actual loopback GET: `/api/auth/me`200/user:null, `/api/launch-config`200,
  `/api/trpc/feed.list`200/[], `/api/trpc/articles.list`200/[],
  `/api/admin/launch-settings`401, `/api/trpc/admin.stats`401,
  `/api/library/materials/recipes/files`404 и synthetic
  `/api/media/content-files/<uuid>`404. Все8 прошли, exit0/OOM=false.
- Temporary account/password/env и exact owned probe containers удалены после
  каждого запуска. Existing running container IDs/images/start times и config
  metadata до/после совпали; все7 project services healthy, current HTTPS `/`200.
  Existing working rows не читались/не изменялись. Permanent application grants,
  owner/content seed не создавались.

Проверяемое доказательство на сервере (закрытый каталог, без credentials):
`candidate-20261019-1a61c26.HqAby1/verification.json` в existing project directory.
SHA-256 receipt:
`d6ed9c664c51116e3a20bd79cedacedbcee06c821848c1495a566041e701da60`.
Для повтора API нужны новая временная candidate-only SELECT учётка, exact
identity/source/dependency/hash проверки и обязательная очистка; не использовать
working API env. **Не запускать initialize снова и не менять историю0017–0019.**

Промежуточные отказы не скрыты: macOS metadata archive rejected до SQL;
первый Linux probe UID1000 не видел private UID1001 directory (не засчитан как
успешный schema-negative test). После исправления UID empty-history отказ и
real initialization прошли. Затем production origin validation отклонил synthetic
HTTP origin; safe phase diagnostics выявили причину. Regression RED1→GREEN1,
исправлена только настройка probe на HTTPS `.example.test`; CORS/security не
ослаблены. Server-only dependency install достиг own384MiB/OOM: контейнер удалён,
shared-host лимит не повышали; актуальные dependencies подготовлены локально.
Неудачный offline pnpm deploy не имел полного metadata cache, поэтому его output
не использован: acceptance использует успешную frozen installation, не новый resolve.

Локальные проверки: focused35/3 suites/0 skips, root types, boundaries685,
API86/32048 bytes unchanged, docs58, code prettier/diff exit0. Full Node22.23.2:
2544 pass/1574 opt-in skips/200 passed suites/91 skipped/43.88s/exit0.
SQL выше — настоящая проверка server candidate, не результат skipped suites.
Пустой read-only API не является новой регистрацией/платежом/S3/browser acceptance,
проверкой production image целиком или разрешением релиза. Далее отдельно
согласовать release artifact/rollback/switch и owner/начальные данные;
приложение остаётся на старом image/старой БД до такого решения.

## 19 октября — FRESH-C1: офлайн-план схемы кандидата

Первый локальный срез подготовки server candidate, **не инициализация сервера**.
Существующий fresh tool теперь имеет отдельный режим без подключения:

```sh
pnpm db:fresh:local --plan
```

Запускать локально, не с `NODE_ENV=production`. Он читает versioned SQL/journal,
проверяет отдельный fresh-профиль и возвращает JSON: `profile:fresh-install-plan`,
`migrations` (42 ordered tag/when/hash), `planHash` (SHA-256 UTF-8 JSON этого
массива), `databaseChecked:false`, `initialized:false`, `releaseApproval:false`.
SQL body/URI/секреты не печатаются. Docker, SQL, SSH, S3 и `.env` не используются;
даже унаследованные application/preflight/fixture URI игнорируются. Режим ничего
не сохраняет и не создаёт журнал применённых миграций.

Текущий отпечаток source-плана:
`51616035e287f221c633d8c7975fef46229d6fbc4ef1e80e586f85e96469684a`.
Хранить его вместе с выбранным source commit при дальнейшем review. Это не
самостоятельный trust anchor, проверка целевой БД или разрешение apply: любое
изменение SQL меняет hash и требует нового review; новый hash сам себя не одобряет.
Неизвестный/отсутствующий SQL, malformed manifest или совмещённые/неизвестные
операции дают отказ, не частичный план. Existing local initialize/check по-прежнему
ограничены собственным loopback/tmpfs backend_test; server mode не добавлен.

CLI RED:3 ожидаемых failures до реализации; GREEN:11 CLI +3 fresh policy +12
manifest/history +13 command gate =39 pass/4 suites/0 skip на Node22.23.2.
Connection trap получил0 соединений, legacy journal bytes сохранены. Все source
fixtures созданы только в own mkdtemp и удалены тестом. Server candidate не
проверялся/не менялся, migration apply/image rollout/switch ещё впереди.
Общий Node22 regression:2519 pass/1574 opt-in skips/198 passed suites/91 skipped,
63.67s/exit0. Root types/boundaries685/API86 unchanged/docs58/prettier/diff pass.
Новые SQL/S3/browser проверки и build неизменённого приложения не запускались.

## 19 октября — подготовка отдельной пустой БД, без переключения

Пользователь запросил push в staging и обновление сервера; после preflight выбрал
«подготовить отдельную пустую БД на сервере; переключение согласовать после проверки».
Это не разрешение очистки/upgrade существующей БД или включения private flags.
Remote staging обновлён обычным fast-forward `81e8563..b810ddb`;
`ls-remote` подтвердил `b810ddb29caad4528f18a74168b97c487b2a0dd9`.
История/правки фронтендера сохранены; ветки не переключались, force не применялся.
Следующий evidence commit меняет лишь документацию, не приложение.

- SSH: exact `edem@155.212.216.16`, hostname `teamassist-dev`, существующий ключ,
  strict host verification. Каталог приложения прежний; env-файлы не выводились.
- В existing project MySQL8.4 создана **только новая пустая database**
  `daryadarcy_candidate_20261019`, charset utf8mb4/collation utf8mb4_0900_ai_ci.
  До CREATE проверено отсутствие имени; mysql3442fbda5e84, Compose project
  `daryadarcy-staging`/service mysql, healthy, без published DB ports.
  После CREATE: 0 таблиц, routines, triggers, events. Root credential использован
  только внутри existing container для этой операции, не выведен/скопирован.
- Existing database rows не читались/не менялись. Все running container IDs,
  images и start times до/после совпали; новые контейнеры/volumes/учётки не создавались.
  `api.env`, image/Compose/nginx configuration и S3 не менялись. Сервисы не
  перезапускались: api/web остаются `daryadarcy-staging:2e3339c`.
- Existing HTTPS deployment, **не новый кандидат**: GET `/`, `/api/auth/me`,
  `/api/launch-config`200, guest admin.stats401. Никаких покупок/писем/webhooks.
  Свободно3.5ГБ диска/около667МБ available RAM: тяжёлую сборку на shared host
  автоматически не запускать, чужие образы/кэши/БД не чистить.

Проверки исходников перед push: types/E2E types, lint, backend build,
Next webpack29/29, API86/32048 bytes, boundaries685, docs58, production audit0.
Общий Node22 regression сначала выявил2 failures из-за test-only
structuredClone(File)→Blob; минимальный fixture fix `b810ddb` сохраняет File,
клонируя metadata. Production validation/frontend не менялись. Focused34/34
на Node22 и23; full Node22 —2508 pass/1574 opt-in skips/197 passed suites/
91 skipped/64.19s/exit0. Это не новые SQL/S3/browser/native Linux acceptance.

Стандартный migration preflight остановлен до подключения: незарегистрированные
0017–0019, `databaseChecked:false`, `releaseApproval:false`. Рабочую историю
не исправляли. Выбранный fresh путь не требует истории старой БД, но existing
`db:fresh:local` намеренно ограничен own local tmpfs backend_test: его guards
нельзя отключать ради server target. Далее нужна проверенная target-specific
fresh процедура и candidate image/API acceptance на новой БД; после неё отдельное
согласование switch. Пока схема, owner/application grants и данные отсутствуют;
новый backend не выложен, fresh42 acceptance сервера не объявляется.

## Отдельная пустая БД — локальный fresh-install, 14 октября 2026

Это отдельный путь нового запуска, не обновление существующей базы. Команда
`pnpm db:fresh:local --initialize-empty-local` принимает только явно переданные
`FRESH_DATABASE_URL` и `FRESH_DATABASE_CONTAINER_ID`; `.env`/`DATABASE_URL` не
используются. Адрес — `127.0.0.1:<выделенный порт>/backend_test`, контейнер —
MySQL 8.4 с именем и `codex.owner=daryadarcy-fresh-<идентификатор>`, tmpfs
`/var/lib/mysql`, без mounts/volumes. Перед подключением проверяются ID, имя,
метка, фактический loopback-порт и хранилище. Production запрещён.

Перед DDL проверяется отсутствие таблиц, views, routines, events и triggers;
повторная/частичная установка отказывает без ремонта. Выполняются все 36 исходных
SQL-файлов 0000–0035 через Drizzle. Отдельный временный fresh-only journal включает
0017–0019; исходные SQL, старый journal и старый preflight не переписываются.
Новый журнал содержит фактически исполненные hashes/ordering IDs, а не
утверждение о выполнении старых миграций в существующей среде.

После установки `pnpm db:fresh:local --check-local` только сверяет историю,
ничего не применяет. Стандартный `db:push` для этой fresh-истории **не использовать**:
дальнейшее обновление требует явного совместимого профиля и отдельной проверки.
MySQL DDL не откатывается целиком: при сбое сохраняется частичная тестовая БД;
только после проверки принадлежности оператор может удалить свой одноразовый
контейнер и повторить на новом пустом. Автоматического drop/reset нет.

Установщик не создаёт администратора, контент, оплату или подписки. Для рабочего
запуска отдельно нужны безопасное создание владельца, production configuration,
backup/restore и приёмка интеграции. Feature flags не включаются. Локальный
успех не разрешает выкладку и не подтверждает исправность платёжных провайдеров.

Acceptance: native MySQL без fixture DDL; 36 строк истории, отказ непустой БД,
повторного запуска, чужого ID, внешнего адреса и production; чтение всех текущих
ORM-таблиц/колонок; native HTTP пустых feed/articles и отказ гостю в admin API.
Существующая БД, frontend, S3 и внешняя почта не затрагиваются.

### AG5-F4 — локальная репетиция резервной копии и восстановления

14 октября по отдельному поручению проверен полный цикл **только синтетической
БД**: fresh-install36 → существующий `runMysqlBackupIfDue` → gzip → native mysql
в другой пустой собственный tmpfs контейнер. Шесть native checks прошли без
пропусков за2.55s. Все таблицы и SHA256 содержимого каждой совпали; точные
SHOW CREATE TABLE совпали (engine, collation, generated expressions, indexes,
AUTO_INCREMENT). История36/hashes, Unicode/JSON/NULL, уникальность email и recovery
key сохранены. Непустой restore target отказывает до исполнения дампа.

Повторяемая проверка: `pnpm exec vitest run tests/fresh-backup-restore.mysql.test.ts
--maxWorkers=1`. Требуются четыре **test-only** переменные:
`BACKUP_REHEARSAL_SOURCE_URL`, `BACKUP_REHEARSAL_TARGET_URL`,
`BACKUP_REHEARSAL_SOURCE_ID`, `BACKUP_REHEARSAL_TARGET_ID`. Оба backend_test должны
быть пустыми, адрес127.0.0.1 с отдельными портами, MySQL8.4/tmpfs без mounts,
имя и codex.owner совпадают с `daryadarcy-fresh-backup-<идентификатор>`.
ID/порты/storage проверяются до подключения; source и target различаются.

На host нет mysqldump: test-only transport adapter в
[tests/fixtures/native-mysql-dump.cjs](../../tests/fixtures/native-mysql-dump.cjs)
переносит настоящий MySQL8.4 dump в source container, сохраняя production
single-transaction/quick, gzip, файловые права и контроль завершения. SQL и
результат резервирования не имитируются. Пароль source передаётся через stdin
option-file; restore использует только синтетический пароль своего контейнера.
Рабочие `.env` не читаются, S3 переменные явно пустые, каталог временный/закрытый.
Архив и только свои контейнеры удаляются после проверки принадлежности.

Это доказательство восстановления **текущей схемы на такой же MySQL8.4**, не
production-процедура импорта: разрешён только generated synthetic dump в own
пустой target. Не проверены рабочее расписание, off-site/S3-медиа, шифрование,
межверсионное восстановление или нагрузка/изменения схемы во время дампа.
Создание владельца, server configuration, production backup/restore и выкладка
остаются отдельно согласуемыми. Runtime backup и frontend не изменялись.

### AG5-F5 — согласованный локальный тестовый владелец

14 октября пользователь отдельно разрешил свой тестовый owner и случайный
пароль, сохранённый вне Git в закрытом локальном каталоге. На новом own tmpfs
MySQL8.4 после fresh36 создан один account с existing admin role и существующим
scrypt hashing. Административные права согласованы только для этого локального
стенда; auth/role/CORS/proxy/quotas/runtime code не изменялись.

Native API восемь групп проверок прошли: неверный пароль401 без cookie;
правильный200, HttpOnly/SameSite=Lax cookie, me с ожидаемым admin;
guest admin401/owner200; passwordHash не раскрывается; logout очищает cookie;
users=1/email-binding-outbox=0. Минимальное окружение без рабочих DB/S3/SMTP
секретов, composition без .env и scheduler; письма/платежи не запускались.

Стенд оставлен локально для пользователя, frontend не запускался. Точный active
container/API/private-directory metadata — в начале todo, без пароля/email/JWT.
Credentials file600, private directory700 проверены. Это одноразовая tmpfs БД:
остановка контейнера уничтожит её содержимое; не переносить её в рабочую среду
или включать резервирование credential данных автоматически. Перед остановкой/
удалением подтверждать exact ownership; private пароль не публиковать в Git/логах.
Это выполненная локальная проверка входа, не production bootstrap или UI приёмка.

## AG5 — процедура подготовки выпуска, 13 октября 2026

**Подготовка, не выполненный rollout.** Действующий backend план — начало
[tasks/plan.md](../../tasks/plan.md). Рабочая БД/SSH/секреты не читались, миграции
и флаги не применялись. Старые описания выпусков ниже относятся к указанным датам;
сегодняшняя версия сервера не установлена.

### 1. Зафиксировать реальную историю, не чинить её по догадке

Локальный manifest содержит незарегистрированные SQL `0017`–`0019`; стандартный
preflight должен отказать до подключения БД. Подготовительная команда из repo:

```sh
env -u DATABASE_URL -u MIGRATION_PREFLIGHT_DATABASE_URL \
  PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm db:preflight
```

Это локальная проверка без соединения: `databaseChecked:false`, `pending:null`,
`releaseApproval:false`; ненулевой exit при manifest issues ожидаем и не скрывается.
Нельзя заменить проверку `db:push`, вставить придуманные history rows или повторить
старые ALTER только потому, что SQL-файл существует. Не редактировать hashes/when
применённых миграций. MySQL DDL не считать общей rollback-транзакцией.

Для решения владелец среды предоставляет проверенный пакет без credentials/PII:
точный repo commit/SQL hashes, snapshot миграционного журнала (created_at/hash),
schema-only DDL/index/collation/engine затрагиваемых таблиц и происхождение
выполненных `0017`–`0019`. Доказать для каждой миграции, что и когда было выполнено;
согласовать исправление manifest/history отдельно. SQL structure equivalence не
доказывает автора/время исполнения. Synthetic fixture не является историей среды.
До получения этого пакета — **блокер истории**, никаких working connections.

### 2. Проверить применимость 0027/0028/0029 и 0032–0035

После согласованной истории проверенный владелец выполняет штатный read-only
preflight именно для целевой БД. Не путать inspection URI с apply DATABASE_URL:
`--require-database` проверяет тот же target и отказывает при несовпадении.
Доступ агента к рабочей БД текущим поручением не разрешён.

| Миграция | Обязательное доказательство до apply | Отказ/граница |
| --- | --- | --- |
| 0027_user_email_identity | Поддерживаемый MySQL/functional unique index, collation; полный read-only результат email preflight: no invalid/noncanonical/normalized duplicates | Конфликтные данные не исправлять/не объединять автоматически; не печатать email |
| 0028_member_email_bindings | Таблицы/поля/PK/proofHash uniqueness и worker indexes совместимы с точным backend commit, InnoDB; нет частичного/чужого schema rollout | Presence guard не заменяет историю/DDL review; partial schema не «лечить» runtime DDL |
| 0029_article_creation_requests | PK(requestKey), actor/payloadHash/claimToken/articleId/createdAt, InnoDB; reviewed journal и retention/export/account-deletion решение | Keyed create/status fail closed; не переключать запрос на unkeyed при отказе |
| 0032_private_attachment_uploads | InnoDB; full PK(requestKey), unique assetId/mediaId, binary ASCII identities, immutable payload/namespace hashes, pending/ready/ETag/post/media binding; retention/export/delete/orphans решение | Runtime не ремонтирует DDL и не делает public fallback; ready без storage evidence не успех |
| 0033_content_recovery_markers | InnoDB/full PK(kind,requestKey), ASCII_BIN key, owner index и expiry scan indexes | Schema/spent guards/explicit local compaction готовы; scheduler отсутствует. После compact старый writer не является допустимым rollback |
| 0034_private_recovery_lifecycle | Nullable recoveryCompactedAt/orphanedAt на private_attachment_uploads; применить до backend с расширенной ORM-моделью | Только own fixture применён. Private upload/delivery на новом backend требуют полных новых columns даже при maintenance flags off; working apply запрещён |
| 0035_recovery_retirement | Nullable private actorUserId, owner/key indexes четырёх recovery таблиц; полные PK, unique assetId/mediaId и InnoDB сохранены. Точный backend включает R6 session/write fences | Нужна до retirement/export flags. После NULL-owner scrub возвращать NOT NULL или старые recovery writers нельзя; исторические удаления не чинить автоматически |

Email identity preflight сейчас вызывается штатным инструментом, когда `0027`
остаётся pending. Если индекс уже помечен applied, отдельно подтвердить существующее
определение/совместимость схемы и данных; отсутствие повторного scanner call не
является доказательством этого состояния. Неполная проверка — отказ, не одобрение.

### 3. Репетиция и backup/rollback

Сначала использовать только собственный disposable loopback/tmpfs `backend_test`
и existing fixtures. Выполнить после выбранного изменения relevant lifecycle/
retention/email worker/article recovery suites; recorded unchanged GREEN не
прогонять снова без причины. Отдельная репетиция на предоставленном обезличенном
schema/history snapshot не может называться репетицией рабочих данных.

Перед любым отдельно разрешённым working apply владелец среды фиксирует точные
commits/image/schema/flags, защищённый backup и проверенный restore. Проверка gzip
или числа таблиц не доказывает восстановление. Не переносить пароль/secret values
в отчёт. Во время rollout ограничить несовместимые writes/workers по согласованной
процедуре; существующие данные сохраняются.

Rollback: сначала выключить новые write/UI/worker flags, остановить новые операции
по проверенному lifecycle, затем вернуть **совместимый** backend/frontend образ.
Не удалять новые таблицы/ledger/unique index автоматически. Старый upsert до
identity hardening может неверно обработать новый unique email index: такой образ
не является допустимым rollback только потому, что он раньше работал.
После успешной binding/application нельзя восстановить старый SQL dump поверх
новых идентичностей/операций без отдельного плана потери данных и решения владельца.
History/DDL rollback не имитировать. Выбор checkpoint и остановки — часть review.

### 4. Порядок включения и критерии

1. Согласовать history/retention, проверить target/preflight и rehearsal/restore.
2. По отдельному разрешению применить нужную schema; проверить exact columns/
   indexes/engines и совместимый backend при выключенных новых функциях.
3. Фронтендер регенерирует API contract на общей выбранной базе и подключает
   `hasClubAccess`, article intent/status, email форму/страницу; backend первым.
4. Только после проверки schema/crypto/SMTP/public URL/navigation включить backend
   binding, затем согласованную frontend build форму. Worker не запускается с
   частичной схемой. Email ACK/queued не считать inbox delivery.
5. Article ключи включать клиентом после 0029; потеря ответа/reload сохраняет один
   ID и teaser. Неизвестный статус не разрешает новую UUID. Новый ledger не стирать
   при rollback клиента или удалении статьи.
6. Private file flags отдельно: AG2/AG3/AG4 пройдены локально 14 октября для новых
   audio/document. До0032/history/client acceptance остаются off:
   PRIVATE_POST_MEDIA_UPLOAD_ENABLED/PRIVATE_POST_MEDIA_DELIVERY_ENABLED.
   Проверить scoped policy двух private-v1 prefixes и synthetic rollout. Backend
   первым, фронтендер подключает assetId/post keys. Старый upload/objects/ACL не
   мигрировать этим включением. Rollback: остановить новые writes, не стирать
   ledger/objects и не возвращать общий public Allow для prefixes с закрытыми
   данными. Binding/article rollout не включает storage автоматически.
7. R6 отдельно: после0035/schema проверки, подтверждённых backup/restore условий
   и остановки несовместимых API/writers/workers использовать backend с session
   epoch fence и existing-only activity update. Зафиксировать одинаковую версию/
   конфигурацию всех workers; старый worker может выполнить final scrub без
   отвязки журналов, повторный tick этого не исправляет. Retirement/export flags
   (`CONTENT_RECOVERY_RETIREMENT_ENABLED`, `CONTENT_RECOVERY_EXPORT_ENABLED`)
   включать только отдельным решением владельца. Они не включают storage cleanup.
   Проверить own export/foreign denial, final deletion/старую сессию, сохранённые
   bound read evidence; actual file bytes требуют отдельного разрешения S3.
   После scrub откат флага не возвращает удалённые связи. Restore повторяет
   удаления/expiration до открытия API; backend без R6 fences не допустимый rollback.
8. Сквозные оплата/письмо/вход/продление/отмена, устройства/нагрузка/пилот — AG9
   после разрешения владельца; не выдавать fixtures за провайдера/участницу.

**Следующий вход после локального R6 (backend checkpoint b525130):** владелец
среды предоставляет пакет истории0017–0019 и обезличенный schema/history snapshot
из раздела1, подтверждает срок хранения recovery backups/проверенный restore и
общий release candidate с фронтендером. Snapshot не содержит пользовательских
rows, паролей или ключей. До этого AG5/AG9 остаются открытыми; локальные fixtures
не заменяют недостающую историю. Этот документ не является разрешением доступа
к рабочей БД, rollout, S3 или включения flags. Новая runtime работа без обнаруженного
дефекта/недостающего согласованного сценария не добавляется.

### Нерешённая политика журнала статей

`article_creation_requests` содержит actorUserId/articleId, payload fingerprint и
результат операции: это связываемые с автором данные, хотя текст/URL не копируются.
Успешные ключи сейчас без TTL/FK cascade. Удаление статьи сохраняет результат для
позднего retry. Срок по цене диска назначать нельзя; удаление истории открывает
повторное создание и требует нового контракта recovery.

До working rollout владелец выбирает цель/срок хранения, поведение при окончательном
удалении аккаунта и составе export/backup. Требуется проверить **оба** existing
post_creation_requests и новый article ledger при таком решении, без расширения
сбора данных. Agent не вводит TTL/автоматическую очистку в этом шаге.

AG4 добавляет `private_attachment_uploads`: actorUserId, display filename,
immutable fingerprints/namespace, storage evidence и binding. Ключи и orphans
без TTL; отдельное решение хранения/export/account deletion/backup требуется
перед0032/flags. Удаление media/post оставляет recovery evidence; чистка его без
контракта может разрешить повторную загрузку/привязку. Автоматическое физическое
удаление объектов и рабочие data fixes этим шагом не разрешены.

### AG5 — проект контракта хранения, 14 октября 2026

**Принят для локального продолжения, в реализации.** После объяснения30 суток
и повторного уточнения пользователь ответил «да все делаем дальше». Агент явно
обозначил трактовку как четыре рекомендации перед началом локального среза.
Рабочие TTL/очистку не включать; backup условия отдельно подтверждает владелец.
Четыре решения ниже — продуктовые сроки,
не требования ТЗ или утверждение о юридических сроках. Область:
`post_creation_requests`, `article_creation_requests`, `private_attachment_uploads`.
Billing/провайдерские журналы, email lifecycle и прежние файлы не менять этим контрактом.

1. **Восстановление — 30 календарных суток.** От первого серверного `createdAt`,
   UTC; повторы не продлевают срок. До границы (`now < createdAt + 30 суток`) —
   прежний результат/тот же объект; после неё повтор известного намерения и status
   дают409 CONFLICT «Срок восстановления истёк», не `notRecorded`, не новый create
   или PUT. Нельзя предложить новую операцию автоматически после timeout/expired.
   Этот срок не ограничивает жизнь опубликованного материала или bound файла.
   Новый режим default-off; до совместимого rollout остаются нынешние no-TTL/replay правила.
2. **После окна — минимальная отметка против дубля.** Для обработанного ключа
   сохранить только namespace/request fingerprint, принадлежность нужному аккаунту
   и терминальный запрет повторного эффекта; без текста, имени файла и результата
   для UI. Хранить, пока исходная учётная идентичность может выполнять запросы;
   при окончательном удалении — удалить вместе с её recovery-данными, после
   необратимого отзыва старого доступа и с защитой восстановления backup.
   Hash/ID считаются связываемыми техническими данными, не «анонимными».
   Для **живого bound вложения** отдельно сохранить необходимую read evidence:
   assetId/key namespace, MIME/size/ETag и post/media связь до удаления самой связи;
   30-дневная очистка не может сломать чтение. Это ещё не существующая compact schema.
3. **Новые непривязанные файлы — очистка после 30 суток.** Для never-bound —
   от первого upload intent; для detached/deleted post — от серверной фиксации
   удаления связи. Если её дата неизвестна, срок не угадывать по upload createdAt.
   Сначала атомарно закрыть intent для поздних upload/bind, исключить concurrent
   writer/binding, затем reconciliate unknown/pending по точному ключу и ownership
   evidence. Удалять только ledger-owned объекты двух новых private-v1 prefixes,
   с namespace/metadata/size/ETag guards и подтверждением HEAD404. До подтверждения
   сохранять evidence для повторной очистки; таймаут удаления не означает успех.
   При конфликте/неизвестной принадлежности — отказ и проверка владельцем, не
   bucket sweep. Bound файлы, legacy URLs/ACL/objects не подпадают под эту очистку.
4. **Удаление аккаунта, export и backup — единый жизненный цикл.** Текущую дату
   окончательной обработки удаления/оплаченный срок не менять. В этой обработке
   закрыть recovery, стереть персональные поля/связи автора журналов; export до
   удаления включает относящиеся к нему recovery-записи и статусы без чужих данных,
   secrets, подписанных ссылок или нового draft-download доступа. Материалы проекта
   и bound вложения не удалять только из-за удаления аккаунта администратора:
   сохраняется минимальная read evidence без идентичности автора загрузки.
   Цель для backup этих recovery-данных — срок не более30 суток, который отдельно
   подтверждает владелец среды. Пока последний содержащий старые данные backup
   не истёк, не обещать полное стирание. Restore до открытия API повторяет удаления
   и expiration; минимальные отметки завершённых удалений сохраняются до истечения
   всех охватываемых backup. Прежние журналы оплат не очищаются этим 30-дневным сроком.

**Условия реализации после решения:** сохранить один согласованный источник
политики; additive schema/компактизация и terminal guards сначала, bounded cleanup
default-off после draining несовместимых writers. Формат существующего frontend
контракта/старые ключи не менять молча; истечение требует передачи фронтендеру
и совместимой приёмки до enablement. Никаких новых dependencies/хостингов.
History0017–0019 и обезличенный schema/journal snapshot остаются отдельным gate;
утверждение срока не разрешает working migration, S3 DELETE или rollout.

R4b проверен локально:102 pass/5 suites/skip0,7.02 s, own MySQL/HTTP/SDK wire.
Spent marker проверяется независимо от expiry flag: rollback флага не открывает
старый ключ для нового post/article/PUT или непривязанного asset. Bound receipt
с marker остаётся read evidence, чтение/редактирование не истекает. Writer locks
original ledger→marker; status статьи читает ledger/marker в одном nonblocking
repeatable-read read-only snapshot. Не использовать сочетание Drizzle0.45.3
withConsistentSnapshot+accessMode: установленная версия соединяет SQL options
пробелом вместо запятой; достаточно explicit RR и первого consistent read.
Пойманная блокировка uncommitted status и последующий SQL-start отказ устранены,
полные affected native suites пройдены после восстановления own fault fixtures.
На checkpointR4b batch compactor/orphan DELETE ещё не реализованы; последующее
локальное продолжение описано ниже. Final scrub/export не реализованы, никаких
working rows/objects не удалялось. Полный regression сохраняет ранее зафиксированный
frontend viewport failure, этот focused GREEN его не заменяет.

**R4c/R5 — явная локальная maintenance, 14 октября.** Компактизация post/article
в bounded1–100 rows на ledger транзакционно сохраняет minimal spent marker и
удаляет detailed journal. Материал/teaser не удаляются; conflicting marker
откатывает detail deletion. Private keyset pass bounded1–100 rows с nextCursor:
атомарно сохраняет marker, очищает original upload filename, сохраняет read/cleanup
evidence и серверные lifecycle timestamps. Payload/namespace fingerprints, size,
MIME/ETag, asset/post/media остаются необходимым доказательством владения до
закрытия связи/подтверждения storage cleanup; это не полная анонимизация данных.
Bound post_media filename/display и материалы этим сроком не очищаются.

Never-bound срок — original createdAt; отсутствующая связь detached/deleted post
получает orphanedAt в момент первого безопасного наблюдения, а не давнюю дату
загрузки. Живая связь сохраняется, marker закрывает только recovery. Перед S3
DELETE marker уже committed; затем original asset lock повторно проверяет live
binding, ownership/namespace/size/MIME/metadata/ETag и точный derived private-v1
key. Только conditional DELETE IfMatch, затем HEAD404. Lost ACK/SQL rollback
сохраняют receipt/marker; новый compiled процесс доводит подтверждение без второго
DELETE и без нового PUT/bind. Unknown pending PUT reconciled тем же ключом.
Versioned buckets отказаны; versioning/object-lock/provider acceptance отдельно.

Два default-off флага `CONTENT_RECOVERY_RETENTION_ENABLED` и
`CONTENT_RECOVERY_MAINTENANCE_ENABLED` нужны для compaction; дополнительный
`PRIVATE_ORPHAN_CLEANUP_ENABLED` нужен для storage DELETE. Функции не подключены
к API, scheduler или production boot. Private maintenance жёстко ограничена
non-production loopback `backend_test`; storage DELETE — loopback HTTP S3 wire.
Включение flags не делает рабочее хранилище допустимым target. Scope расширять
лишь отдельным согласованным rollout после history/snapshot, draining старых
writers, provider IfMatch/versioning acceptance и backup/restore решения.
Не запускать bucket sweep/ListObjects, рабочую очистку, старые migrations или
автоматический цикл. Cursor продолжать явно; failed>0 — не успех, evidence
сохранена для точечного повторного прохода/исследования. Счётчики растут только
после SQL commit; deadlock/timeout — retry pass, не ложный completed result.
Native affected checkpoint:116 pass/6 suites/skip0,8.25s; реальные SQL/HTTP,
loopback SDK bytes, forced SQL rollback, late binding row-lock race и fresh-process
lost DELETE ACK. Это не новое Timeweb acceptance. Migration tests31 pass,
offline preflight0034 зарегистрирован, прежние0017–0019 gate не обходились.
Full regression на R4c/R5:3454 pass/1 unchanged frontend viewport failure/179 skip,
3634 total,195.13 s,exit1. Failure: `document is not defined`, frontend viewport.ts:73,
тот же прежний тест/код, frontend не исправлялся/не скрывался. Report own temp
`/tmp/daryadarcy-ag5-cleanup-report.KtBiSu/full.json`; это не full GREEN.

R6a: окончательная обработка удаления атомарно увеличивает sessionVersion вместе
с existing scrub/openId retirement. RED на SQL fence: snapshot actor старого admin
мог продолжить private write после удаления; после исправления UNAUTHORIZED.
19 real SQL/native maintenance cases,0 skip,2.06s: paid/grace/renewal timing,
transaction rollback, два workers и повторный tick сохраняют прежнюю семантику.
Роли, срок удаления, платежи/журналы оплат не изменены. Это первый срез R6,
не полная irreversible retirement приёмка всех writers: post/article in-flight
contexts ещё требуют отдельной проверки/fence; owner-link scrub с сохранением
bound/orphan evidence и own export пока НЕ реализованы. Backup/restore/history
условия остаются внешними. Working DB/S3/фронт не затронуты.

R6c локальный контракт: `CONTENT_RECOVERY_RETIREMENT_ENABLED=true` (default-off)
включает удаление post/article recovery rows и markers автора в existing final
scrub transaction. Private receipts сохраняют assetId, state, MIME/size, ETag,
payload/namespace hashes, post/media, createdAt/orphanedAt; actorUserId=NULL,
filename пуст, recoveryCompactedAt установлен, requestKey заменён fingerprint
`retired-private:v1` + assetId без старого actor/client intent. Это не полная
анонимность S3 metadata/backup и не удаление материалов проекта. Maintenance
не воссоздаёт marker владельца для terminal NULL-owner receipt. Миграция0035
разрешает nullable private owner и добавляет owner/key indexes; runtime не
исправляет DDL и отказывает на partial/non-InnoDB schema. SQL rollback сохраняет
все прежние links/identity. Перед рабочим включением drain старых writers и
existing history/backup/restore gates; откат flag возможен, deanonymization нет.
DDL rollback0035 после scrub не выполнять: NULL owners необратимы; restore требует
повторного retirement до открытия API. Все проверки только на own tmpfs DB.

R6d API contract (локальная реализация): `profileExtras.recoveryExport` query,
protected, `CONTENT_RECOVERY_EXPORT_ENABLED` default-off. Strict input
`{kind:'post'|'article'|'private_attachment', afterKey?:64 lowercase hex, limit?:1..100}`,
default limit25. Нет userId selector: owner берётся только из текущей сессии.
Output `{items:[{requestId,createdAt,status}], nextCursor:string|null}`. requestId —
серверный fingerprint, НЕ original client idempotencyKey; курсор такой же fingerprint.
Post/article status `created|deleted` (существует ли committed material), upload
`pending|ready`, compact/expired `expired`. Expiry использует existing retention flag;
marker всегда terminal независимо от flag. Нет content, filename, material/assetId,
payload/namespace hash, claimToken, ETag, credentials, signed/public/file URLs.
Экспорт не восстанавливает draft-download capability и не экспортирует billing/email
ledgers. Две indexed keyset выборки journal/markers объединяются на одной read-only
RR snapshot; marker побеждает duplicate. Это live pagination, не frozen bulk backup:
новые записи перед курсором требуют нового обхода. Existing session epoch/block
проверяются на той же nonlocking snapshot; missing/partial0035 schema даёт sanitized503,
не empty success. API/backend handoff additive; frontend/generated types не меняются.

R6c/R6d verification: first retirement RED retained actor links; native SQL GREEN
preserves neighbors/material/receipt, rollback/partial schema/disabled flag,
101-row bounded batches, retired orphan compaction without resurrecting markers.
Export RED absent route; native HTTP/JWT/SQL GREEN18 cases: own vs foreign,
created/deleted/pending/ready/expired, marker precedence/cursor after compaction,
strict input, guest/revoked/block, stale context, busy owner nonblocking read,
partial schema503/no secret fields. Acquisition/disabled gate два unit RED→GREEN.
Final review RED dropped private PK still allowed retirement; shared schema guard
now requires full primary keys/InnoDB/private asset/media uniqueness before scrub
or export. Последний affected checkpoint288 pass/14 suites/skip0,16.00s; tsc/build/
boundaries/docs/diff exit0. Full checkpoint before this last uniqueness guard:
3498 pass/1 unchanged frontend viewport failure/174 skip/3673 total,197.06s,exit1;
`/tmp/daryadarcy-r6-export.WsYnXU/full-final.json`. Backend test doubles/lock gates
aligned with R6b actor→material locks; actual missing material/atomic final result/
one announcement assertions retained. Full GREEN не заявлен; frontend untouched.
API generated contract intentionally stale (`check:api` exit1); offline preflight
0035 registered but0017–0019 unresolved, databaseChecked=false/releaseApproval=false.
Flags remain off. Historical already-retired production records are not scanned
or repaired by this change; such inventory needs reviewed rollout/snapshot input.
Local R6 implementation complete; backup expiry/restore replay/working acceptance
not performed. No working DB/S3 access or external deliveries in these checks.

R6b: post/article keyed/legacy create, edit/delete и confirm post получают epoch
из authenticated context и повторно проверяют его в write transaction под user
PK lock, перед locks материалов/журналов. После final retirement старый context
получает UNAUTHORIZED без write; нормальные системные helper/job вызовы остаются
internal actorless. Это не blanket guard всех admin routes. Authentication
activity заменена с upsert на existing-only update: id/openId/sessionVersion/block
совпадают, busy row пропускается через SKIP LOCKED. Старый openId не воскресает
после scrub; article status не ждёт in-flight writer через incidental heartbeat.
RED:9 stale RPC write cases и2 native SDK/SQL activity races; GREEN affected
checkpoint179 pass/7 suites/skip0,8.84s. Native HTTP/compiled-process lost ACK/replay
и uncommitted status сохранены. tsc/backend build/boundaries exit0. Это не browser
и не production acceptance. Owner-link scrub/export всё ещё не реализованы.

Первый локальный срез — `CONTENT_RECOVERY_RETENTION_ENABLED`, default-off,
отказ409 после30 суток на upload/status/unbound association, keyed post create
и article create/status. Новый post status endpoint не добавлять. В первом срезе строки не удалялись; R4c/R5 меняют лишь own fixture. Bound read
не зависит от окна восстановления. Invalid timestamps — отказ503, не успех.
Команды в own loopback/tmpfs fixture: `pnpm exec vitest run tests/private-attachment-uploads.mysql.test.ts --maxWorkers=1`;
`pnpm exec tsc --noEmit`, `pnpm build`, `pnpm check:boundaries`, `pnpm check:docs`.
Сначала RED на настоящем HTTP/SQL, затем runtime guard; новый flag не включать
в рабочей среде и не регенерировать frontend types.

Критерии будущей native SQL/HTTP/owned S3 приёмки: граница30 суток, retry после
компактизации/удаления материала без дубля, cleanup↔upload/bind race, lost DELETE
ACK/restart, alive bound bytes, другой аккаунт/revoked session, export без утечки,
окончательная scrub и restore без воскрешения удалённой идентичности. Сейчас
R1 проверен31 native HTTP/SQL/loopback SDK-wire + policy unit cases (3.75 s):
expired pending/ready/status, unbound rollback, disabled legacy replay и live bound
read/edit, точная30-day граница/invalid timestamp. SQL только own backend_test.
Остальные срезы/restore/working storage не приняты этим checkpoint.

Локальная процедура подготовлена. Она не снимает manifest blockers и не разрешает
подключение/миграцию/отправку почты. Native article/email checkpoints уже есть;
здесь не утверждается новая SQL-репетиция или успешный восстановленный backup.

## AG9 — матрица передачи к выпуску, 13 октября 2026

Выбираемые базы: backend runtime `e8ba8fd`/native checkpoint `123c9c6`, Git frontend
`62b24a6`. Они ещё не объединены/не выложены этим поручением. Полный candidate SHA,
image digest, applied schema и enabled flags заполняет владелец выпуска после
разрешённого выбора версии. Приведённое покрытие — прошлые evidence/code review;
свежий результат текущей документационной проверки хранится в active todo.

| ТЗ | Локальный результат / evidence | Нужный следующий результат | Ответственный/условие |
| --- | --- | --- | --- |
| 2.1, участницы/админка | Role/access/grant/block/resend native evidence; AG1 handoff | Единая база, привязка первой почты после schema | Бэкенд/фронтендер/владелец среды, AG5 |
| 4.1, оплата → письмо → вход | Signed settlement/outbox/password native logic | Реальная проверка конкретного provider payment/доставки/login | Владелец провайдера и среды, отдельное разрешение |
| 4.2, повторная оплата | Receipt replay/renewal/password preservation tests | Ordinary checkout intent recovery P2 и внешняя приёмка | Backend contract review AG6 + frontend |
| 4.3, продление/отмена | Pending/confirmed cancellation сохраняет paid expiry | Реальные recurring/cancel и конкретный intent/reload | Провайдер/совместная приёмка |
| 4.4, блокировка | Session revocation/blocked denial native cases | Новый клиент не сохраняет stale доступ | Фронтендер/совместная база |
| 4.5, закрытые материалы | API body gates и default-off post_media proxy | Actual S3 AG2, принятое продолжение AG3/4, отдельный остаток старых URL | Пользователь: S3/решение; старые файлы сейчас не трогать |
| 4.6, публикации | Atomic post/article/teaser, formatting/media references, AR replay | Client intent/status, реальные upload/read и devices | Фронтендер + storage/rollout gates |
| 4.7, карусель | Общая клиентская карусель, native/browser evidence | Реальные фото/поворот физического телефона | Фронтендер/заказчик |
| 4.8, фото комментариев | Encoding/validation/metadata stripping и comments policy | Actual upload/storage/read на совместимой базе | S3 + совместная приёмка |
| 4.9, лайки/сохранённое | Locked validation/access, categories/login isolation evidence | Финальная совместимая версия/данные | Backend/frontend |
| 4.10, сезоны | Moscow/calendar/CAS/settings/fallback evidence | Выбранный calendar mode/реальные даты и зимние материалы | Заказчик/администратор; не придумывать изображения |
| 4.11, VK | Плеер в staging; post inheritance gates | Размещение/наполнение/реальные exported URLs и устройства | Заказчик/фронтендер; AG8 решение для отдельного каталога |
| 4.12, магазин | Подготовка email-client заказа, design сохранён | Реальный контакт/товар и открытие письма на телефоне | Заказчик/фронтендер; inbox не обещан mailto |
| 4.13–4.14 | Мудборды профиля выключены, «скоро», закрытые capabilities | Сохранить состояния общей версии | Фронтендер; новые функции вне этапа |
| 4.15, нагрузка | Локальные оптимизации/evidence | Согласованные N, сценарии, p95/ошибки и выделенное окружение | Владелец среды/команда |
| 4.16, устройства/PWA | Production Chromium/эмуляции в истории | Физические Safari/iPhone, Android, desktop/PWA | Совместная приёмка |
| 2.1, прочие разделы | Главная/feed search/library/quiz/result/profile/support evidence | Общая навигация и сохранность на выбранной версии | Фронтендер/совместная приёмка |

Для нагрузки до запуска заполнить N одновременных участниц, состав операций,
объём медиа/данных, длительность, p95/допустимые ошибки и лимиты тестовой среды.
Новые целевые цифры без заказчика не назначать. Устройственная матрица фиксирует
модель/ОС/браузер/PWA, сценарий, version SHA и результат, а не только ширину viewport.

Инструкция администратору должна покрывать чтение/ручной срок/block/resend,
queued-vs-inbox, первую привязку почты, сезоны и публикацию/восстановление статьи.
Основные контракты/ограничения уже в [handoff](../development/backend-handoff-2026-10-05.md)
и specs; после финального выбора клиентской версии владелец инструкции добавляет
проверенные экранные шаги. Не делать инструкцию по отсутствующему UI.
Перед pilot 5–7 дней/30–50 участниц сохранить матрицу, backup/restore/rollback и
канал диагностики. Сам пилот не запускался и не является нагрузочной проверкой.

Доступная локальная подготовка выполнена. Выпуск остаётся заблокированным S3,
history/retention/новыми контрактами, клиентской интеграцией и внешней приёмкой.
Известные Q1 findings из журнала требуют актуального native audit/triage при
выборе release; здесь зависимости не менялись и текущий audit не заявлен.

Это тестовый запуск, не разрешение на production. Первоначально пользователь
согласовал новую пустую БД без переноса реальных аккаунтов, оплат и ключей
интеграций. Последующее наполнение публичным контентом описано ниже отдельно.

## Локальное обновление зависимости — 11 октября 2026 (не выложено)

Свежий Q1t: остаточные риски подтверждены без изменения зависимостей.
Next tooling braces 3.0.3 compile/expand: 9003-char nested pattern даёт caught
RangeError в bounded owned child; patched release отсутствует. Legacy nested
esbuild 0.18.20 own loopback stdin-only server отдаёт synthetic source с ACAO *
при untrusted Origin; context disposed. No user files/секреты, не browser proof.
Core-utils использует transform, не serve: reachable app exploit не заявляется.
Out-of-range override/patch/suppression не добавлены; registry 2 + manual Q1m/Q1p
остаются. Далее reviewed compatibility или independent C3 checks, gates открыты.
Docs-only, прежние 2251 pass не повторялись без изменений; не пушили/не выложено.

Свежий Q1s: Vitest/internal graph 4.1.11; real own Vite/WebSocket → HTTP
не возвращает synthetic outside/denied source через mock redirect. Два native
disclosure RED → 3 GREEN, allowed redirect сохранён; no secrets/user files.
Eight registry integrities/hooks/selected runtime reviewed, rest graph unchanged.
2251 full default pass / 1053 skips, exit 0 (19.09s); types/format/frozen install
GREEN. Prod audit 0/exit 0 (325 deps); full audit 2 (1 high / 1 moderate),
exit 1 (828 deps): braces + legacy esbuild. Manual Q1m/Q1p blockers сверх count;
Q1/A7/внешние gates открыты. Это native tooling acceptance, не remote-app exploit
или app-browser/clean Linux/deployment proof; не пушили и не выложено.

Свежий Q1r: scoped js-yaml 4.3.2 для ESLint/eslintrc. Empty merge work,
hard sequence size и depth limits: 3 native RED → 4 GREEN, ordinary YAML/
merge/omap/multi-doc/dump preserved. Underscore numbers теперь strings;
alias materialization требует отдельного bounded traversal, не universal sandbox.
Integrity/hooks/selected runtime reviewed, runtime deps unchanged, no 5.x.
2248 full default pass / 1053 skips, exit 0 (20.97s); types/lint/format/frozen
install GREEN, production graph unchanged. Prod audit 0/exit 0 (325 deps);
full audit 4 (1 high / 3 moderate), exit 1 (828 deps): esbuild/Vitest/mocker/
braces плюс manual Q1m/Q1p blockers. Q1/A7/внешние gates открыты; unchanged
builds/SQL/browser не повторялись, не пушили и не выложено.

Свежий Q1q: brace-expansion 1.1.21 только в ESLint/minimatch 3 graph.
Count/product/character cap: 3 native RED → 4 GREEN, вместе с соседними
minimatch checks 7 pass. Ordinary patterns сохранены; pathological patterns
truncate или сохраняют literal remainder, не universal resource sandbox.
Registry integrity/hooks/runtime diff reviewed, deps unchanged; 5.x untouched.
2244 full default pass / 1053 skips, exit 0 (20.88s); types/lint/format/frozen
install GREEN. Prod audit 0/exit 0 (325 dependencies); full audit 8 (4 high /
4 moderate), exit 1 (828 dependencies). Это не отдельное воспроизведение всех
семи прежних parser advisories и не browser/deployment/clean Linux acceptance.
Manual Q1m/Q1p blockers остаются сверх registry count; A7/внешние gates открыты.
Неизменившиеся builds/SQL/browser не повторялись; не пушили и не выложено.

Свежий Q1p: scoped AJV 6.14.0 в ESLint graph; invalid dynamic-pattern
exceptions: 2 native RED → 3 GREEN, ordinary validation сохранена.
2240 full default pass / 1053 skips, exit 0; types/lint/format/frozen install
GREEN, production graph unchanged. Registry integrity/hooks/runtime diff reviewed.
Prod audit 0/exit 0 (325 dependencies); full audit 15 (9 high / 6 moderate),
exit 1 (828 dependencies). Это НЕ устранение default-engine ReDoS: $data:true
synthetic probe на actual 6.14.0 всё ещё 2s timeout в owned bounded child.
Новый regExp engine opt-in, RE2 не добавлен, ESLint $data default false.
Manual AJV blocker + Q1m остаются сверх registry findings; A7/внешние gates
открыты. Не app exploit/SQL/browser/clean Linux proof, не пушили и не выложено.

Свежий Q1o: YAML 2.8.3 для Vite tooling, root exact dev peer сохраняет
существующий optional peer после scoped-only preview removal. Registry
integrity/hooks/runtime diff проверены. Три bounded-child RangeError RED →
4 focused GREEN: все parse API дают YAMLParseError/RESOURCE_EXHAUSTION,
обычные конфигурации и форматирование сохранены. Не depth/CPU/memory limit.
Full default 2237 pass / 1053 skips, exit 0; types/format/frozen install/
legacy Vite build GREEN, существующий Woolen font warning сохранён.
Production graph unchanged; prod audit 0/exit 0 (325 dependencies), full audit
16 (9 high / 7 moderate), exit 1 (828 dependencies). js-yaml/Q1m manual
blocker/A7/внешние gates открыты; не SQL/browser/device/clean Linux proof.
Не пушили и не выложено, рабочая БД и access policy не менялись.

Свежий Q1n: scoped humanfs/node 0.16.8 с related core/types; три registry
integrities проверены, prepare hooks просмотрены и не выполнялись.
Actual temporary-file copy/copyAll: 2 RED → 2 GREEN, symlinks не превращаются
в plain outside-source copies, ordinary copy сохранён. Это НЕ sandbox:
ссылки остаются разрешимыми наружу при последующем dereference.
Owned fixtures удалены после owner/mode проверки без follow symlinks.
Full default 2233 pass / 1053 skips, exit 0; root types/frontend lint/format/
frozen-ignore-scripts install GREEN, production graph unchanged.
Prod audit 0/exit 0 (325 dependencies); full audit 17 (9 high / 8 moderate),
exit 1 (828 dependencies). Q1m manual blocker, tooling/A7/внешние gates открыты.
Не app exploit/SQL/browser/clean Linux proof; не пушили и не выложено.

Свежий Q1m: scoped ESLint minimatch 3.1.2 → 3.1.5; consecutive stars и
non-adjacent globstars: 2 bounded child RED → 3 focused GREEN. Full default
2231 pass / 1053 skips, exit 0; root types/frontend lint/frozen-ignore-scripts
install/formatting GREEN. Production graph unchanged, build не повторялся.
Prod audit 0/exit 0 (325 dependencies); full audit 18 findings (9 high /
9 moderate), exit 1 (827 dependencies). Но nested-extglob probe на actual
3.1.5 всё ещё даёт 2s timeout в owned 64 MB child: registry patched metadata
не является подтверждением исправления. Manual tooling blocker записан в плане;
не app exploit/полная security готовность. Brace-expansion и остальные
tooling/A7/внешние gates открыты. Не пушили и не выложено, рабочая БД не менялась.

Свежий Q1l: scoped picomatch 2.3.1 → 2.3.2 в micromatch tooling graph.
Inherit-class и repeated-extglob findings сняты: 4 actual RED → 5 focused GREEN,
bounded child timeout/heap/output cap, ordinary globs/exclusions сохранены.
Reviewed upstream semantics/integrity/hooks; production graph unchanged.
Full default 2228 pass / 1053 opt-in skips, exit 0; root types/frontend lint/
Next webpack build/frozen-ignore-scripts install GREEN на текущем macOS tree.
Prod audit 0/exit 0 (325 dependencies); full audit 21 findings, 12 high /
9 moderate, exit 1 (827 dependencies). Не app exploit или SQL/browser/device/
clean Linux proof; A7/migrations/provider/media/rollout и tooling triage открыты.
Не пушили, не выложено, рабочая БД и access policy не менялись.

Свежий Q1k: scoped flatted 3.3.3 → 3.4.4 в ESLint/flat-cache; два high
tooling findings сняты. Четыре bounded child RED → 5 focused GREEN без mutation
global prototypes. Full default 2223 pass / 1053 opt-in skips, exit 0;
root types/formatting/frozen-ignore-scripts install GREEN. Actual frontend
ESLint cold/warm cache: 390 entries, одинаковый hash, обе проверки exit 0;
own disposable cache удалён после owner/mode/file/contents/hash проверки.
Production graph сохранён, включая React compiler types 7.28.5 (scoped pin
после generated preview drift); Next/backend build не повторялись.
Prod audit 0 findings/exit 0 (325 dependencies); full audit 23 findings,
13 high / 10 moderate, exit 1 (827 dependencies). Остальные tooling/A7/
migrations/provider/media/device/rollout открыты. Не пушили и не выложено.

Свежий Q1j: Babel core → 7.29.6 и reviewed related Babel graph по
[advisory владельца](https://github.com/babel/babel/security/advisories/GHSA-4x5r-pxfx-6jf8).
Два synthetic outside-package map disclosure RED → 12 focused GREEN; actual
styled-jsx transform сохраняет scoped classes/CSS. Full default 2218 pass /
1053 opt-in skips, exit 0; root types/Next build/frontend lint/legacy Vite build/
formatting/frozen-ignore-scripts install GREEN на текущем macOS tree. Legacy
font warning сохранён; clean Linux/SQL/browser не проверялись этим срезом.
Все 16 новых Babel registry integrities совпали, install/prepare hooks нет.
Prod audit 0 findings, exit 0 (325 dependencies), но полный tooling audit
25 findings, 15 high / 10 moderate, exit 1 (827 dependencies). Это не полная
security готовность: tooling triage/A7/migrations/provider/media/device/rollout
открыты. App не компилирует пользовательский JS; exploit не заявляется.
Не пушили и не выложено; working DB/roles/CORS/proxy trust не менялись.

Свежий Q1i: workspace tRPC server/client/react-query → aligned 11.8.0 по
[релизу владельца](https://github.com/trpc/trpc/releases/tag/v11.8.0).
Два disposable child pollution RED → 27 focused upstream/compiled/native HTTP
GREEN; experimental caller в app не используется. Full default 2215 pass /
1053 opt-in skips, exit 0; root types/backend/Next/legacy Vite builds/API/
boundaries/formatting/frozen-ignore-scripts install проходят. Legacy standalone
build предупреждает о runtime font resolution — это не проверка asset deployment.
Prod audit 1 low, 0 moderate/high/critical, exit 1: Babel ещё открыт; не полная
security готовность. Clean Linux/browser/SQL/provider/migrations/rollout ещё
открыты. Excluded Expo не менялся. Не пушили и не выложено.

Свежий Q1h: Browserslist 4.28.1 → 4.28.7 по
[релизу владельца](https://github.com/browserslist/browserslist/releases/tag/4.28.7),
с related datasets и заменой baseline 2.9.8 на existing 2.11.27.
Три bounded custom-stats crash RED → 4 focused GREEN; full default 2212 pass /
1053 opt-in skips, exit 0; root types/frontend production build/formatting и
frozen-ignore-scripts install проходят. Prod audit 2 (0 critical / 1 high /
0 moderate / 1 low), exit 1, не clean: tRPC/Babel ещё открыты. Cache OOM/CLI/
filesystem autodiscovery не тестировались; build policy не менялась.
SQL/provider/device/migrations/rollout ещё открыты. Не выложено.

Свежий Q1g: body-parser 1.20.4 → 1.20.6 по
[changelog владельца](https://raw.githubusercontent.com/expressjs/body-parser/1.20.6/HISTORY.md),
parent qs override сохраняет 6.16.0. Восемь invalid-limit construction RED →
87 focused native HTTP/dependency pass; текущие valid app limits не менялись.
Full default 2208 pass / 1053 opt-in skips, exit 0; root types/backend build/
formatting/frozen-ignore-scripts install проходят. Prod audit 5 (0 critical /
3 high / 1 moderate / 1 low), exit 1, не clean. Это не подтверждение app exploit
или SQL/provider приёмки; migrations/rollout ещё открыты. Не выложено.

Свежий Q1f: sharp root/backend/Next → 0.35.5 по
[advisory владельца](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).
Actual macOS librsvg 2.63.2, libvips 8.18.7; прежний API SVG block сохранён.
81 focused pass до/после, full default 2200 pass / 1053 opt-in skips, exit 0;
types/backend + frontend production build/frozen-ignore-scripts install проходят.
Prod audit 6 (0 critical / 3 high / 1 moderate / 2 low), exit 1, не clean.
Не воспроизводили glibc Linux RCE: Mac проверки не заменяют clean Linux install,
actual runtime versions (включая global libvips) и native upload/Next image smoke
при rollout. Migrations/внешняя приёмка открыты; не пушили и не выложено.

Свежий Q1e: qs 6.14.0 → existing 6.16.0 по
[changelog владельца](https://raw.githubusercontent.com/ljharb/qs/v6.16.0/CHANGELOG.md).
Три bounded upstream RED → 79 dependency/request-body/native Nest/webhook HTTP
GREEN; подписи/отказы сохранены, SQL/provider приёмка не подменяется.
Full default 2200 pass / 1053 opt-in skips, exit 0; types/backend build/frozen
ignore-scripts install проходят. Prod audit теперь 7 (0 critical / 4 high /
1 moderate / 2 low), exit 1, не clean. Parser/auth/trust/CORS/quota policy
не менялась. Остальные findings, migrations и rollout ещё открыты; не выложено.

Свежий Q1d: source-map-js 1.2.1 → 1.2.2 по
[релизу владельца](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2).
Четыре unsafe indexed-map offsets отвергаются до serialization, ordinary mapping
сохранён: 5 focused pass. Full default 2196 pass / 1053 opt-in skips, exit 0;
root types/frontend build/frozen-ignore-scripts install проходят. Prod audit
теперь 11 (0 critical / 4 high / 4 moderate / 3 low), exit 1, не clean.
Это build graph hardening, не app exploit proof или rollout; не выложено.

Свежий Q1c: Axios root/backend закреплён на 1.20.0 с reviewed transport graph
по [релизу владельца](https://github.com/axios/axios/releases/tag/v1.20.0).
Bounded fetch-limit RED → GREEN; настоящий legacy SDK → loopback HTTP
сохраняет три POST контракта и отказ 502; cookie/session вместе 13 pass.
Full default: 2191 pass / 1053 opt-in skips, exit 0 (17.88s); types/build/
formatting/frozen-ignore-scripts install проходят. Prod audit теперь 12 findings
(0 critical / 5 high / 4 moderate / 3 low), exit 1, не clean. Нет изменений
inbound trust/CORS/auth/квот. Outbound proxy parser изменён upstream; реальная
proxy конфигурация, external OAuth и clean Linux install требуют отдельной
приёмки при rollout. SQL/provider/browser приёмка этим не заменяется; не выложено.

Предыдущий локальный срез: path-to-regexp 0.1.12 → 0.1.13, без смены Express
или маршрутов. [Advisory владельца](https://github.com/pillarjs/path-to-regexp/security/advisories/GHSA-37ch-88jc-xwx2)
проверен на bounded child fixture: timeout RED → false GREEN; 32 focused
dependency/native HTTP/security pass. Root types/backend build/frozen install
проходят. Audit теперь 49 findings (0 critical / 19 high / 26 moderate / 4 low),
не чистый. Первый full run дал 8 subprocess timeouts, focused serial = 85 pass,
но full serial повторил один timeout. pmset log подтверждает 300-second
Maintenance Sleep внутри обоих full runs: гипотеза одного лишь параллелизма
недостаточна. Для проверки используется scoped caffeinate только на время теста,
без повышения timeout, изменения CI или постоянных настроек питания.
Protected serial full run: 2188 pass / 1053 skips, exit 0 за 77.73s.
Default parallelism под тем же scoped assertion: 2188 pass / 1053 skips,
exit 0 за 17.34s. Own test process завершён, временное sleep assertion снято.
Готовность Linux rollout этим не подтверждается.

На feature/stage-one-completion-2026-10-10 точечно обновлён proxy-addr 2.0.7 →
2.0.8 через override и сгенерированный pnpm lockfile. Проверены
[исправление владельца](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h)
и [релиз](https://github.com/jshttp/proxy-addr/releases/tag/v2.0.8).
Приложение продолжает доверять только loopback; proxy trust, роли и квоты
не менялись. Два dependency RED до обновления, 20 focused GREEN после, включая
настоящие HTTP проверки квот/forged forwarded headers. Default suite: 2187 pass,
1053 opt-in skips; types/backend build/lint проходят. Native production audit
теперь 50 findings: 0 critical, 20 high, 26 moderate, 4 low (не чистый audit).
Прежние снимки ниже описывают прошлые выпуски, не обновлённый сервер.
Frozen/ignore-scripts install проверен локально; перед отдельным rollout нужны
Linux image rehearsal и release gates. Здесь нет push/deploy/миграций/смены БД.

## Устройство и ограничения

- Приложение: staging `12cfc8dd76e801809828e2ef8af4bdcc8577019f`.
- Хост: `teamassist-dev`, каталог `/home/edem/apps/daryadarcy-staging`.
- Собственный Compose-проект `daryadarcy-staging`: Next.js, Nest API, MySQL 8.4
  и небольшой входной nginx.
- Конфигурация: [Dockerfile](../../infrastructure/deploy/teamassist/Dockerfile)
  и [compose.yaml](../../infrastructure/deploy/teamassist/compose.yaml).
- Снаружи только HTTPS через nginx хоста. Единственный опубликованный порт
  входного nginx — `127.0.0.1:3050`. У web/API/MySQL нет опубликованных портов;
  Docker-сеть `internal: true` блокирует их исходящие соединения. Edge также
  подключён к собственной ingress-сети. Другие проекты сервера не изменяются.
- Контейнеры API/web работают не от root, с ограничениями памяти/CPU и логов.
- `api.env`, `mysql.env`, `.env` находятся только в закрытом каталоге стенда,
  права `600`. Секреты генерируются отдельно от образа. Не копировать `.env`
  production, SSH-ключи или Git-токены в исходники/образ/URL.
  `AUTH_LINK_ENCRYPTION_KEY` — canonical base64 от 32 случайных байтов,
  не hex; `JWT_SECRET` — отдельная случайная строка.
- Нет SMTP/Prodamus/S3/OAuth/SMS-ключей. Работники запускаются штатно, но
  обслуживают только эту тестовую БД. Загрузка файлов и доставка писем требуют
  отдельного тестового провайдера; они не считаются проверенными.
- Платёжные URL явно указывают `https://payments-disabled.invalid`, а nginx
  возвращает 503 для Prodamus/pay/club.createCheckout (включая tRPC batch).
  Одних пустых ключей недостаточно: развёрнутый URL-builder имеет live defaults.
  Локальный checkout теперь проверяет настройки до создания заказа, а callbacks
  используют `PUBLIC_APP_URL`; это не означает, что правки уже развёрнуты.
  Разбор и условия включения — в [проверке checkout](../audits/billing-identity.md#проверка-checkout-06102026).
- Тестовые администраторы автоматически не создаются. Начальная БД без аккаунтов.
- Контактные ссылки интерфейса остаются исходными: нажатие mailto пользователем
  может открыть его почтовый клиент. Это не серверная отправка тестового письма.

## Повторная сборка и проверка

Собирать Linux/amd64 из `git archive` согласованного коммита. Предпочтительно
локально; если это невозможно, отдельным серверным builder с лимитом 1 ГБ RAM
и 0,6 CPU. Удалять только этот builder после экспорта образа. Рабочее
дерево с локальными секретами не является контекстом сборки. Базовые образы
закреплены digest; pnpm 9.12.0 использует lockfile и `--ignore-scripts`.
Проверять отсутствие dev-зависимостей в финальном образе. Настройка API-прокси
в Next не меняется: входной nginx направляет `/api/` на API во внутренней сети.

Начальную SQL-схему генерировать из канонического
[schema.ts](../../packages/database/src/schema.ts) в отдельный временный каталог
через `drizzle-kit generate --dialect mysql --schema ... --out ...`.
Перед передачей SQL в mysql CLI удалить разделители `--> statement-breakpoint`
(или выполнять отдельные statements через драйвер), не меняя DDL.
Применять **только** к новой БД после проверки отсутствия таблиц. Не применять
этот baseline к существующим данным и не создавать фиктивную историю миграций.
Проблема journal для 0017–0019 остаётся production-блокером.

Начальная схема содержит 28 таблиц; baseline SQL SHA-256:
`0483dfba042da6772832daddd0e98a486ff1565023d08bb7dbad41a458c49914`.
Проверка перед созданием: 0 таблиц. MySQL CLI не принимает Drizzle-разделители;
первый импорт остановился после одной пустой таблицы. После проверки этого
частичного состояния остальные statements применены без DROP/сброса данных.
Финальная проверка: 28 таблиц, 0 пользователей, 0 платежей. Это не rehearsal
миграции существующей базы и не исправление журнала миграций.

После запуска выполнять без мутаций:

```sh
STAGING_SMOKE_URL=https://daryadarcy.dev.reeskeen.ru node tooling/operations/smoke-staging.mjs
```

Проверка покрывает HTML, гостевую сессию, конфигурацию с реальным SQL, каталог,
отказ доступа к административным ручкам и выключенные возможности. Она не
подтверждает вход администратора, оплату, SMTP/S3 или все сценарии браузера.

После отдельно согласованного подключения Prodamus TEST использовать явный режим:

```sh
STAGING_SMOKE_PAYMENTS=prodamus-test STAGING_SMOKE_URL=https://daryadarcy.dev.reeskeen.ru node tooling/operations/smoke-staging.mjs
```

Без переменной режим остаётся `closed`: открытый TEST путь считается неожиданным
изменением, а не автоматически принятой оплатой. В `prodamus-test` проверяются
отказ GET на двух POST-путях, отказ неподписанному `{}` уведомлению и ошибка
валидации `{}` checkout без создания заказа. Валидные данные покупки, подписи,
почта и cookie не передаются; запросов к Prodamus и новых писем нет. Боевой
callback и browser return должны оставаться закрытыми (503), shop checkout —
отказывать гостю (401), при shopOnlinePayment=false в конфигурации. Успешный
smoke подтверждает только доступность/защитные отказы: фактическая оплата,
выдача доступа, способы оплаты и автопродление требуют отдельной приёмки.

## Проверка зависимостей 2026-10-06

Повторная проверка 2026-10-07: 1 critical, 20 high, 26 moderate, 4 low.
Условия таблицы ниже сохраняются; дополнительный high — sharp 0.35.4 / librsvg
([advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w)).
Загрузка фото в API проверяет сигнатуры JPEG/PNG/WebP до декодирования и отвергает
SVG. У Next установленного поколения SVG отвергается до оптимизации при
dangerouslyAllowSVG=false (текущая конфигурация). Сборка обрабатывает только
доверенные файлы коммита. Это ограниченное исключение для изолированного теста,
не разрешение принимать SVG или выпускать production; обновление sharp отдельно
перепроверить до 2026-10-13. Версии зависимостей этим изменением не обновлялись.

`pnpm audit --prod --json`: 1 critical, 19 high, 26 moderate, 4 low.
Предупреждения не скрыты и версии не обновлялись этим деплоем. Для точного
тестового запуска проверены условия high/critical; повторный обзор до 2026-10-13
и обязательно перед сменой маршрутизации, интеграций или сборочных входов:

| Группа | Почему опасный сценарий не используется в этом стенде |
| --- | --- |
| proxy-addr 2.0.7, critical | Приложение доверяет только `loopback`; некорректных IPv4-mapped IPv6 подсетей нет. [Условия advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h). |
| tRPC 11.7.2 | Используется Express HTTP adapter, не `experimental_caller`/`experimental_nextAppDirCaller`. [Advisory](https://github.com/trpc/trpc/security/advisories/GHSA-43p4-m455-4f4j). |
| path-to-regexp 0.1.12 | Нет маршрутов с тремя параметрами в одном сегменте; нативный Nest adapter использует Express 5. [Advisory](https://github.com/pillarjs/path-to-regexp/security/advisories/GHSA-37ch-88jc-xwx2). |
| Axios / form-data | Единственный клиент Axios — legacy SDK; методы внешнего OAuth не вызываются HTTP-композицией. Сетевой egress дополнительно закрыт. Не разрешение на включение OAuth. |
| Browserslist | Сборка использует только доверенные файлы коммита, без пользовательских запросов/статистики. Нет API custom stats. |
| source-map-js | SCSS/source maps создаются из файлов коммита; пользовательские source maps не принимаются. Не разрешение на сборку недоверенного исходного кода. |

Обновления зависимостей и оставшиеся moderate/low нужно вести отдельными
проверяемыми изменениями. Этот вывод ограничен указанной конфигурацией теста.

### 2026-10-08 — дополнительная защита декодера API, пока только локально

Свежий native `pnpm@9.12.0 audit --prod --json` на текущем lockfile снова даёт
**51 advisory: 1 critical / 20 high / 26 moderate / 4 low** (322 зависимости).
Код выхода 1 означает найденные предупреждения, а не успешный security gate.
Менеджер/lockfile/CI согласованы; установка остаётся frozen и без scripts.
Версии, overrides и lockfile не менялись. Старая таблица условий выше не является
разрешением production или подтверждением текущей цепочки proxy на сервере.

В локальной ветке API дополнительно блокирует семейство нативных SVG-loader
операций Sharp при загрузке существующего модуля фото —
[workaround разработчика Sharp](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).
Это второй барьер после проверки сигнатуры, не замена ей. Все существующие
avatar/admin/comment загрузки по-прежнему принимают настоящие JPEG/PNG/WebP и
перекодируют в WebP; SVG не является поддерживаемым форматом приложения.
Тест настоящего SVG-декодера сначала падал, затем прошёл; три raster-сценария
проверяют все три пути загрузки с настоящим Sharp и подменой только хранилища.

Изменение не выложено и **не защищает отдельный процесс Next или утилиты
обработки файлов**. Для них сохраняются ограничения входов и отдельное обновление
Sharp с проверкой Linux-образа. Уязвимая версия остаётся в audit, поэтому review
до 2026-10-13 и перед rollout обязателен. Не проверялась эксплуатация RCE;
подтверждён именно отказ безопасному SVG и сохранение raster-совместимости.
Авторизация, квоты, proxy/CORS, SMTP, база и работающий стенд не менялись.

## Демо Prodamus — локальный диагностический контур 2026-10-08

**Не развёрнут.** Выкладка основного API и изменение общих настроек кабинета
не являются частью проверенного результата. На сервере read-only проверкой
подтверждены API `300c8d3`, web `62c4001`, шесть здоровых сервисов; Prodamus
остаётся закрыт входным nginx. Само добавление переменных ничего не подключит.
Свежий публичный HEAD диагностического URL также возвращает 503.
Пользователь выбрал отдельный диагностический сервис без БД/SMTP. Его отдельная
Nest-композиция проверена локально; точный rollout/rollback ещё не выполнен.

Локальный контракт:

- `POST /api/prodamus/sandbox/webhook`: исходные JSON/PHP-form байты до 64 KiB,
  заголовок `Sign`, без query, cookies и browser Origin. Существующая политика
  Origin не ослаблена; внешний серверный callback нужно проверить отдельно.
- Отдельные переменные `PRODAMUS_SANDBOX_*` из [.env.example](../../.env.example),
  только literal `PRODAMUS_SANDBOX_ENABLED=true`. Никакого fallback к боевым ключам.
  `PUBLIC_APP_URL` строго dev-origin; магазин строго `https://testpage1.payform.ru`.
  Ключ — в закрытом secret store, не в Git/образе. `SYS` подтвердить у провайдера.
- Один явно настроенный `dd-demo-<v4 UUID>`, 790 RUB, резервный вымышленный адрес
  `prodamus-demo@example.test`, без телефона, подписки и сохранения карты.
  Не заменять эти данные реальными контактами в тестовой форме.
- Проверяются подпись (обычная/с `demo` только здесь), demo=1, магазин, заказ,
  положительный provider ID, сумма, валюта и вымышленный контакт. Любая подписка,
  автосписание/API-init и неподходящие данные отклоняются. Browser return никогда
  не подтверждает оплату: оба возврата ведут на `/club` без `paid=1`.
- 200 с `mode=demo`, `accessGranted=false`, `notificationVerified=true` —
  диагностическое подтверждение проверки, **не** транзакционная квитанция,
  оплата или доступ. Повторы не пишут SQL, не меняют подписки и не ставят письма.
  Боевой webhook по-прежнему отвергает демо-уведомления.

Операторская генерация ссылки (Node 22, из корня репозитория с установленными
зафиксированными зависимостями; `.env` автоматически не читается):

```sh
node --env-file=/absolute/path/to/closed/prodamus-sandbox.env --import tsx tooling/scripts/prodamus-sandbox-link.ts
```

Команда не принимает email/merchant/amount через аргументы. Она только печатает
демо-ссылку, не обращается к провайдеру. Ссылку не публиковать; ключ никогда не
передавать в аргументах, логах или переписке. Нельзя считать локальный запуск
с вымышленным ключом тестом реальной доставки. Перед внешним тестом согласовать
его финальное действие и условия формы; настоящие карты/оплаты не использовать.

Проверка кода: 81 новый service/native/CLI/compiled сценарий, full 1580 pass /
618 SQL/external skip, типы/API/build/boundaries проходят. Compiled ESM HTTP
тест ломается при удалении регистрации ручки и проходит после восстановления.
Свежий production audit: 51 finding, включая 1 critical/20 high. Условия старой
таблицы не дают разрешения на новую публичную маршрутизацию; диагностический
путь не использует Axios/media/нестандартные tRPC callers, но точный контейнер
и серверную proxy-цепочку нужно проверить перед rollout. Ключи, данные, overlays,
действующий стенд, frontend и настройки кабинета этим этапом не изменялись.

### Отдельный диагностический процесс — локальная проверка

Сборка: `pnpm build:prodamus-sandbox`, результат `dist/prodamus-sandbox.mjs`
(17.3 kB). Отдельный вход не импортирует основной AppModule, SQL, авторизацию,
почтовые задачи или внешние платёжные клиенты. Он проверяет конфигурацию до
открытия порта 3000; выключенный/неполный контур завершится с кодом 1 и общей
ошибкой без содержимого окружения. SIGINT/SIGTERM закрывают Nest штатно.
Единственный прикладной обработчик — точный диагностический POST. Общая HTTP
политика OPTIONS сохранена; внешнее исключение edge должно разрешать только
этот точный POST. Доверие к proxy, Origin/CORS и квоты не менялись.

19 дополнительных native/startup/compiled случаев; полная проверка — 1599 pass /
618 SQL/external skip. Снятие точной проверки пути даёт два воспроизводимых
200 вместо 404 (регистр и завершающий slash). Сборка ESM проверяет отсутствие
эффектных модулей/импортов и реальный ответ с `accessGranted=false` без cookies.
Нет проверки транзакций базы или фактической доставки от Prodamus.

Повторная read-only проверка сервера: прежние шесть сервисов healthy. Проба
разрешения пакетов внутри текущего API-образа сообщает, что Nest и reflect-metadata
недоступны. Нельзя считать этот образ подходящим для новой сборки с внешними
пакетами. Перед выкладкой нужен отдельный точный runtime с проверкой зависимостей,
закрытым окружением, изолированной сетью без SQL/SMTP/egress и откатом edge.
Текущий аудит всё ещё 51 (1 critical/20 high); широкого исключения для выкладки нет.

Дополнительно [официальная инструкция](https://help.prodamus.ru/payform/integracii/rest-api/instrukcii-dlya-samostoyatelnaya-integracii-servisov)
требует согласовать `SYS` с поддержкой; `urlNotification` учитывается вместе с
этим параметром. Значение из наших тестовых fixtures не является согласованным
кодом. Это требование к адресу в ссылке, а не доказательство невозможности
настроить уведомления через кабинет. Этот путь нужно проверить отдельно.
Для рекуррентов дополнительно проверить цену, период и уведомления выбранной
тестовой подписки. Код
сервиса готов для дальнейшего rollout review, но реальная оплата/доступ не включены.

Уточнение владения 8 октября: пользователь подтвердил, что магазин выдан для
DaryaDarcy. Наличие готовых подписок и адресов других сервисов не доказывает
«чужой» магазин. Read-only проверка настроек показывает демо-режим, поле ключа
интеграции и отсутствие запрета демо-уведомлений по URL. Текущий адрес уведомлений
не ведёт в DaryaDarcy; это настройка подключения, которую нужно согласованно
заменить, а не блокер владения. Ключ не записан в документы; настройки и сервер
этой проверкой не менялись. Более свежая read-only проверка сервера подтверждает
API/web `1f67d5b` и шесть healthy сервисов; ранняя проверка доступности пакетов
выше относится к старому API-образу и не характеризует текущий runtime.

## Остановка и откат

Работать только в `/home/edem/apps/daryadarcy-staging`:

```sh
docker compose stop api web
docker compose ps
```

Это останавливает приложение, сохраняя БД/резервные копии. Для следующего
обновления сохранить предыдущий тег образа и сделать защищённую копию БД.
Вернуть предыдущий `STAGING_IMAGE` в `.env`, затем `docker compose up -d api web`.
При несовместимой схеме откат образа недостаточен: требуется проверенное
восстановление БД. Первый запуск пока не имеет предыдущего релиза.
Не использовать `down -v`, глобальный prune или удаление чужих контейнеров.

## Что не закрыто этим деплоем

Три ранее найденных падения браузерного прогона (два закрытия фильтра и один
сценарий карусели), история миграций, production-провайдеры и приватное хранение
файлов остаются открыты. Исходники/типы/тесты фронтенда не менялись.

В этом Docker-стенде API видит IP внутреннего прокси, так как приложение
доверяет только loopback. Лимиты по IP могут разделяться тестерами. Для
production требуется отдельная согласованная настройка доверенной proxy-цепочки;
не включать `trust proxy=true` и не брать клиентский IP из сырого заголовка.

## Проверенный результат 2026-10-06

- Адрес: [daryadarcy.dev.reeskeen.ru](https://daryadarcy.dev.reeskeen.ru).
- Серверный artifact ID:
  `sha256:c08e021f95ae6c57fd5594dfcce0925f0298e2f131e052ff4813aba011ed5748`.
- Linux/amd64 build и проверка production-only зависимостей прошли;
  `sharp`/`file-type` обрабатывают настоящий PNG, env-файлов в образе нет.
- Все четыре контейнера healthy. Восемь HTTP-проверок проходят по HTTPS;
  главная открыта в браузере. HTTP перенаправляется на HTTPS.
- Backup действительно создан и распакован: 28 таблиц. В БД по-прежнему
  0 пользователей и платежей. Исходящий TCP из API заблокирован.
- Контейнеры потребляли около 340 МБ RAM суммарно, на хосте оставалось
  около 1,3 ГБ доступной RAM и 4,7 ГБ диска. Это снимок, не мониторинг/SLA.
- Остальные проекты сохранили uptime/health. Временный серверный builder с
  его кэшем удалён; повторная сборка возможна из сохранённого исходного архива.

На Mac закончился диск во время первоначальной сборки, локальный Docker стал
недоступен. Временная копия исходников/генерированных env-файлов удалена;
доступны только серверные конфигурации с правами 600. Неудачный **локальный**
образ с таким же тегом не является проверенным серверным artifact и не должен
публиковаться. Его и только кэш этой сборки нужно удалить после восстановления
Docker; чужие контейнеры/тома и Docker data reset не разрешены этим заданием.

## Публичный контент: импорт 2026-10-06

Пользователь отдельно согласовал перенос всей публичной ленты и каталога видео
из исходного сайта. Приватный клуб, аккаунты, оплаты, реакции и комментарии
не выгружались. Это не перенос production-базы.

- Источник: анонимные GET `feed.list`, `videos.list`, `feed.tags` исходного сайта.
- Записано: 742 поста, 4431 ссылка на фото, 60 YouTube-записей, 17 категорий.
- Только `posts`, `videos`, `tags`; перед импортом все три таблицы были пустыми.
  Исходные ID, порядок и даты сохранены; сверка всех полей с snapshot прошла.
- Фото не копировались: используются существующие публичные ссылки S3.
  У всех 60 видео `videoUrl = NULL`; это каталог YouTube, не локальные MP4.
  Каталог сам по себе не обеспечивает воспроизведение: текущий компонент
  `YouTubeEmbed` фактически использует `<video src="/api/yt/:id">`, а не iframe.
- Два существующих тестовых аккаунта сохранены без изменений, платежей осталось
  0, статей — 0. Оплата по-прежнему заблокирована. Образы приложений,
  фронтенд, SMTP и production при импорте не изменялись.
- Backup до записи: закрытый серверный каталог
  `/home/edem/apps/daryadarcy-staging/public-content-ryfLT8`, файл
  `before-public-content.sql.gz`, права 600. Проверка gzip прошла; snapshot и
  результат сверки сохранены там же, вне Git. Это проверка целостности архива,
  не rehearsal полного восстановления этой копии.
- Импорт выполнен одной транзакцией. На отдельной временной MySQL проверены
  откат при ошибке в последней таблице, даты UTC, ID, продолжение AUTO_INCREMENT,
  сохранение синтетического аккаунта и отказ повторного импорта. Эта временная
  база/контейнер/сеть удалены; рабочие данные стенда не очищались.
- Повторный запуск на стенде действительно отказался от записи; итоговое
  состояние осталось неизменным. При новых данных не очищать таблицы ради
  повторного запуска — согласовать отдельную процедуру синхронизации.
- Проверены публичные API: количество записей и фото, две страницы ленты без
  пересечений, фильтр категории, отдельный пост и видео. Три фото и одна обложка
  отвечают HTTP 200 с типом image. Лента с фотографиями и каталог видео
  отображаются в браузере; это выборочная проверка медиа, не всех 4431 URL.
- Отдельный открытый блокер: встроенное воспроизведение первого видео выдаёт
  ошибку, HEAD `/api/yt/:id` — 502. В API-образе отсутствует `yt-dlp`, путь не
  задан; API-сеть также изолирована от YouTube. Ради наполнения каталога
  сетевую защиту не отключали и downloader не устанавливали. Для воспроизведения
  нужен отдельно согласованный видеобэкенд/хранилище или изменение плеера
  фронтендером; текст интерфейса «без VPN» этим запуском не подтверждён.
- Восемь проверок гостевого доступа/SQL/запрета оплаты прошли. TypeScript и
  локальный набор без MySQL: 551 тест прошёл, 4 пропущены. Отдельные 27 тестов
  импортёра входят в этот набор; полный прежний MySQL-набор не запускался.

Сценарий и ограничения: [инструкция инструментов](../../tooling/README.md).

## Совместный выпуск фронта и бэка — 2026-10-07

- Оба приложения обновлены до `daryadarcy-staging:5c4a9cc`, исходный коммит
  `5c4a9ccbcea19808dc1f011a81bbdd02ed4bf860`. Artifact ID:
  `sha256:79d4cab575b2a7132b45740165ee30bc38bbbc9894f4f511e5bf24f1bb718b26`.
  Образ собран на Linux/amd64 из git archive; label совпадает с коммитом.
- В обоих редакторах сохранены неподтверждённые фото/видео и блокируется
  частичное сохранение до явного отказа от выбранных файлов. Закрытие не
  сбрасывает защиту при неизвестном результате записи поста. Просмотрщик фото
  больше не возвращает запоздало старый кадр. Полный reload-safe F5.1 не закрыт.
- Перед выпуском: 701 non-MySQL тест / 4 пропуска; verify 241; браузер 232 /
  3 пропуска сценариев отдельного development API; дополнительно 30 повторных
  браузерных проверок перелистывания/редактора. На отдельной MySQL: B2 — 10,
  content/Nest/идемпотентность — 87, manual-publication/B7 — 52, всего 149 pass.
  Типы, lint, обе сборки, API, границы и документация проходят.
- Runtime проверен отдельным контейнером без сети: UID 1000, Next 16.3.8,
  sharp/file-type успешно обрабатывают настоящий PNG; vitest и env-файлов нет.
- Менялись только теги api/web в существующих `.env`/`compose.override.yaml`.
  `api.env`, SMTP-прокси, изоляция API, блокировка оплаты, база и тома сохранены.
  Миграции и baseline не запускались: нужные таблицы уже существовали.
  После переключения nginx перечитал DNS; все пять контейнеров healthy.
- Восемь HTTPS smoke-проверок прошли, публичная лента с фото открыта в браузере.
  В БД сохранены 742 поста, 2 тестовых пользователя, 0 оплат. Остальные проекты
  не перезапускались и сохранили health/uptime. Настоящая оплата, SMTP-доставка,
  S3-загрузка и авторизованное редактирование на стенде этим smoke не проверены.
- До переключения сохранены `.env`, `compose.yaml`, `compose.override.yaml` и
  `before.sql.gz` в закрытом каталоге
  `/home/edem/apps/daryadarcy-staging/frontend-release-crj4Fd`. Права каталога
  700, конфигураций/дампа 600; gzip, 28 CREATE TABLE и завершающая строка dump
  проверены. Полное восстановление именно этой копии не репетировалось.
- Для отката приложения вернуть только прежние теги: web через STAGING_IMAGE
  `daryadarcy-staging:12cfc8d`, api через override
  `daryadarcy-staging:10df307-password-link`; затем обновить только api/web и
  перечитать nginx, повторить smoke. Не заменять SMTP-настройки старой копией
  без проверки и не восстанавливать/очищать БД ради отката образов.
- Временная MySQL с синтетическими данными, её том и ограниченный buildx builder
  с кэшем удалены; новый образ, исходный архив-контекст и backup сохранены.
  На Mac удалён только генерируемый Next cache после ENOSPC; полный браузерный
  повтор прошёл. Свободного места на Mac всё ещё мало.
- Это тестовый выпуск, не разрешение production. Ограничения зависимостей
  выше, метаданные новых видео, конкурирующие правки и воспроизведение каталога
  YouTube остаются отдельными задачами. Коммит не отправлялся в удалённый Git,
  ветка staging этим выпуском не менялась.

## Изолированный видеосервис — 2026-10-07

Блокер воспроизведения, описанный выше, устранён отдельным сервисом, а не
открытием доступа основного API в интернет. Фронтенд не менялся.

- Worker: `daryadarcy-video:2026-10-07-v1`, immutable image ID
  `sha256:48ace7739325369fb93a874681d5b07ea4964d1c7680196e5b0467f5b9866b16`.
  Официальный yt-dlp 2026.08.19 проверен по SHA-256, Node base закреплён digest,
  FFmpeg 7:5.1.9-0+deb12u1 установлен из подписанного Debian-репозитория.
- Обновлены только новый `video` и конфигурация `edge`. API/web остаются на
  `5c4a9cc`; MySQL и SMTP-прокси не перезапускались. Все шесть контейнеров healthy.
  Миграций, записей в SQL, отправки писем и вызовов платёжного провайдера не было.
- Worker без npm-зависимостей, секретов, опубликованных портов и томов приложения.
  Основная сеть API по-прежнему internal. Worker получает каталог через edge
  в отдельной internal-сети `video-control`; только worker подключён к egress.
  Разрешены только текущие опубликованные ID из каталога; каталог проверяется
  повторно после подготовки. Неизвестные ID — 404, ошибка каталога — fail closed.
- Ограничения: один процесс подготовки, 16 HTTP-запросов, 150 секунд подготовки,
  170 секунд HTTP, 720p, до 45 минут и 112 МиБ готового файла. Готовый кеш до
  128 МиБ/30 минут; общий cache tmpfs 384 МиБ включает промежуточные дорожки,
  `/tmp` 96 МиБ, память 640 МиБ, 0.75 CPU, 128 PID. `/tmp` executable только для
  распаковки standalone downloader, cache noexec. Снимок памяти idle: 129 МиБ.
  Очистка/отмена, leases, лимиты, Range и повторная проверка публикации покрыты
  37 native-тестами. Полный non-MySQL прогон: 716 pass / 4 skip; SQL не менялся.
- Реальная подготовка первого ролика: 96 197 089 байт, H.264 + AAC, 1280×720,
  926.383311 секунды. FFmpeg объединяет без перекодирования, ffprobe проверяет
  обе дорожки. Отдельный полный preflight занял 21.473 секунды; первый холодный
  HTTPS-запрос на стенде — 9.643 секунды. Это замеры, не обещание для других видео.
- HTTPS: начальный и конечный byte range — 206, корректные Content-Range и MP4;
  обложка — 200/image/jpeg; неизвестный ID — 404; launch-config — 200.
  `/api/prodamus/test`, `/api/pay/test`, `/api/trpc/club.createCheckout` — 503.
- Браузер: реальный ролик начал воспроизводиться; после перемотки на 463.19
  секунды продолжил до 478.44 с readyState 4 и без ошибки. Проверочная вкладка
  оставлена на паузе. Звуковая дорожка проверена ffprobe, физическое прослушивание
  не выполнялось. Проверен один ролик, не все 60; доступность без VPN по всей РФ
  не подтверждена. Первый запуск требует подготовки, кеш исчезает при рестарте;
  это временный адаптер для тестового стенда, не CDN/постоянное хранилище.

### Конфигурация и дальнейший запуск

Исходная конфигурация сохранена без изменений. Добавлены `compose.video.yaml`,
`edge.video.conf` и отдельный `video-image.env` (только тег образа). Защищённые
конфиги/env имеют права 600, каталог проекта 700. **Несекретный** `edge.video.conf`
должен иметь 644: nginx работает от UID 101. Синтаксис nginx проверен до замены
edge. Исходники worker сохранены отдельно в серверном каталоге
`/home/edem/apps/daryadarcy-staging/video-release-WfUbgw`, без env и ключей.

Использовать оба env и все три Compose-файла: существующий override сохраняет
настройки SMTP. Для обновления исключительно видеосервиса/edge:

```sh
cd /home/edem/apps/daryadarcy-staging
docker compose --env-file .env --env-file video-image.env \
  -f compose.yaml -f compose.override.yaml -f compose.video.yaml \
  up -d --no-deps --wait --wait-timeout 45 video
# Проверить nginx-конфигурацию перед переключением маршрутов.
docker compose --env-file .env --env-file video-image.env \
  -f compose.yaml -f compose.override.yaml -f compose.video.yaml \
  up -d --no-deps --wait --wait-timeout 45 edge
# Обновить DNS upstream даже если существующий edge не был пересоздан.
docker compose --env-file .env --env-file video-image.env \
  -f compose.yaml -f compose.override.yaml -f compose.video.yaml \
  exec -T edge nginx -s reload
```

### Откат только видео

Закрытые копии `.env`, `compose.yaml`, `compose.override.yaml`, `edge.conf`:
`/home/edem/apps/daryadarcy-staging/video-rollback-8RdlI0`, каталог 700, файлы 600.
Для возврата прежних маршрутов использовать неизменённую базовую конфигурацию
без video-overlay, не восстанавливая старые env целиком:

```sh
cd /home/edem/apps/daryadarcy-staging
docker compose --env-file .env -f compose.yaml -f compose.override.yaml \
  up -d --no-deps --wait --wait-timeout 45 edge
docker compose --env-file .env -f compose.yaml -f compose.override.yaml \
  exec -T edge nginx -s reload
# После проверки edge можно остановить только worker; это удалит tmpfs-кеш.
docker compose --env-file .env --env-file video-image.env \
  -f compose.yaml -f compose.override.yaml -f compose.video.yaml stop video
```

API/web/SMTP/БД не откатывать ради видео. Не выполнять `down -v`, очистку таблиц
или общий Docker prune. Образ и копии сохранены для восстановления; исходный
приватный каталог диагностики downloader остаётся вне Git, не публиковать его
метаданные с подписанными upstream-ссылками.

Свежий npm audit workspace: **1 critical / 35 high / 36 moderate / 4 low**.
Worker не устанавливает npm-пакеты, но это не снимает обязательства проверить
зависимости API/web. Критичный
[GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)
описывает неверно сокращённую IPv4-mapped IPv6 trust-сеть; текущий API использует
`loopback`, а read-only проверка этой настройки отвергает публичные IPv4 и
mapped IPv6. Это только оценка описанного сценария, не общая гарантия безопасности.
Следующая проверка advisories — до 2026-10-08. Production не разрешён. Этот выпуск
не включает предыдущий локальный F5.1 increment, Git push или merge в staging.

## Отзывы клуба: выпуск только фронтенда — 2026-10-07

- Web обновлён до `daryadarcy-frontend:553db77`, исходный frontend-коммит
  `553db77ea04d7605f00666bd69f358aaa63a9c60`. Image ID:
  `sha256:97bd93540c6466d3376a279c73813498f2af19553ca35278115abed247cd560e`.
  Отзывы представлены читаемыми бумажными карточками с фрагментами текста,
  именами из оригиналов и ссылками на исходные скриншоты. Платёжная логика,
  иллюстрации остальных блоков и подписной контент не изменены этим оформлением.
- Свежий production Next build выполнен на Mac; в Linux-образ переданы только
  платформонезависимые `.next` JS/CSS/страницы. Кеши разработки, runtime route
  cache, traces, diagnostics и types исключены. Build ID: `P4rDkaVOYd6G8m3CMA1Nn`.
  Архив 29 МиБ проверен по SHA-256
  `57aae45217432bec4881d5b3ddcd3be26ffe8fd6541f720df0656426c14fa59c`.
- Linux runtime и зависимости взяты из проверенного `daryadarcy-staging:5c4a9cc`
  с ID `79d4cab575b2a7132b45740165ee30bc38bbbc9894f4f511e5bf24f1bb718b26`.
  Lockfile, frontend package/config/public относительно него не менялись.
  Это **frontend-only artifact**, не сборка нового API. Установка зависимостей
  и Node-heavy сборка на общем сервере не выполнялись; упаковка ограничена
  256 МиБ / 0.5 CPU и не требует сети. Новый образ сохраняет прежние ограничения
  npm advisories: обновления зависимостей в этот выпуск не включены.
- Перед переключением: production-сборка, 7 браузерных тестов отзывов и
  creation intent, 10 unit-тестов creation intent — pass. Linux preflight
  без сети от UID 1000: 7 страниц, 49 JS/CSS файлов, новый текст в клиентской
  сборке, оригинал отзыва и native image optimizer — HTTP 200.
  Первичная SSR-проверка текста выявила неверное ожидание smoke-скрипта:
  `/club` сначала рендерит SessionStatus, отзывы появляются после проверки
  сессии клиентом. Проверка исправлена без изменения приложения; итоговый
  клиентский сценарий подтверждён на живом сайте.
- Текущий frontend включает также ранее локальный `c148c02` (UUID creation
  intent для повторов сохранения поста). Эти сценарии повторно проверены
  локальными тестами; авторизованное создание постов на стенде не выполнялось.
  Полный reload-safe F5.1 этим выпуском не объявляется закрытым.
- Изменён только единственный `STAGING_IMAGE` в `.env`. API закреплён отдельно
  существующим override на `5c4a9cc`. Сохранены оба env и все три Compose-файла;
  обновлён исключительно `web` с `--no-deps`, nginx проверен и перечитал DNS.
  Все шесть сервисов healthy. ID/образ/start time API, MySQL, SMTP-прокси,
  worker и edge совпадают с снимком до выпуска. SQL, почта, видео, внешние
  платежи, миграции и другие проекты не изменялись.
- 11 HTTPS smoke-проверок прошли: страницы, launch-config, гостевая сессия,
  оригинал отзыва; три запрещённых платёжных маршрута по-прежнему дают 503.
  В настоящем браузере через действующий API видны 3 community и 6 основных
  отзывов; переход `1 → 2 → 1` работает, первая левая кнопка отключена.
  Скриншот живой страницы сохранён вне Git. Воспроизведение видео, SMTP-доставка
  и авторизованное редактирование этим frontend smoke не проверялись.
- Контекст упаковки, архив, Dockerfile, smoke-скрипт и конфигурации до выпуска:
  `/home/edem/apps/daryadarcy-staging/club-release-lS8KT9`. Каталог 700,
  конфигурации/env 600; исходники упаковки не содержат ключей. Временный
  preflight-контейнер остановлен и удалён, прежний образ сохранён.
- Откат только web: вернуть `STAGING_IMAGE=daryadarcy-staging:5c4a9cc`,
  выполнить приведённые ниже команды и повторить HTTPS/browser smoke.
  Не откатывать API, SMTP, video, БД или env других сервисов ради фронтенда.

```sh
cd /home/edem/apps/daryadarcy-staging
docker compose --env-file .env --env-file video-image.env \
  -f compose.yaml -f compose.override.yaml -f compose.video.yaml \
  up -d --no-deps --wait --wait-timeout 45 web
docker compose --env-file .env --env-file video-image.env \
  -f compose.yaml -f compose.override.yaml -f compose.video.yaml \
  exec -T edge nginx -s reload
```

Это обновление тестового стенда. Git push, merge в staging и production-выпуск
не выполнялись. Перед следующим frontend-only выпуском заново проверить
совместимость артефакта с runtime; при изменении зависимостей/config/public
не использовать этот сокращённый способ упаковки.

## Превью изображений — выпуск на тестовый стенд 7 октября

В карточках публичной ленты Next.js преобразует исходные S3-фото в адаптивные
WebP-превью. Оригиналы и их ссылки не изменяются; полноэкранный просмотр
получает оригинал. Подписанные URLs, `uploads`, платный `club` и защищённые
`/media` не проходят через публичный обработчик `/_next/image`.
Карусели постов и просмотра активируют только текущую и соседние фотографии.
Превью публичных каруселей лендинга клуба также сжимаются, оригиналы сохраняются.

Для этого выпуска нужны **новый образ web с новой `next.config.mjs` и правами
node на `.next/cache/images`**, а также отдельное согласование сетевого изменения.
Нельзя просто заменить `.next` в старом runtime: изменились конфигурация и
требования к кешу. Подготовлен дополнительный
[Compose overlay](../../infrastructure/deploy/teamassist/compose.images.yaml).
Он добавляется после действующих `compose.yaml`, `compose.override.yaml` и
`compose.video.yaml`, не заменяя настройки SMTP/video и не открывая egress API.

Overlay даёт **web исходящий доступ в интернет**, не сетевой allowlist по домену.
На уровне Next.js разрешены только HTTPS `s3.twcstorage.ru/daryadarcy-s3/feed/**`
без query string и локальные `/assets/responsive/**`. Редиректы и локальные IP
запрещены, SVG не разрешён. На чувствительном production-стенде вместо общей
egress-сети нужен фильтрующий шлюз или отдельный медиасервис.

Дисковый кеш ограничен 128 МиБ и вынесен в отдельный volume; источник — до 8 МиБ
и 20 млн пикселей, качество 75, выход до 1440 px. Число потоков Sharp — 1,
`UV_THREADPOOL_SIZE=1` ограничивает параллельные native-задачи. Внутренний
кеш распакованных libvips-изображений выключен через `imgOptOperationCache=false`;
кеш готовых WebP на диске сохраняется. Это **не глобальное ограничение числа
HTTP-запросов**. Перед выкладкой
проверить холодную загрузку альбома при лимите памяти web 384 МиБ; локальная
проверка на Mac не доказывает достаточность этого лимита. Первый запрос всё ещё
зависит от S3, повторный получает готовое превью из кеша.

Отдельно пересобрать public-video worker: каталог теперь запрашивает обложки
через собственный `/media/yt-thumb/`, worker кеширует проверенные JPEG на 60 секунд
(до 64 записей / 2 МиБ), сохраняя проверки публикации на каждом запросе.
Никакого браузерного кеша, обходящего снятие с публикации, не добавлено.

Локальные замеры одного и того же файла: S3-фото 3 210 606 → 33 804 байта
(480 px); изображение клуба 297 400 → 8 924 байта (160 px). Это замеры
производной версии на локальном Next.js, не заявленная скорость живого стенда.
Перед переключением: Compose validation, проверка UID/кеша и доступности S3,
холодный/тёплый запрос превью, guest smoke и браузерные проверки. При откате
вернуть прошлый web-образ и убрать images overlay из команды запуска; оригиналы
S3 и SQL не менялись, восстановление БД для этого изменения не требуется.

### Серверная проверка памяти перед выпуском

Проверка реального девятифотографийного альбома в отдельном временном web
обнаружила OOM при 384 МиБ. Один `UV_THREADPOOL_SIZE=1` не устранил падение;
повтор с отдельным клиентом подтвердил, что проблема именно у web.
После отключения native operation cache тот же холодный прогон прошёл:
480 px — 246 746 байт / 7,661 с, 1440 px — 1 964 054 байта / 15,435 с,
повтор одной фотографии — cache HIT / 53 мс. Пик cgroup web — 247 050 240 байт
(около 236 МиБ), `oom=0`, `oom_kill=0`, лимит и CPU не увеличивались.
Это один измеренный альбом, не нагрузочный SLA для всех 4431 фотографий.

Регрессионная проверка сохранена в
[smoke-image-previews.mjs](../../tooling/operations/smoke-image-previews.mjs).
Клиент запускать отдельным ограниченным контейнером, не добавляя его расход
памяти к web. Собирать web с обеими настройками: один поток без отключения
native cache не является проверенным вариантом. Механизм параллелизма —
[официальная документация Sharp](https://sharp.pixelplumbing.com/performance/).

### Подтверждённое переключение стенда

Пользователь согласовал сетевое изменение; переключение выполнено 7 октября
2026 года. Действующие образы:

- web: `daryadarcy-frontend:62c4001`, исходники
  `62c4001fe0a316bd5bb56bd025b2d8c9feb9ce72`, image ID
  `sha256:d12a99cb9fb28e179b62633fcfcee952409e66a8abd83afded205a8addca4058`,
  Next build ID `OM2hCGkWPQIQyukA9QSOZ`;
- video: `daryadarcy-video:51a5385`, исходники
  `51a53858fe4ac7838c0e733d6cf5b82dd2a5378b`, image ID
  `sha256:d651b477f11d7ef76f1c3cd53469c4e5014f426f68d8cd97932c271ce0616663`;
- API остаётся на `daryadarcy-staging:300c8d3`.

Portable frontend собран локально; Linux runtime и native-зависимости взяты
из проверенного образа `300c8d3`, Mac `node_modules` не переносились.
Конфигурация и права кеша включены в новый образ. SHA-256 архива
`frontend-lowmem.tar.gz`:
`0b80b5ddf3c9b88fdda63c568d1a83c1af6074e5883016c3d49c03b4a59a3d44`.
Перед запуском проверены UID 1000, writable cache и отсутствие deployment-env
и SQL-дампа в образе. Пакеты не обновлялись; временный risk exception для
известных advisories до 13 октября сохраняется. Это не production-допуск.

Обновлены только web и video с `--no-deps`; nginx перечитал конфигурацию.
Все шесть сервисов healthy. Сравнение снимков подтвердило неизменность ID,
образа и времени старта всех остальных контейнеров, включая другие проекты.
API по-прежнему подключён только к isolated-сети, outbound HTTPS запрещён.
SQL, миграции, настройки SMTP, платёжного провайдера и production не менялись.

Проверки после переключения:

- Восемь guest HTTPS smoke-проверок прошли: страницы, launch-config,
  гостевая сессия и каталог; административные маршруты дают 401,
  недоступные платежи — 503.
- Реальное S3-фото 3 210 606 байт → WebP 33 804 байта при 480 px.
  Первый запрос MISS — 1651 мс, повтор HIT — 430 мс, включая сеть клиента.
  Запрещённые private/internal/signed источники дают 400.
- Обложка video: JPEG 23 294 байта, `no-store`; запросы 448 и 169 мс.
  MP4 вернул 206 и корректные 16 байт для начального и конечного Range;
  первая холодная подготовка заняла 13,077 с. Полный просмотр фильма
  этим ограниченным Range smoke не проверен.
- В браузере загрузились видимые фото клуба и девять превью первого поста.
  Полноэкранный просмотр загрузил оригинал шириной 3072 px из S3;
  дальние кадры не запрашивались. Обложки каталога видео видны.
- Live web memory peak после smoke — 236 134 400 байт, `oom=0`,
  `oom_kill=0`; отдельный холодный preflight описан выше.

Локально: сборка, typecheck, lint, boundaries, docs — pass;
991 non-SQL unit-тест пройден (4 skipped), 40 worker-тестов и 51 выбранный
браузерный тест пройдены. SQL integration suite в этом выпуске не запускалась.

Резервная копия конфигураций, валидный SQL-дамп и материалы выпуска:
`/home/edem/apps/daryadarcy-staging/media-release-51a5385.fEJ4zM`
(каталог 700, секретные файлы 600). Восстановление SQL не репетировалось.
Пять собственных остановленных preflight-контейнеров и их временная сеть
удалены; образы для отката и действующий image-cache volume сохранены.

Следующие обновления стенда должны сохранять все четыре Compose-файла:

```sh
cd /home/edem/apps/daryadarcy-staging
docker compose --env-file .env --env-file video-image.env \
  -f compose.yaml -f compose.override.yaml -f compose.video.yaml \
  -f compose.images.yaml ps
```

Откат этого выпуска: изменить только `STAGING_IMAGE` на
`daryadarcy-staging:300c8d3` и `STAGING_VIDEO_IMAGE` на
`daryadarcy-video:2026-10-07-v1`; исключить images overlay из команды,
обновить только `web video` с `--no-deps --wait`, перечитать nginx и повторить
guest smoke. Не восстанавливать старый env целиком, не откатывать БД/API
и не удалять volumes. Git push и merge в staging этим выпуском не выполнялись.

## ЮKassa: переход тестовой базы 7 октября

Пользователь согласовал защищённую копию, проверку восстановления и безопасное
обновление существующей базы перед тестовой оплатой. Этот этап **не включает
оплаты** и не является production-выпуском. Код checkout, клиентский ключ,
отдельный платёжный egress, кабинетные уведомления и настоящий sandbox flow
имеют собственные контрольные точки; они не объявляются готовыми этим SQL.

Причина отдельного перехода: исходная рабочая схема создана непосредственно
из canonical schema (28 таблиц), без `__drizzle_migrations`. Нужные изменения
0017–0025 уже есть в таблицах. Повторять их ALTER или записывать выдуманное
исполнение в журнал нельзя. Общий `pnpm db:preflight` остаётся заблокированным
на трёх прежних orphan 0017–0019; этот production-блокер не скрыт и не исправлен.

Для **этого единственного baseline/0026** создан отдельный
[stage-only operator](../../tooling/scripts/staging-baseline-upgrade.ts).
Он не принимает произвольные SQL/хеши или флаг обхода. Проверяет MySQL 8.4,
`daryadarcy_staging`, полный SHOW CREATE fingerprint старых таблиц (без
изменяющегося счётчика AUTO_INCREMENT), отсутствие views/triggers/routines/events
и точный SHA-256 0026. В режиме apply дополнительно связывает сервер UUID с
реально восстановленной копией, проверяет права/владельца закрытых файлов,
SHA-256 дампа, совпадение исходной/восстановленной схемы и строк, счётчики ID,
возраст подтверждения до 6 часов и успешную квитанцию rehearsal. При нескольких
операторах используется GET_LOCK. CREATE в MySQL autocommit: при потере ответа
сначала повторить read-only inspection, не удалять и не пересоздавать таблицу.

Защищённые материалы:
`/home/edem/apps/daryadarcy-staging/yookassa-baseline-20261007.tGFBuT`.
Каталог 700, дамп/конфигурации/квитанции 600; не копировать их в Git или образ.
Внутри: свежий `database.sql.gz`, прежние env/Compose/edge, inventory сервисов,
закрытые snapshots, `restore-proof.json`, настоящие `rehearsal-receipt.json` и
`applied-receipt.json`, итоговый `verification.json`. Подтверждение восстановления
создано после сравнения данных, не заполнено вручную для снятия блокировки.

Проверки перед применением:

- Две свежие восстановления в отдельный MySQL без портов, API и mail workers:
  совпали 28 определений, digest всех 833 строк и 24 AUTO_INCREMENT-счётчика.
  Память/CPU ограничены; первая пустая попытка tmpfs была слишком мала и
  остановилась до восстановления. Пересоздан только собственный пустой контейнер
  с redo capacity 32M; работающие данные и сервисы не затронуты.
- На реальной копии: CREATE, неизменность старых строк, повтор без CREATE,
  отказ при занятом advisory lock, отказ SELECT-only аккаунта при CREATE и
  последующее восстановление обычными правами. Для этого fault fixture сброшена
  только новая **пустая** таблица на проверенной disposable-копии, не на стенде.
- 47 unit/CLI тестов RED→GREEN; четыре migration-набора — 78 pass. Полный
  локальный прогон 1070 pass / 596 skip; SQL/external skip не является native
  provider приёмкой. Types, backend build, API 72/25461, boundaries/docs — pass.
  Зависимости не менялись; audit остаётся 51 (1 critical, 20 high, 26 moderate,
  4 low). Существующее ограниченное исключение не разрешает production или
  расширение сети: перед payment egress требуется новый reachability review.

Применено 2026-10-07T17:17:59Z (20:17 МСК), проверено 17:24:52Z:
28 → 29 таблиц, добавлена только `billing_checkout_intents` (0 строк).
Все 833 прежние строки и определения сохранены; исторический журнал не создан.
Исходный schema SHA-256:
`ab07104f1ea2fa3377588df1cca7db22a3fdb7f1466e66f547143f3b5e9fc3ac`;
итоговый полный schema SHA-256:
`53fc2f906e768d59d7834d1b6e945c06e91dce4f2a7e9d5f6068ce16542cb55c`.
SHA-256 SQL 0026:
`96196ec383cd2ce7a33882fc338d77512f5c32d6081646dd2fb1f9a191ba232b`;
отдельной новой таблицы:
`da894d0b5fd978061571f63803f676cc3ba6424480db588dda501e96633de914`.

Образы API `300c8d3`, web `62c4001`, video `51a5385`, все четыре Compose-файла,
SMTP и сети сохранены. Шесть сервисов healthy; 8 guest smoke проверок проходят,
включая 503 для оплат. Runtime приложения, frontend и платёжные env этим этапом
не обновлялись; sandbox-платёж или новое письмо доступа не создавались.

Оператор собирается отдельно существующим esbuild, без новых зависимостей:

```sh
pnpm exec esbuild tooling/scripts/staging-baseline-upgrade.ts --bundle \
  --platform=node --format=esm --packages=external --outfile=/absolute/private/release/tooling/scripts/staging-baseline-upgrade.mjs
```

Сохранять относительный путь `packages/database/drizzle/0026_billing_checkout_intents.sql`
под тем же release root. В Linux runtime с теми же mysql2/Zod передать DATABASE_URL
через закрытый env-файл, не аргументом. Без флагов — только read-only inspection.
`--rehearse` требует `STAGING_BASELINE_RESTORE_HOST=daryadarcy-yookassa-restore-<id>`;
`--apply` — только исходный сервер UUID. Обоим требуется
`STAGING_BASELINE_BACKUP_DIR=<absolute protected release directory>`.
Квитанцию stdout сохранять закрытым файлом; `releaseApproval:false` не превращать
в разрешение включить платёж. За пределами этого baseline применять нельзя.

Откат: предыдущий runtime уже работает, добавочная таблица ему не мешает.
Не выполнять DROP/DOWN и не восстанавливать дамп поверх изменённой рабочей базы
ради отката кода. Если понадобится аварийное восстановление данных, сначала
отдельное решение/копия актуального состояния; проверенный дамп сохранён.

После проверок временный restore-контейнер и его отдельная internal-сеть
удалены с проверкой task-label. Удалена только disposable-копия и её fault
account; исходные 833 записи можно снова восстановить из сохранённого дампа.
Рабочие MySQL/volumes, образы и закрытые материалы выпуска сохранены;
контейнеров с task-label этой репетиции больше нет. Для новой репетиции создавать
новую отдельную копию и заново получать подтверждения, не править старые UUID.

## ЮKassa: кабинет и репетиция сетевого шлюза 7 октября

В Safari подтверждены магазин **1489524**, пометка «тестовый», сохранённый адрес
`https://daryadarcy.dev.reeskeen.ru/api/yookassa/webhook` и только события
`payment.succeeded`, `payment.canceled`. Прежний адрес `/library` неверен для
уведомлений. На сервере обработчик ещё не развёрнут; сохранение адреса само
по себе не доказывает доставку и не разрешает выдачу доступа.

Добавлены opt-in `compose.yookassa.yaml`, `yookassa-egress.conf` и отдельный
[native-набор](../../tests/yookassa-egress.native.test.mjs). Это TLS-passthrough
к одному фиксированному домену, не универсальный forward/CONNECT proxy. API
подключается только к дополнительной internal-сети; отдельный nginx без ключей
имеет внешний маршрут. Проверка сертификата остаётся у Node. Resolver задан
внешними адресами, иначе Docker alias мог бы направить upstream в сам шлюз.
Ограничения: 32 МиБ, 0.1 CPU, 32 PID, read-only, no-new-privileges, cap-drop ALL,
не более восьми соединений и ограниченные таймауты; нет опубликованного порта.

Репетиция около **23:13 МСК** (20:13 UTC), на настоящем серверном Docker:

- Сначала тест отказал из-за отсутствующего bind source конфигурации (RED).
  Затем с настоящим закреплённым nginx — GREEN; финальный набор **2 pass**.
- Node без ключа получил **401** от настоящего `/v3/me`, TLS `authorized:true`.
  Платёж не создавался; ключ, почта и карточные данные не отправлялись.
- Другой/пустой SNI завершаются отказом; plaintext не получает HTTP-ответа;
  прямое подключение caller к `1.1.1.1:443` не устанавливается.
- Compose проверен без чтения секретных env локально, затем с реальными
  серверными SMTP/video/image overlays, выводя только итог проверки.
  Потерю internal payment-сети ловит отдельная mutation-проверка.
- Все созданные тестом контейнеры/сети удалены после проверки task-label.
  Рабочие шесть сервисов healthy на прежних образах и сетях; API остаётся
  исключительно `isolated`. Конфигурация шлюза **не применена** к приложению.

Материалы репетиции находятся в закрытой папке
`/home/edem/apps/daryadarcy-staging/yookassa-egress-check-20261007.t79ZhQ`.
Docker доступен локальному native-набору только через временный SSH Unix-socket
в owner-only каталоге; новых TCP-портов Docker/API не открывали.
Запускать набор явно: `YOOKASSA_EGRESS_NATIVE_TEST=true`,
`YOOKASSA_EGRESS_PROBE_IMAGE=<existing Node image sha256>`, при remote Docker
`YOOKASSA_EGRESS_CONFIG=<absolute config path on Docker host>`, затем
`node --test tests/yookassa-egress.native.test.mjs` из корня репозитория.
Без opt-in оба native-теста пропускаются, а не считаются успешно выполненными.

До выкладки: завершить Y4 caller/возврат и обновить review reachability,
особенно legacy OAuth при появлении маршрута к провайдеру. Audit по прежнему
**51: 1 critical / 20 high / 26 moderate / 4 low**; зависимости не добавлены.
Общий локальный набор **1070 pass / 596 SQL/external skip**, types, backend build,
API-контракт, границы проходят. Это не sandbox-оплата/SMTP-приёмка.

Не выполнять общий `compose up` с новым overlay до готовности caller/backend.
Будущий rollout должен сохранить ВСЕ четыре прежних Compose файла и добавить
пятый; новые секреты передавать только закрытым env-файлом. Точный откат сначала
закрывает checkout/отключает test flag, возвращает прежние API/web/edge образы,
затем убирает только новые payment-сети/сервис. Никогда не удалять MySQL volume,
таблицы намерений или квитанции ради отката кода. Сейчас откат приложения не нужен.

## Совместная версия staging — выпуск 8 октября, 15:14 МСК

По запросу пользователя объединённая feature-ветка отправлена в `origin/staging`
без force push. Исходный коммит приложения:
`829133e2358cd43b321fcafec788e7584d9a7c47`. Включает 43 прежних локальных коммита
и frontend `78ab497` Сергея: WebP/адаптивные картинки, одинаковые фотоблоки,
ограничение тяжёлого DOM длинных списков и неактивного кеша, защита пагинации.
История обеих сторон сохранена; последующая запись этого отчёта не меняет код
развёрнутого приложения.

- API и web теперь используют **`daryadarcy-staging:829133e`**, Linux/amd64,
  image ID `sha256:780177e8e857cc13a6ae273e4ab7bff20d451edc7141bea58f6342ce1ab37fe4`.
  Revision label совпадает с исходным коммитом. Video остаётся `51a5385`.
- Контекст взят из `git archive` этого коммита, дополнен проверенными локальными
  сборками API/Next без `.next/cache` и `.next/dev`. Mac `node_modules` не
  переносились. Новый Linux runtime заново установил production-зависимости
  через pnpm 9.12.0 с frozen lockfile и выключенными scripts; версии/lockfile
  не менялись. Проверенный Node base закреплён тем же digest. Архив-контекст:
  SHA-256 `0e626cc4f6b79b63615e89715a1b0a55b97c7cd226541ad53e22d8268e2276cb`;
  окончательный операторский `Dockerfile.release` сохранён рядом отдельно.
- Сборка выполнялась отдельным builder с лимитом 768 МиБ / 0,5 CPU; frontend
  собран локально, чтобы не запускать тяжёлую Next-компиляцию на общем хосте.
  Builder и его кеш после экспорта удалены; образ и материалы выпуска сохранены.
- Runtime проверен контейнером без сети/БД/SMTP: UID 1000, Next 16.3.8,
  Nest 12.1.2, reflect-metadata, mysql2, nodemailer и настоящий PNG → WebP;
  кеш доступен node, env-файлов/vitest/tsx нет. Compiled API запускается,
  гостевая сессия отвечает 200, admin — 401. Настройка сайта без SQL штатно
  даёт 503; это не подходящий readiness для изолированного прогона без БД.
- Перед переключением сохранены свежий SQL-дамп и конфигурации в
  `/home/edem/apps/daryadarcy-staging/release-829133e.lmcvyg` (каталог 700,
  секретные копии/дамп 600). Проверены gzip, 29 CREATE TABLE и завершение dump.
  Восстановление именно новой копии этим выпуском не репетировалось.
- Изменены только `STAGING_IMAGE` в `.env` и API image в существующем override.
  Сохранены все четыре Compose-файла, API isolation и прежний image egress.
  Только API/web пересозданы с `--no-deps`; edge проверен и перечитал DNS.
  SQL/миграции, `api.env`, SMTP, ключи и платежные настройки не менялись.
- После переключения все шесть сервисов healthy; API/web имеют 0 рестартов,
  OOM не отмечен. ID/образы/start time остальных контейнеров, включая другие
  проекты, совпали с предварительным снимком. Счётчики до/после: 29 таблиц,
  2 тестовых пользователя, 742 поста, 0 клубных оплат, 0 checkout intents.
  Квитанция проверки сохранена в `verification.json` закрытого каталога выпуска.
- Восемь guest HTTPS smoke-проверок прошли: сайт, сессия, конфигурация с SQL,
  публичная лента, отказ гостю на admin и 503 на прежних payment-ручках.
  Клуб открыт в браузере: текст/отзывы отображаются, три видимых WebP-иллюстрации
  загрузились. Это не приёмка всей ленты, видео, администрирования или Safari.
- Свежая локальная проверка: **1602 pass / 618 SQL/external skip**, типы,
  backend/frontend build, lint, API 73 / 25642, boundaries и docs проходят.
  При проверке объединения выбранный Chromium-набор дал **60 pass / 1 fail**:
  `long-lists.spec.ts:550` ожидает 2 запроса, получает 3; отдельно воспроизведено
  дважды. Trace показывает две загрузки первой страницы и одну с cursor=12,
  что согласуется со сбросом кеша при восстановлении сессии, а не циклом курсора.
  Авторизация и assertion не менялись; полная браузерная приёмка не объявляется.
- Native production audit по прежнему lockfile: **51 advisory: 1 critical /
  20 high / 26 moderate / 4 low**. Существующее ограниченное тестовое исключение
  и review до 13 октября сохраняются: loopback trust, без experimental tRPC
  callers/нового OAuth egress, проверка raster-сигнатур и SVG block API; Next
  обрабатывает только прежний публичный allowlist и доверенные статичные файлы.
  Это не успешный security gate или production-допуск. Платёжные TEST-флаги
  остаются выключены, payment overlay не добавлен, sandbox-платёж/письмо не
  инициировались. Prodamus diagnostic deployment и Y5 по-прежнему отдельные gates.

### Откат этого выпуска

Вернуть **только** web `STAGING_IMAGE=daryadarcy-frontend:62c4001` в `.env` и
API `daryadarcy-staging:300c8d3` в `compose.override.yaml`. Прежние образы
сохранены. Затем выполнить с четырьмя действующими Compose-файлами:

```sh
cd /home/edem/apps/daryadarcy-staging
docker compose --env-file .env --env-file video-image.env \
  -f compose.yaml -f compose.override.yaml -f compose.video.yaml \
  -f compose.images.yaml up -d --no-deps --wait --wait-timeout 60 api web
docker compose --env-file .env --env-file video-image.env \
  -f compose.yaml -f compose.override.yaml -f compose.video.yaml \
  -f compose.images.yaml exec -T edge nginx -s reload
```

Повторить guest smoke. Не возвращать старые `api.env`/SMTP/ключи целиком,
не откатывать video или MySQL и не восстанавливать дамп поверх рабочей базы
ради отката приложения. Новых миграций этим выпуском не было.

## Обновление объединённой версии — 8 октября, 20:32 МСК

По отдельному запросу пользователя API и web обновлены до
`daryadarcy-staging:1f67d5b`, исходный коммит
`1f67d5bb4c59ff9cd45f35cc42362cd8d0a76c3e`. Образ Linux/amd64:
`sha256:4b4a7e2c26d33c72b11952846b43c112aed4b7bb7345ce2e9fc51492dc1680d6`.
Revision label совпадает. Это объединение frontend staging `7524987` и двух
локальных backend-подшагов M06; Git этим выпуском не пушился.

- Контекст — git archive исходного коммита плюс свежие API/Next сборки без
  `.next/cache`/`.next/dev`; Mac node_modules и секреты не переносились.
  SHA-256 архива: `e195ed8bb48c4c6f0b8309fc08532627a6fa6da73e110459ff2e20251c42c229`.
  Node base закреплён прежним digest; production install использует pnpm 9.12.0,
  frozen lockfile и выключенные scripts. Манифесты/lockfile не изменились.
- Первый bounded builder (768 МиБ / 0,5 CPU) получил OOM: BuildKit параллельно
  выполнял pnpm install и apt install. В операторском Dockerfile.release COPY
  production dependencies перенесён перед apt, создавая последовательную
  зависимость этапов. Повтор на том же лимите завершился успешно; это изменение
  порядка сборки, не увеличение runtime ресурсов/изменение зависимостей.
  Временный builder и его собственный кеш удалены после экспорта.
- Отдельный runtime probe без сети/SQL/SMTP прошёл: UID 1000, Nest/Next/native
  PNG → WebP, writable image cache, отсутствие env/dev-пакетов, compiled API,
  гостевая сессия 200, admin 401 и fail-closed config 503 без базы.
- Перед переключением сохранены свежий SQL-дамп, конфигурации и снимок всех
  контейнеров: `/home/edem/apps/daryadarcy-staging/release-1f67d5b.V772V2`.
  Каталог 700, копии/дамп 600. Gzip, 29 CREATE TABLE и completion marker
  проверены; восстановление именно этого дампа не репетировалось.
  Операторские scripts, окончательный Dockerfile и verification.json сохранены
  там же, без публикации секретов.
- Переключение завершилось 2026-10-08T17:32:17Z. Изменились только image tags
  API/web; использованы прежние четыре Compose-файла и `--no-deps`.
  Edge проверен и перечитал DNS. Все шесть сервисов healthy, API/web restart=0,
  OOM=false. Остальные контейнеры, их ID/start time, API isolation и provider
  configs сохранены. Миграций не было; счётчики до/после: 29 таблиц,
  2 пользователя, 742 поста, 0 club payments, 0 checkout intents.
- После выкладки прошли 8 гостевых HTTPS smoke-проверок и HTML для club/feed/
  videos/video/1/library/shop/quiz. В браузере клуб, лента и каталог/магазин
  отображаются; три видимых клубных и одиннадцать видимых изображений ленты
  загрузились. Видео /video/1 получило metadata, readyState=4, error=null;
  настоящее воспроизведение продвинулось с 0,22 до 25,07 секунды и остановлено.
  Это выборочная проверка, не полный каталог/Safari/admin/provider acceptance.
- Свежая локальная проверка: 1804 pass / 618 SQL-external skip; root/frontend/E2E
  types, обе сборки, lint, API 73/25642 и 560-file boundaries проходят.
  Native audit по-прежнему 51 advisory (1 critical / 20 high / 26 moderate /
  4 low): ограниченное тестовое исключение сохраняется, production не разрешён.
  Prodamus/ЮKassa TEST-флаги, блокировки оплаты, SMTP и сети не изменены;
  платежи и внешние письма не запускались. M07c и прежние release gates открыты.

Откат этого обновления: вернуть только web `STAGING_IMAGE=daryadarcy-staging:829133e`
в `.env` и API `daryadarcy-staging:829133e` в существующем override; прежний образ
сохранён. Затем использовать те же четыре Compose-файла и команды `up --no-deps`
и edge reload из предыдущего раздела, повторить guest smoke. Не возвращать весь
api.env, не менять SQL/тома, не восстанавливать дамп поверх рабочей базы ради
отката кода. Ночные автоматические продолжения не получают нового разрешения
на push/deploy: этот выпуск выполнен по отдельному прямому запросу пользователя.

## Первый Prodamus TEST checkout — 9 октября, 01:16 МСК

Прямое подтверждение пользователя: тестовый клуб → подписанное уведомление →
30 дней dev-доступа, без реальных денег и автосписаний. Дополнительно подтверждена
замена глобального callback тестового магазина. **Сквозная оплата ещё не принята:**
на этом шаге транзакция провайдера и фактическая выдача доступа не проверялись.

- Отдельный `prodamus-test` healthy, без фоновых workers и исходящей сети.
  API/web остаются `daryadarcy-staging:1f67d5b`; остальные сервисы не заменялись.
  Runtime image закреплён за прежним SHA из предыдущего раздела.
  Источник: `1d9fce31a982f638bfec86a0a061652b0b3bcbb9`.
  Bundle: `prodamus-test-release.pTkWSw/prodamus-test-1d9fce3.mjs`, SHA-256
  `b1f456eb08c18fb63ce34b0865b2b69b292bd1aaafcaf3d3061b69fb72cb3db4`.
- Добавлен `compose.prodamus-test.yaml`, `prodamus-test-image.env` и защищённый
  `prodamus-test.env` (600). Ключ не находится в Git, CLI или логе. Временные
  `transfer.pem`/`key.value` удалены после настройки; рабочий ключ хранится только
  в защищённом конфиге. Не выводить полный Compose config/container Env.
- Реально используемый container edge — **edge.video.conf**, а не edge.conf.
  В нём и `/etc/nginx/sites-available/daryadarcy.dev.reeskeen.ru.conf` открыты
  только точные POST `/api/trpc/club.createCheckout` и
  `/api/prodamus/test/webhook`. Прежняя per-IP квота сохранена; live webhook,
  `/api/pay/` и объединённый tRPC checkout batch остаются 503.
  Конфиги проверены `nginx -t`, перечитаны без перезапуска рабочих контейнеров.
- 14 HTTPS проверок проходят: неподписанный callback 400, GET 405, чужой Origin
  403, cookie/query 400, тип 415, размер 413; старые платежные блоки 503,
  пустой checkout 400, обычные health/launch-config 200. Семь сервисов healthy.
  В новом runtime отдельно выполнен read-only SELECT 1: соединение с dev SQL
  доступно. После выкладки ещё 12 локальных runtime/compiled проверок проходят.
- В `testpage1.payform.ru/settings/` сохранён callback
  `https://daryadarcy.dev.reeskeen.ru/api/prodamus/test/webhook`; прежний адрес
  заменён. Запрет URL-уведомлений для demo выключен, режим demo не менялся.
  Это настройка доставки, не доказательство состоявшейся оплаты.
- Страница `/club` открывается, кнопка подготовки оплаты доступна. Неизменённый
  старый frontend всё ещё пишет «автосписание каждый месяц»: для этого TEST
  варианта текст неверен — подписочный ID/сохранение карты не отправляются.
  Пользователю явно сообщить об отсутствии автосписаний; UI-подпись — отдельная
  незавершённая правка, не менять frontend в этом backend rollout.
- 58 локальных целевых проверок, включая 46 SQL и compiled entry, прошли;
  full 1816 pass / 726 reported skips. Одноразовый tmpfs MySQL этого запуска
  удалён; рабочая база не использовалась как acceptance fixture. Зависимости
  по-прежнему имеют известные advisory; узкое TEST исключение, не production.

### Откат только этого TEST подключения

В `/home/edem/apps/daryadarcy-staging` вернуть
`prodamus-test-release.pTkWSw/host-nginx.before` в указанный host virtual host,
проверить `sudo nginx -t` и перечитать host nginx. Вернуть
`prodamus-test-release.pTkWSw/edge.video.conf.before` **копированием в существующий
edge.video.conf** (сохранить inode bind mount), проверить и перечитать edge nginx.
Затем остановить только новый сервис:

```sh
docker compose --env-file .env --env-file video-image.env \
  --env-file prodamus-test-image.env -f compose.yaml -f compose.override.yaml \
  -f compose.video.yaml -f compose.images.yaml -f compose.prodamus-test.yaml \
  stop prodamus-test
```

Проверить, что оба открытых пути снова 503, а API/web healthy. При необходимости
вернуть прежний глобальный callback только отдельным подтверждённым действием
в кабинете: `https://auth.dev.spro-dev.sprodev.ru/api/users_payments/callbacks/prodamus`.
Не откатывать API/web, SQL, SMTP, подписки или весь api.env. Нет новых миграций;
будущие оплаченные TEST заказы нельзя копировать в production или выдавать за
подтверждение реальных денег. Ночным продолжениям это не даёт разрешения deploy.

## Валютные TEST способы и первая подтверждённая выдача — 9 октября, 01:36 МСК

По прямому запросу пользователя сняты ограничения выбора способа оплаты в новых
тестовых ссылках. Способы показывает сам Prodamus; доступность конкретного банка,
рассрочки и минимальная сумма определяются магазином/провайдером. Боевой сценарий,
магазин товаров, шестимесячный план и автосписания этим не включаются.

- Источник `6987883ecd895c3aaa1e14b0ef762d56404e97ce`, bundle
  `prodamus-test-release.pTkWSw/prodamus-test-6987883.mjs`, SHA-256
  `e6109672aed71a33cb83bcb51eb53ad9d5af36d8b5b2633e30d186bc19b85187`.
  Заменён только отдельный no-worker `prodamus-test` на прежнем pinned image;
  все шесть прежних контейнеров сохранили ID, семь сервисов healthy.
  Маршрутизация, секреты, квоты и кабинетные настройки не изменены.
- Поддержаны подписанные TEST уведомления RUB/EUR/USD/KZT/BYN. Валютный платёж
  должен содержать положительную валютную сумму и единственный точный TEST
  товар 790 ₽ × 1; сохранённый заказ/почта/магазин/demo/подпись проверяются.
  `sum=790` рассматривается как RUB учёт данного фиксированного заказа на
  основании наблюдаемого уведомления; собственный курс не вычисляется.
  Валютные исходные сумма/код входят в fingerprint повторов. Боевой RUB guard
  и прежние RUB receipt hashes не изменены; неизвестные валюты отклоняются.
- 79 целевых native/SQL/runtime/compiled проверок прошли, full 1816 pass /
  760 reported skips. RED воспроизводит EUR отказ; mutation доказывает проверку
  изменённого валютного повтора. Типы, сборки, API/границы/lint/docs проходят.
  Одноразовый owned tmpfs MySQL удалён, рабочая БД не была тестовым fixture.
- Пользователь отдельно подтвердил повтор **уведомления** существующей demo
  оплаты. Попытка № 3 вернула `200/success` в 01:35:50 МСК. Read-only SQL
  подтверждает paid, единственную квитанцию 79000 копеек и 30 дней доступа
  до **8 ноября, 01:35:50 МСК**. Outbox помечен отправленным в 01:36:15 МСК,
  одна попытка, без ошибки. Входящая почта пользователя не читалась.
  Новая оплата, ручная выдача доступа или поддельное уведомление не выполнялись.
- Это фактическая проверка **EUR Open banking**, не всех банковских методов,
  реальных денег или рекуррентных списаний. Остальные варианты проверены только
  локальными контрактными тестами; вход в оплаченный аккаунт в браузере ещё
  должен подтвердить пользователь. Старый текст frontend про автосписания
  по-прежнему неверен для TEST — это отдельная незавершённая правка.

Для отката только валютной версии вернуть защищённый
`prodamus-test-release.pTkWSw/image-env.before-6987883` в
`prodamus-test-image.env` с правами 600 и повторить прежний Compose `up` только
для `prodamus-test` с `--no-deps --wait`. Старый versioned bundle сохранён.
Не откатывать SQL/выданный тестовый доступ, ключи или рабочие API/web ради отката
кода. Для полного отключения подключения использовать раздел отката выше.

## Успешный возврат Prodamus TEST — 9 октября, 13:33 МСК

По отдельному подтверждению пользователя исправлен только `urlSuccess`:
`/club?paid=1` вместо `/club`. Существующий frontend использует этот признак для
ограниченной повторной проверки серверного доступа, не для выдачи подписки.
Обычный/неуспешный `urlReturn` остаётся `/club`; подписанный webhook по-прежнему
единственный источник подтверждения оплаты. Frontend/API/web не обновлялись.

- Bundle собран из **прежнего deployed 6987883** плюс одна исправленная строка,
  без более поздних локальных refactors. Сборка неизменённого источника точно
  воспроизводит прежний SHA-256 `e6109672aed71a33cb83bcb51eb53ad9d5af36d8b5b2633e30d186bc19b85187`;
  diff двух bundle содержит только `urlSuccess`.
- Новый файл `prodamus-test-release.pTkWSw/prodamus-test-6987883-paid-return-b62ea8d.mjs`,
  SHA-256 `b62ea8d0d79c77d58b5b6f84a903950a4712eada3fb2ca5718ddf318bd7e0e0d`.
  `PRODAMUS_TEST_RUNTIME_IMAGE` не изменён:
  `sha256:4b4a7e2c26d33c72b11952846b43c112aed4b7bb7345ce2e9fc51492dc1680d6`.
  В `prodamus-test-image.env` изменён только bundle path. Прежний файл сохранён
  как `prodamus-test-release.pTkWSw/image-env.before-paid-return-b62ea8d`, права 600.
  Ключи, кабинетный callback, конфиги nginx, квоты и сети не менялись.
- Только `prodamus-test` пересоздан с `--no-deps --wait`, старт
  `2026-10-09T10:33:20.233931496Z`, container ID `c101b153fb6b`, restart=0/OOM=false.
  Все шесть остальных container ID сохранены; семь сервисов healthy.
- 15 HTTPS проверок прошли: страница `/club?paid=1` и launch-config 200,
  unsigned webhook 400, GET 405, чужой Origin 403, cookie/query 400, тип 415,
  размер 413; live webhook, browser return, `/api/pay/`, checkout batch остаются
  503; GET checkout 405/пустой checkout 400. Новая ссылка в уже открытом provider
  tab содержит исправленный success URL. Оплата/уведомление не инициировались.
- 100 целевых локальных проверок, включая 52 native SQL, проходят и на текущем
  исходнике, и на узком архивном источнике выкладки. Дополнительно повторены 52
  SQL на финальном архиве. Full 1890 pass / 808 opt-in skips, types/TEST build/
  API/boundaries/lint/docs проходят. Одноразовый owned tmpfs MySQL и его сеть
  удалены; рабочая база не была fixture. Native audit остаётся 51 advisory
  (1 critical / 20 high / 26 moderate / 4 low); прежнее TEST исключение не является
  разрешением production и не снимает dependency gates.

Для отката **только этой строки** вернуть `image-env.before-paid-return-b62ea8d`
в `prodamus-test-image.env` с правами 600 и повторить прежний Compose `up`
только для `prodamus-test` с `--no-deps --wait`. Старый bundle сохранён. Не
откатывать SQL/доступ, другие контейнеры, ключи или кабинетные настройки.

Ошибки СБП `MNT_ID` и карточного GPB «Не удалось получить ответ от сервера»
не считаются исправленными: свежая успешная оплата после этой выкладки не
проверялась. Уже созданные provider links не переписываются; не советовать новую
оплату только ради адреса возврата. Старый sandbox diagnostic `/club` без paid=1
по-прежнему отличается от этого отдельно разрешённого TEST-entitlement flow.

## Возврат гостя после TEST оплаты — 10 октября, 01:20 МСК

Пользователь явно подтвердил push в staging и обновление dev, предоставив
руководство и доступ. Exact dev target проверен: `edem@155.212.216.16`, hostname
`teamassist-dev`; существующий ключ совпадает с предоставленным public key,
StrictHostKeyChecking сохранён. Production не затронут. Прежняя ошибка alias
не была недоступностью сервера; используется проверенный адрес из руководства.
CI выполняет проверки, но сам по себе push сервер не обновляет.

- В staging обычным push опубликован `149f701`, затем исправление
  `595d4a0ad0066c369c6147bc4b4d0cf2cd03282e`; remote SHA проверен. Входящих
  frontend commits после refetch не было; force push/повторный merge не нужен.
- Проверка выявила реальную ошибку frontend: result reader не передавал
  обязательный UUID `Idempotency-Key`. Первая выкладка откатилась на здоровую
  предыдущую версию, затем RED воспроизвёл 400 настоящим frontend request через
  локальный Nest HTTP. Минимальная правка передаёт UUID уже проверенного order
  reference; повторы остаются в одном прежнем quota bucket. Двенадцать чтений
  принимаются, тринадцатое получает 429. Серверные квоты/подписи не изменены.
- Итоговый code release `595d4a0`, image `daryadarcy-staging:595d4a0`, amd64 ID
  `sha256:662bdc85b32d49fcd5c2cb6feb9651b067eea7165ba1271b25e79956a3810cd9`.
  Frontend собран локально с явным Prodamus TEST и выключенным YooKassa TEST.
  Linux зависимости сохранены из проверенного предыдущего image; npm install,
  обновление lockfile и тяжёлая компиляция на shared dev не выполнялись.
  Штатная локальная сборка после упаковки восстановлена и проходит.
- Backend bundle SHA-256
  `2140f0f8825442b3f9e346766e4fbc497c83e9da283b46b153788c9105550080`;
  TEST bundle `46a3c85e8f0c665ef1f6b174b7768b664e754fe6b5efe25d5b1f805f391b1c4e`.
  Исправленный frontend archive SHA-256
  `d4d39a8a1e6f75940c76f72c67a896aa8509afe28c4cef0c9f7460233ab5b757`.
  Перед запуском проверены digest/path bounds, no-network Linux/native WebP/
  dependency/API и compiled TEST runtime probes без БД/SMTP/worker jobs.
- Защищённый release directory:
  `/home/edem/apps/daryadarcy-staging/release-595d4a0.4nmLwU`.
  До переключения сохранены конфиги/host nginx/container identities/counts и
  `before.sql.gz` (600): проверены gzip completion и 29 CREATE TABLE. SQL dump
  не выводился/не скачивался/не восстанавливался; restore SQL не тестировался.
  Схема и зависимости относительно прежней версии неизменны; миграций нет.
- Пересозданы только `api`, `web`, `prodamus-test` с `--no-deps --wait`. TEST
  dependency image остаётся прежним pinned SHA; заменён versioned no-worker
  bundle. Семь сервисов healthy; три новых restart=0/OOM=false. Все прочие
  container ID/start times и SQL counts сохранены. Provider/SMTP/mysql/video
  secrets/configs, auth, сети, CORS/proxy trust и quotas не изменены.
- Открыт только exact **POST `/api/prodamus/test/result`** в host и edge nginx:
  64 KiB, 30 секунд, прежний host rate limit. GET 405, неверная форма/query/cookie
  400, чужой Origin 403, тип 415, размер 413. Live webhook/return и прочие
  payment routes остаются закрыты. Внутри restricted runtime запрещённые
  методы/пути дают 404; это намеренно отличается от внешнего nginx 405/503.
- Свежие проверки: 1997 unit pass / 840 opt-in skips, 74 focused, 11 browser,
  types/E2E/lint/API/boundaries/docs и TEST/обычная сборки, native TEST/обычный
  режим проходят. 13 HTTPS guest/catalog/access smoke и 8 result transport
  checks проходят. Настоящий deployed Chromium 390 px без interception получает
  `200/unknown` для заведомо неверного proof, отправляет UUID без cookies,
  очищает fragment и не показывает ложный успех/доступ. SQL только read-only
  catalog/counts/backup, не acceptance fixture; новая оплата не инициировалась.

Откат к прежней API/web/TEST версии и прежним exact routes:
запустить `python3 /home/edem/apps/daryadarcy-staging/release-595d4a0.4nmLwU/rollout.py rollback`
на проверенном dev. Скрипт восстанавливает только `.env` image tag,
`compose.override.yaml`, `prodamus-test-image.env` и два nginx config из защищённых
копий, сохраняет inode bind-mounted edge file, проверяет/reloads nginx и запускает
те же три сервиса. Не восстанавливать SQL, не менять ключи или чужие проекты.
Первый code/config rollback фактически прошёл; новая SQL restore не проверялась.

Ограничения: checkout уже создаёт passwordless email row; только подписанное
settlement выдаёт TEST доступ и ставит письмо в outbox. Возврат не создаёт сессию
и не является доказательством оплаты. Новая фактическая guest/provider оплата,
доставка письма и вход пользователя ещё не подтверждены этим rollout. Старые
links без proof не переписываются; не просить платить снова только ради ссылки.
СБП MNT_ID и GPB ошибки провайдера остаются открыты. Native audit по неизменному
lockfile: **51 advisory (1 critical/20 high/26 moderate/4 low)**; прежнее узкое
TEST исключение/review до 13 октября сохраняется, не production-разрешение.
Кабинет Prodamus, повтор уведомления, отправка/повтор письма и платёж не выполнялись.

## Code-only обновление staging/dev — 10 октября 2026

На явный запрос «обнови стейдж и серв» проверены чистая feature-ветка и свежий
remote. Входящих remote-only staging commits нет; девять локальных commits
сохранены обычным fast-forward `ac7c471..2e3339c`. Normal push принят, exact remote
SHA `2e3339c16efa1a45fb4de85c2ecf1c7d9ab5dc24` проверен. Evidence commit после
этой выкладки меняет только документацию; code image остаётся `2e3339c`.

- Свежий полный serial regression на **новом собственном** MySQL 8.4 tmpfs:
  **2949 pass / 0 fail / 30 external opt-in skips**, 194 файла. Types/E2E types,
  lint, API (73 procedures/25642 bytes), boundaries (588 files), docs (53) и
  whitespace проходят. Archived HEAD: backend и restricted TEST bundles,
  frontend 28 pages с явным Prodamus TEST=true/YooKassa TEST=false. Browser:
  2 statistics recovery и 11 TEST-return scenarios прошли без skips на явном
  TEST build. Использован существующий Chromium, без установки браузера.
- Exact dev `edem@155.212.216.16`/`teamassist-dev`, штатный SSH ключ из
  предоставленного руководства; проверка host key не отключалась. Release
  `/home/edem/apps/daryadarcy-staging/release-2e3339c`, image
  `daryadarcy-staging:2e3339c`, amd64 ID
  `sha256:cb5c7404fa279ed369ef35829a8fa542d08677be07ed8609360cadfa0c4af166`.
  Native Linux dependencies сохранены из `595d4a0`; lockfile не менялся,
  пакеты/Next не обновлялись. Новый небольшой image собран offline на прежнем
  pinned base, предыдущая версия сохранена для отката.
- Verified archive SHA-256
  `5d94b5b0a1fc64f50fa87efa656732d448395682f6865be8ca3ec99260afb5f1`;
  backend `c2c493ffda293ff914deb6592d11a2d02c6cbccb5baabfee98c67f4a4bea45b9`;
  TEST `b16a080c0a5679a7ddc3a63a08135a312a62456dc3e53b7709f086903aa14227`.
  Archive содержит только build artifacts/Dockerfile: path bounds/types/digests
  проверены. Изолированный Linux container без сети/БД/SMTP/настоящих ключей
  подтвердил native WebP, Next pages, TEST mode/result и закрытые transport paths.
- До переключения: защищённые snapshots конфигов/nginx/container identities/
  SQL counts и `before.sql.gz` (600); gzip completion/29 CREATE TABLE проверены.
  Dump не выводился, не скачивался и не восстанавливался. Миграции **0027/0028
  не применялись**, migration-history gates не обходились. Внутренний binding
  request/confirmation не зарегистрирован в HTTP/worker, admin form не включена.
- Пересозданы только `api`, `web`, `prodamus-test` с `--no-deps --wait`. После
  смены IP первая внешняя проверка обнаружила 502: edge nginx ещё обращался к
  старым Docker addresses. Actual DNS и refused upstream подтвердили причину;
  штатный `nginx -t`/reload обновил workers, **без изменения конфигурации**.
  Тот же reload включён в сохранённый code rollback после recreation.
- Повторная внешняя проверка: **13 HTTPS guest/catalog/access smoke**, **8 TEST
  result transport cases** и настоящий deployed Chromium 390 px без interception
  проходят. Invalid proof даёт 200/unknown, UUID quota header без cookies,
  очищенный fragment и отсутствие ложного успеха. Это не успешная оплата.
  Семь сервисов healthy; три новых restart=0/OOM=false. SQL counts, все прочие
  container IDs/start times, host/edge nginx и неизменённые env/config bytes
  сохранены. После сборки на диске 3,6 ГБ; shared images/чужие ресурсы не удалялись.

Code-only откат:
`python3 /home/edem/apps/daryadarcy-staging/release-2e3339c/rollout.py rollback`.
Он возвращает только три image/bundle config файла, прежние API/web/TEST и
перезагружает edge workers. Не восстанавливает SQL, ключи, nginx config или
чужие проекты. Этот новый rollback подготовлен/проверен по исходникам, но не
выполнялся: после DNS reload выкладка здорова. SQL restore не тестировался.

Собственный local fixture `daryadarcy-staging-release-20261010` проверен по exact
ID/label/tmpfs/no mounts и остановлен; `--rm` удалил только данные тестового
запуска, восстановление их невозможно. Task-label inventory пуст. Рабочая БД
не использовалась как fixture и не очищалась.

Открыты прежние gates: binding delivery/lifecycle/deletion/HTTP/админка и его
schema rollout, новая реальная provider/SMTP/user acceptance, СБП MNT_ID и GPB
ошибки. Native audit на неизменном lockfile: **51 advisory (1 critical/20 high/
26 moderate/4 low)**; прежнее узкое dev TEST исключение не production-разрешение.
Ни платёж, ни повтор уведомления/письма, ни provider cabinet change не выполнялись.
