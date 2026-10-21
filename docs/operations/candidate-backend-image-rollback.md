# БД-кандидат: backend artifact и откат приложения

## PASSWORD — узкий API-only выпуск22 октября2026

По прямому разрешению выпущены новый экран установки/восстановления пароля
в стиле приложения и HTML-anchor в письмах доступа. Source/staging
`44421b1f370839b68f6648b743320fd1e3415908`, поверх свежего37b790f.
Отдельная release-ветка переносит только эти identity изменения и их тесты;
накопленные local contact/PWA/frontend правки основной ветки НЕ выпущены.

- API image `sha256:243e72d439080e975a7bd44d8db96ecb969806639b196232c7626784aad7a72c`;
  bundle SHA `7056519f7d92de77cefcdb96cd49c80acc50eaa76c326b8ff5734644e0896f5e`.
  Собран поверх проверенного99ada7f1… без установки зависимостей.
- Изменён только image API в compose.override.yaml. Web/TEST/SMTP/S3/flags/
  limits/config и29 остальных контейнеров прежние. Edge config test/reload
  без изменения файла. API healthy/restart0/OOMfalse.
- Та же БД daryadarcy_candidate_20261019, UUID2a41f961-c168-11f1-8660-0a4124b25f9f.
  Schema/history42/counts40 tables и digest credentials всех3 admins (включая
  id1/554) до/после совпали. Пароли/сессии не сбрасывались, миграций нет.
- Fresh single-transaction backup356398 bytes/40 tables,
  SHA `c108faedd33c10b943a5040eab021f2422aeb5792824a6787022ed60bc9ca1c6`;
  server+Mac copies проверены gzip/SHA, private files0600/parent0700.
  Pending mail/binding/scheduled/deletion/billing/shopMail перед restart все0.
- Local35 browser/HTTP/SMTP/worker tests, types/backend build GREEN.
  Native offline probe3 HTTP, no workers/providers; HTML anchor присутствует
  в actual image artifact. Public HTTPS8 checks: password/login/guest auth/
  capabilities,3 fonts иpaper asset200; nonce/no-store/no-referrer сохранены.
  Живой браузер подтвердил новый стиль, сообщение без token, форму с synthetic
  fragment (очищается из URL), переключатель показа пароля. POST не выполнялся.
- Первая build попытка остановилась на неверном синтаксисе local image ID;
  исправлен Dockerfile на проверенный локальный tag. Затем исправлена только
  проверка escaped Unicode в probe. Runtime до успешных gates не переключался.

Private receipt/operator/server+local backup:
`/home/edem/apps/daryadarcy-staging/release-password-20261022.0vPXBI`;
Mac workspace `.local-artifacts/release-password-20261022.0vPXBI`.
Rollback: после проверки отсутствия drift выполнить `rollout.py rollback`
из этой серверной директории. Возвращает только старый API image99ada7f1… и
reload edge; не восстанавливает/очищает SQL. Старый образ и backup сохранены.
Новый rollback не выполнялся, процедура проверена по коду.

Внешних писем в rollout не отправляли, реальный пароль не меняли. Клик и
сохранение через новое письмо на устройстве ещё нужно подтвердить пользователю.
Старые письма не изменяются. TEST-оплата и весь договор этим выпуском не приняты.


## INTEGRATED — совместный выпуск21 октября2026

По прямому поручению пользователя соединены frontend/backend, выполнен normal
push в origin/staging и реальное обновление dev. Код/source image revision:
`e8ea7f54291c96ea7f529643a5a3257974575f9a`. Следующий docs-only commit записывает
этот receipt и не требует новой пересборки. Свежий staging39e66a2 уже был в ветке;
ручных CSS/design правок нет, изменения фронтендера сохранены.

### Что вошло и что проверено

- Все накопленные backend fixes Pen Pals/object access/lifecycle, legacy upload
  retirement, explicit publicCover, disabled push/input/quota, durable cancel
  state, profile/public DTO, content dates/sort/body и bounded Base64 handling.
  Pen Pals/webPush не включались; пределы памяти/файлов не менялись.
- Frontend: cover purpose только для публичной обложки, regenerated API90,
  strict cancellationStatus parser/context/controller/profile. Pending виден
  после reload/expired access; check читает, не дублирует mutation; account
  scope/lost-response guards сохранены. Служебный доступ/owner labels прежние.
- RED8 parser/RED2 actual provider; cover RED1 на предыдущей сборке; после
  fresh build37 parser/4 provider/64 Playwright GREEN. API ответы браузерных
  платежных сценариев контролируемые, не настоящий Prodamus.
- Root3057 pass/1586 opt-in skips, types/frontend lint/check:api90/boundaries722/
  docs68/diff GREEN, production dependency audit0. Production Next29 routes и
  оба backend bundles собраны; отдельная release сборка сохраняет TEST=true.
- Server native offline17 (api6/web7/restricted TEST4), node non-root/amd64,
  no providers/workers/network в probes;1615 Next/public files byte-exact.
  Новые образы построены offline поверх проверенных текущих immutable bases,
  без network dependency install. strtok3 уже находился в runtime transitively;
  actual backend bootstrap прошёл. Package/schema изменения не спрятаны.
- Public HTTPS53: auth guest, capabilities,22 VK/19 covers/3 null, pagination,
  hidden legacy YouTube, VK playback metadata, guest Library denial, push403,
 6 pages/35 новых JS byte-exact. Это не playback со звуком/fullscreen.
- Deployed API loopback14 с краткоживущей cookie существующего admin/epoch2:
  REST/tRPC public DTO, cancellationStatus=none, owner access, posts pagination,
  calendar на дне существующего поста, missing detail null,4 winter bindings,
  missing-purpose/dates/fraction400, legacy404. Файлы из S3 не скачивались.
  Реальные cancel/logout/payment/upload/почта не вызывались. Подписанный token
  и JWT secret не выходили из памяти контейнера, новый аккаунт не создавался.

### Артефакты и текущее окружение

- API и restricted TEST:
  `sha256:99ada7f1d3eaf5bccc44596ff29595187350192f623267259dd0b7ee9a6253db`
  (`daryadarcy-backend:integrated-e8ea7f5`).
- Web:
  `sha256:f19115f1e28c24b4c402597864b8b23d792116118f6f8278df5495f3d9c9088a`
  (`daryadarcy-frontend:integrated-e8ea7f5`).
- Frontend BUILD_ID `Izh-kkFmKfvnGdUW6lxdd`.
- API bundle SHA `601b552ed7e2e3cafe3367d2bbec62df343c38392eed0d72b453e069ff74bea9`;
  restricted TEST bundle
  `d8a4a418d6a7ee0daab1926798530ef2220b6da7c657eaf6f777d1f3bd1e9272`.
- Artifact29898405 bytes, SHA
  `b8ef59d39b88d833ffd5776f334d1aba257fadd7d1f344858e08926f230e1403`.
- Только api/web/prodamus-test пересозданы: healthy, restart0, OOMfalse.
 27 остальных контейнеров (включая DB/edge/другие проекты) не меняли ID/image/
  start state. Edge выполнен config test +reload, не restart.
- Разрешённый config diff:3 image IDs и путь readonly mount TEST bundle.
  Env/JWT/S3/SMTP/DB URI/flags/limits/networks прежние. Сохранились frontend
  TEST=true, club test checkout=false, VK/normal recovery/thumbnails=true,
  frontend private Library=false; runtime private flags прежние true.
  Recipes/Petersburg/старые публичные sources не переносились/не закрывались.
- DB `daryadarcy_candidate_20261019`, UUID
  `2a41f961-c168-11f1-8660-0a4124b25f9f`, тот же DB container3442fbda….
 40 tables/42 migrations byte-digests схемы/history, row counts и videos digest
  до/после совпали; admin id1/email/password digest/role/epoch2/blocked state
  сохранены. Обычные авторизованные чтения обновляли lastSignedIn; не объявлять
  весь SQL data dump byte-identical или новый вход прежним паролем проверенным.
  Старую source DB и историю0017–0019 не исправляли. Миграции не выполнялись.
- Before-side-effect guard: unsent mail/binding, scheduled/deletion,
  billingProfiles/shopMail все0. Fresh single-transaction gzip backup40 tables,
 355586 bytes, SHA
  `4cc8371912bdc3eecec5190cf11bf67479bb7af8727c6e701cfb2a5bf303f96a`.
  Серверная и Mac копии проверены SHA/gzip/table count, file0600/parent0700.
  Это не новая restore drill (предыдущие restore evidence сохраняются).
- Private receipts/operator/before config/backup на сервере:
  `/home/edem/apps/daryadarcy-staging/release-integrated-20261021.nA06Qc`;
  локально workspace `.local-artifacts/release-integrated-20261021.nA06Qc`.
  State `accepted`, native.json/live-public.json/live-admin.json/local-backup-
  verified.json. Секретные before config в Git не входят.
  После выпуска server free2.2GiB, available RAM754MiB, swap0.

### Диагностические ограничения и откат

Из API container public host дал DNS EAI_AGAIN, а loopback3000 —200; публичный
HTTPS с server host — GREEN. Сеть/DNS не расширяли ради проверки. Поэтому
auth checks не выдаются за public HTTPS/browser acceptance. Уточнены только
probe assumptions: lastSignedIn меняется при auth read, owner compatibility
subscribed=true (не доказательство оплаты), календарь опускает пустые дни.
Product code/данные ради зелёного smoke не менялись. Первый apply остановился
до config changes guard'ом отсутствующей локальной backup receipt; после
исправления SFTP copy и SHA-проверки выполнен apply. Никакого bypass не было.

Rollback images сохранены: API/TEST
`sha256:d602803efec7286aa04a8a3ff4c6d3ef02b6da842bb0b47952d7e544e4e6d576`,
web `sha256:7bee80492b73ba7717162946cb19eb7ac3d5cbbf4e6e21fe17b009274c2a4312`.
При новом разрешении на откат: проверить отсутствие новых DB/config изменений,
сверить snapshot/backup, выполнить `rollout-images.py rollback` из указанной
private release directory. Оператор сверяет текущие/before/after config SHA,
восстанавливает только3 config files и3 app images/TEST mount, reload edge,
ту же БД не восстанавливает/не очищает. При drift STOP, не ослаблять guards.
Базы, образы отката, backup и чужие файлы в выпуске не удалялись.

Memory gate32/80MiB при API512MiB, настоящие provider/S3 acceptance,
mobile/pilot и закрытие старых публичных копий этим выпуском не закрыты.
Не обещать готовность всего договора или реальных автосписаний по этим checks.

## U1-MEM3 — bounded signature worker transport,21 октября2026

Scope прежний: backend locally, owned loopback/tmpfs backend_test, новые явно
synthetic S3 objects. Исходно clean6a00a14 и прежняя feature branch. Frontend,
working DB/admin/runtime/старые S3 не менялись; no push/deploy/flags/limit change.
Применены systematic-debugging/TDD/incremental/security/API-design/review и
verification skills. После третьего узкого среза общий memory gate остаётся
открытым: не добавлять четвёртый фикс наугад, сначала обсудить архитектуру/
нативное Linux resource environment и фактические HTTP allocations.

### Диагностика80MiB и новая передача байтов

Temporary diagnostic artifact на коде до нового worker: policy200/1002ms,
HEAD404/216ms, PUT80MiB200/9048ms, HEAD200/168ms. В SQL готовый receipt; никаких
provider messages/credentials/URLs/payloads в diagnostic logs, только stage,
elapsed/status и allowlisted error categories. Прежняя503 не повторилась и её
точная причина не объявлена найденной. Peak536764416 bytes (511.90MiB), events0/
OOMfalse/restarts0: STOP без дальнейшего replay; собственный object удалён и
свои API/relay/tmpfs DB убраны по guards. Diagnostic hooks в product не вошли.

RED нового среза: workerData содержал полный input вместо requested owned range.
GREEN: unchanged file-type22.1.1/fileTypeFromTokenizer + random-access tokenizer
из strtok3.AbstractTokenizer; он может читать весь файл/seek, не только prefix.
Parent проверяет целочисленные offsets/lengths, exact source bounds и64KiB max
на ответ; отдельный transferable Uint8Array не detaches/mutates storage Buffer
и не раскрывает его pooled neighbours. Это ограничивает дополнительную копию
при передаче, не весь HTTP body/JSON heap или общую очередь запросов.
One-active-slot,5s timeout, worker heap caps/env/execArgv и awaited teardown прежние.

strtok310.3.5 уже стоял в resolved graph file-type; он объявлен direct runtime
dependency с той же точной версией. Package records до/после byte-equivalent по
parsed lock data, package versions/integrities не менялись. Менеджер нормализовал
5 ESLint peer snapshot references, без frontend source edits. Initial offline
add отказал из-за отсутствующей metadata, первый registry attempt timeout;
ограниченный fetch concurrency/prefer-offline завершился, scripts disabled.
`pnpm install --lockfile-only --frozen-lockfile --ignore-scripts --offline` GREEN.
Не было ручной правки lockfile или forced audit remediation.

Native macOS Node23.10 detector-only80MiB profile:224496→143344KiB maxRSS
(219.23→139.98MiB),64→32ms в одном измерении. Input/result неизменны, forced GC
нет. Это подтверждает удаление полной worker copy, не native API SLO/полный
service peak; variance/parallel uploads/сложные большие архивы не приняты.
Два созданных только для этого generated profile modules удалены из own temp
directory; source/profile JSON сохранены вне Git.

### Full API512MiB: результат не засчитан полностью

Тот же runtime image d602803e…/Node22.23.3, isolated API512MiB/CPU0.4/no swap/
read-only и fresh tmpfs backend_test42. Candidate bundle
`eb723a4fb7394d17ad8698899ed9e9b30ce7f36cff4d1a2f82a950c2db065933`.
Mac Docker Desktop/linux-amd64 emulation, клиент вне cgroup. Production boot
без forced GC/NODE_OPTIONS; read-only backup directory останавливает backup
до внешних writes/pruning. Native staging resource acceptance не заявлена.

Два preflight timeouts до SQL/S3 fixtures. Direct public curl с Mac: TCP/TLS0,
timeout12s; с staging read-only public HEAD200/0.305s. SSH только для этого
network check, сервер/config/БД не менялись. После сообщения пользователя о VPN
подключении маршрут восстановился. Empty users/private ledgers проверены перед
preflight retry, исходные failed reports сохранены, не заменены задним числом.

- Warm article32MiB: oversize+1→413/ledger unchanged; valid upstream200 ACK lost,
  ready SQL/storage. Peak403197952 bytes (384.52MiB)>384 gate: STOP до bind/read.
- Fresh repeat article32MiB: тот же boundary413/ready, peak411279360 bytes
  (392.23MiB)>384 gate: STOP. Оба own article objects точно удалены.
- Независимый fresh raw series:16/32/64MiB upload/status/replay/один ledger/bind/
  full SHA256 GET/HEAD/Range и guest404 GREEN. До64MiB peak347418624 bytes
  (331.32MiB).80MiB+1→413, нового intent нет. Valid80MiB upload200, SQL ready/
  ETag/size83886080 подтверждены; peak403001344 bytes (384.33MiB)>384 gate.
  STOP до status/replay/bind/read80MiB. Events max/oom/oom_kill0, OOMfalse/
  restarts0. Полный80MiB flow НЕ принят, даже несмотря на успешный первый PUT.

Все7 новых ready S3 objects убраны: metadata/ETag/IfMatch/HEAD404 guards,
policy SHA0484dfa2… и versioning off прежние. Собственные API/relay/tmpfs DB
удалены по ID/name/label/image/mount guards; original3 stopped containers прежние.
Нет операций с working DB/admin/frontend/old objects/SMTP/payments/live limits.

### Regression verification и границы продолжения

100 focused tests/6 suites GREEN: real worker/compiled ESM/tsx, invalid ranges,
exact chunk/end bounds, unchanged source bytes, EOF/random access beyond prefix,
deadlines/errors/awaited serialization и прежний HTTP/decoder contract.24
application/entrypoint tests GREEN. Native SQL first partial-schema fixture:
201 pass/1 default5s timeout при lost DELETE ACK плюс missing push table logs.
Новый fixture bootstrap полной fresh42 схемы и только testTimeout20s дал202/202
в3 suites/30.16s; продуктовые10s SDK timeouts не менялись. Test-only migration
markers отражают уже проверенную fresh42 схему, __drizzle_migrations вручную
не менялся. Один промежуточный fresh preflight отказал wrong own name prefix;
создан новый fixture с разрешённым name/label, guard не обходился. Все свои SQL
containers удалены, исходный Docker container inventory совпал.

Types/backend build/check:api90 procedures35404 bytes/boundaries713/Prettier
GREEN. Direct ESLint exit2: root/backend flat config отсутствует; root lint
запускает только frontend. Backend lint GREEN не заявлен, новый config не добавлен.
После форматирования final bundle
`03a3fac971e3af87ab89e7d6be1c26117f816e1f5abb55610ef833d78467dbf6`;
diff с E2E artifact — formatting только. Canonical esbuild minified code совпал:
SHA `b59364b62875ae4187498eac8375933cd5ed086de651d118b514bc7f7afd5cd3`.
Final100 tests/types/SQL проверяли formatted source, повторные heavy E2E ради
whitespace не запускались. Публичные API и generated frontend snapshot прежние.

Reviewed product/test/dependency change сохранён локально499e0ab. Docs64/diff
check GREEN, frontend source diff0; push/deploy нет.

Evidence от workspace вне Git: `.local-artifacts/upload-followup-20261021.7Cogk4`
(diagnostic80) и `upload-range-20261021.F8JdsT` (attempt reports/guards/cleanup/
profile/operator/SQL evidence). Raw state/config/fixture identities не публиковать.
На завершении свободно718MiB на Mac: дальнейшие heavy fixtures только после
disk preflight>=2GiB. Новая широкая очистка не выполнялась, shared caches/
images/DB/чужое не удалялись. U1-MEM не закрыт; следующий архитектурный выбор
обсудить с пользователем, не менять request/quotas/timeouts автоматически.

## U1-MEM2 — Base64 investigation и повтор512MiB,21 октября2026

Область: локальный backend, свои disposable backend_test/tmpfs и новые synthetic
S3 keys, без live limits/SQL/admin/frontend/старых objects/push/deploy. Ветка
feature/stage-one-completion-2026-10-10, исходно clean8507e11. Применены systematic
debugging/TDD/incremental/security/review/verification skills. Нет dependency,
public API/schema/feature/role/quota changes; frontend generated contract прежний.

### Причина и минимальные изменения

Native decoder profile на33554433 bytes: старый decode+canonical re-encode
maxRSS156192KiB/external124266285 bytes, новый strict preallocation ceiling
maxRSS112160KiB/external45972608 bytes/413. Это отдельный Mac process, не API SLO.
Строгая canonical проверка теперь проверяет alphabet/padding/unused tail bits,
а decoded length — до Buffer.from. Прежние400 для malformed и413 для valid
oversize сохранены. Фото pipeline/quotas/formats не перепроектировались.

Decoder-only patched runtime на512MiB всё равно достиг memory cap до дальнейших
payloads. Отдельный instrumented bundle подтвердил установленный tRPC11.8 path:
Express JSON.parse→adapter JSON.stringify(req.body)→WHATWG Request.json/parse.
При44739456 chars: RSS299MB после первого parse,344MB после stringify,433MB
после concat,460MB после второго parse ещё до decoder. Sources:
node_modules/@trpc/server/src/adapters/node-http/incomingMessageToRequest.ts
и unstable-core-do-not-import/http/contentType.ts. Instrumentation только во
временном probe, в tracked production code monkeypatch/forced GC нет.

Media POST со standard UTF-8 application/json теперь пропускает Express JSON и
urlencoded preparse, но только после прежних feature/auth/role admission.
createExpressMiddleware получает maxBodySize52428800 bytes; Content-Length guard
и native reader chunked guard сохраняют50MiB потолок. Другие charset/compression
идут прежним Express fallback. Общие256KiB/auth16KiB/photo6MiB/raw80MiB без changes.
SyntaxError превращается в generic400, не отражает фрагмент приватного body.
Для chunked oversize используется стандартная tRPC413/PAYLOAD_TOO_LARGE envelope;
для заранее известного oversized Content-Length прежний generic413.

RED: старый decoder игнорировал decoded ceiling; старый HTTP path делал2 parse
вместо1. GREEN:6 focused suites91 tests, application/entrypoint/lifecycle29 tests,
TypeScript/backend build/check:api90 procedures/35404 bytes. HTTP checks реальны,
но account/activity SQL substitutes; это не SQL/S3 E2E. Они покрывают chunked
50MiB+framing413, identity/role/feature refusals, exact max envelopes/extra byte,
invalid JSON/nonobject400/no echo, UTF-16 и gzip fallback. Full SQL suite и весь
договор не заявлены закрытыми.

### Новый isolated runtime

Exact image d602803e… + final backend bundle
`1257b2904bbf4a05f824c8263b9a956b36cd9433e94fb292ef7ab5d1c625e142`,
SHA совпадает с normal backend build. API512MiB/memory-swap512MiB/CPU0.4/read-only,
one read-only bundle bind; own fresh MySQL8.4/tmpfs backend_test/42 migrations,
loopback-only ports. Mac Docker Desktop linux/amd64 emulation; client вне API
cgroup, без NODE_OPTIONS/forced GC. Нет SMTP/payment fixtures; backup worker
refuses read-only backups directory before S3 upload/prune. Это не rollout.

Первый финальный preflight через прежний SSH relay timeout до actor/ledger/S3
fixtures: master socket исчез. Direct Timeweb TLS/политика200 проверены, новый
API recreated только в собственном fixture с original endpoint/cert validation.
Это изменение тестового маршрута, не server config. Policy SHA0484dfa2… прежний,
bucket versioning off, старые object/list операции не выполнялись.

- Первый direct run: article TXT33554432 bytes→upload upstream200 ACK lost,
  status/replay stable/один asset/bind/full SHA256 GET/HEAD/Range/guest404 GREEN;
  +1 byte413 до SQL intent. Peak368795648 bytes (351.71MiB), max/oom/kill0.
  Post document upload/status/replay прошли, но createPost500: helper передал
 47-char marker в source varchar32. Только fixture исправлен source=manual;
  это не найденная ошибка Base64 upload. Both own objects точно удалены.
- Новый fresh run тем же bundle:32MiB+1→413/пустые ledgers; на valid article
  peak406982656 bytes (388.13MiB), выше384MiB gate. STOP, max/oom/oom_kill0,
  OOMfalse/restarts0; единственный новый asset точно удалён. Серия32MiB не
  повторяемо принята. Не выбирать удачный первый run и не ослаблять gate.
- Первый raw-only run:16/32MiB GREEN, на full read64MiB HTTP503; cleanup получил
  SDK TimeoutError. Ledger сохранён до exact reconcile:3 own keys убраны,
  policy/versioning прежние, затем свои API/relay/tmpfs DB удалены. Это не memory
  gate, причина503 не выводится из одного статуса.
- После восстановления metadata connectivity fresh raw-only repeat:
 16/32/64MiB upload/status/replay/один ledger/bind/full SHA256 GET/HEAD/Range/
  guest404 GREEN. Peak до64MiB351883264 bytes (335.58MiB).80MiB+1→413, нового
  ledger нет. Valid83886080 bytes→503 на storage stage, durable ledger pending,
  etag/mediaId нет. Без instrumented SDK trace точная причина503 не установлена:
  не приписывать её OOM/лимиту размера/провайдеру. Peak401891328 bytes
  (383.27MiB), max/oom/oom_kill0/OOMfalse/restarts0.80MiB full flow НЕ принят.
  Cleanup complete:3 ready objects deleted с owner metadata/ETag/IfMatch guards,
  pending key404 либо точный delete/HEAD404. Все own4 keys больше не существуют,
  policy/versioning прежние; API/relay/tmpfs DB удалены с ID/name/owner/image/
  mount guards. Original3 stopped containers неизменны; env/tunnel отсутствуют.

Итог U1-MEM2: code commits e70ec07 и041eff6 только локально. Полная повторяемая
Base6432MiB acceptance и raw80MiB storage flow остаются открытыми; metadata
connectivity200 само по себе не доказывает успешный большой PUT. Не менять
published cap/timeouts или ослаблять384MiB gate по этому результату.

Полная изолированная копия в signature worker остаётся: её простое удаление
сломало бы гарантию независимости storage bytes. Дальнейшая её переработка
требует отдельного малого доказуемого среза; текущая оптимизация не объявляется
полной memory acceptance. PDF/DOCX maximum, parallel load/playback/browser и
published nginx/native resource acceptance этими TXT/WAV/padded MP4 не доказаны.

### Очистка и evidence

Дополнительно к прошлой cleanup убраны только наши rebuildable release source/
generated contexts и tar archives1053927112 logical bytes. Проверены Git blobs,
archive manifests/SHA, UID/private parents/no symlink/open path/mount overlap;
1212 прочих files/config/backup/receipts и Docker inventory совпали. Две source
copies release-baaeb47 с отличающимися blobs сохранены. Старые runbooks, где
archive/context значился существующим, теперь исторические: operator требует
реконструкции из Git/retained manifests/images, а не запуска вслепую.

После очередного disk gate удалён только local `.next/cache/webpack`395317117
bytes: BUILD_ID YtXVGc0Hb8niy9-5rNFOG, нет active Next process;2244 остальных
frontend files сверены byte-exact. Cache восстановим сборкой. Дизайн/исходники,
БД/volumes/images/backups/credentials и чужие файлы не удалялись.

Evidence вне Git от workspace: `.local-artifacts/base64-memory-20261021.vds48I`
(decoder/profile), `base64-diag-20261021.LCOBNw` (diagnostic probe),
`base64-acceptance-20261021.SI92SP` (final attempts/report/memory/guards),
`local-cleanup-extra-20261021.nuzIdl` (cleanup fingerprints/receipt).
Raw configs/state/fixture keys не распространять. Первые isolated runs очищены
с exact ID/name/owner/image/mount guards, original3 stopped containers неизменны.
Проверки docs64/boundaries713/diff check GREEN. Published API256MiB/settings/DB/admin/frontend не менялись; разрешения на выпуск
или live resource change нет. U1-MEM остаётся открытым до всех resource gates.

## U1-MEM — isolated512MiB остановлен по memory gate,21 октября2026

Новая область разрешения: очистить только наши временные copies/cache, затем
изолированно проверить32/80MiB; live resource limits/data/admin/frontend/старые
S3 не менять. Убраны7 точных leafs:2 старых `.next/cache`,5 copies `public` в
private release contexts. Каждый public blob сверён с исходным Git revision,
parents0700/UID/non-symlink/open-path/Docker mount guards. Logical1582002758 bytes;
free2420482048 после cleanup.13011 прочих files/config/backup/receipts и весь
Docker inventory совпали. Copies воспроизводимы из Git, cache rebuildable.
Cleanup receipt/source: `.local-artifacts/local-cleanup-20261021.16bs8k`.

Published image `sha256:d602803efec7286aa04a8a3ff4c6d3ef02b6da842bb0b47952d7e544e4e6d576`
получен streaming Docker save/load без build/local archive. Тест: Mac Docker
Desktop8GiB/linux-amd64 emulation, API512MiB/CPU0.4/memory-swap512MiB (swap API
запрещён), read-only/cap-drop/no-new-privileges; отдельная own MySQL8.4/tmpfs
backend_test с42 свежими миграциями. Только loopback опубликованные ports,
клиент вне API cgroup; production boot, без NODE_OPTIONS/forced GC/моков API.
Read-only backups directory не позволяет boot backup дойти до S3 upload/prune;
worker backup refusal в этом fixture ожидаем, не скрытый успех резервирования.

Direct S3 connection с Mac timeout до fixtures. Own loopback SSH TCP tunnel +
отдельный64MiB TLS-byte relay сохранили original endpoint/signed Host/443/SNI
и реальную проверку сертификата Timeweb. Предварительный вариант endpoint18443
получил SignatureDoesNotMatch до fixtures; он не использовался в memory probe.
Policy hash0484dfa2…/versioning прежние. Никаких старых object GET/List/PUT/Delete.
Это не published HTTPS/edge/proxy/network acceptance, не browser/playback.

Первый probe — articleDocument33554433 bytes (32MiB+1): HTTP413, backend log
PAYLOAD_TOO_LARGE, обе private ledgers пусты. До следующего запроса watcher
зафиксировал `memory.peak=463937536` (442.4453125MiB), reserve69.5546875MiB.
Согласованный gate384MiB/резерв128MiB не пройден: STOP, без повышения budget.
max/oom/oom_kill0/OOMfalse/restarts0. Valid32MiB docs/audio, video16→80MiB,
ACK recovery/replay/bind/full read в этом режиме не запускались и НЕ приняты.
Результат под emulation не переносить как точный native RSS/утечку памяти.

Новых S3 objects0; cleanup подтвердил policy/versioning. Все свои API attempts,
relay и tmpfs DB убраны по exact ID/name/label/image guards; первая пустая DB
была пересоздана после отказа ownership guard, без обхода fresh installer.
Original3 stopped containers/image references/13 volumes сохранены, temp env и
SSH socket отсутствуют. Live API2cae1064…/тот же image/cap256MiB healthy/restart0/
OOMfalse и working DB3442fbda… running, без SQL/admin login/settings changes.
Evidence/source/state/report/memory samples/API log вне Git:
`.local-artifacts/api-memory-20261021.5Vdbe2` (от workspace). Следующее решение:
отдельно согласовать профиль/снижение Base64 peak либо иной isolated environment;
не поднимать512 до768/1024 и не переносить нагрузку на live автоматически.

## U1-LIVE — приёмка опубликованных вложений,21 октября2026

По новому разрешению пользователя созданы только новые явно тестовые records/
S3 objects; existing данные/admin/frontend/старые files не менялись. Проверены
реальные public verified HTTPS → current API2cae1064…/image d602803e… → та же
working DB/schema42 → Timeweb. Web7bee8049…/BUILD_ID прежний, без rollout/restart.
Перед каждым из3 runs: fresh backup40 tables на server+Mac0600/gzip/SHA checked,
UUID/history/flags/14 configs/30 container IDs/images/start states guarded.
Последний backup355564 bytes/SHA
`14ca0f04815043d15e1fc0aae894a32be53a620c64e30b2d4d8072aabf971873`.

Первый run6 групп GREEN до stale-session HEAD503, cleanup complete. Read-only
nginx diagnostics доказали rate rejection:21 октября09:31:32 UTC, limiting
requests/excess40.760/req_per_ip, HEAD собственного post-attachments/6.
Действующий limit20r/s/burst40 сохранён; private harness ограничен4r/s без
автоматического маскирования503/retries. Duplicate nosniff values проверяются
как список, каждое значение только nosniff; product headers не ослаблялись.
Точная утраченная assertion20 октября неизвестна; её причина не угадана задним
числом. Новая приёмка ниже подтверждает текущий путь, не старый trace.

Paced run принят:9 групп/9 objects/exit0/OOMfalse. Post photo+video poster,
article photo+PDF, MP3/TXT/raw MP4,2 comment photos: upload/read/full bytes/HEAD/
Range, WebP без EXIF/XMP, API guest/unpaid404 и anonymous S3 GET/HEAD/Range403.
Completed upstream ACK loss/status/replay не создаёт второго asset/parent/media;
другой actor получает notRecorded/bind409. Только свой synthetic paid record
(не Prodamus) проверил обычный club access, block, stale session, expiry, staff
access и отзыв. Open post/read и moderation deletion photo denial пройдены.

Отдельный max-photo run принят:4 группы (capabilities+3 usages),3 новых objects,
post/article/comment source4194304 bytes;4194305→413 без нового SQL intent.
Повтор/bind/read/HEAD/Range/private denial GREEN. Синтетический PNG2x3 с valid
ancillary padding проверяет размер transport, не тяжёлую декомпрессию фото.

Во всех3 runs exact cleanup21 новых S3 objects: ownership UUID/prefix/actor/
metadata/ETag/IfMatch и HEAD404; versioning off/policy SHA0484dfa2… прежний.
SQL cleanup только своих rows; fingerprints всех исходных40 tables совпали
после каждого прогона. Админский пароль/роль/сессии не менялись; AUTO_INCREMENT
не сбрасывался. Все3 own helpers removed с ID/name/image/owner/exited guards,
temporary env удалены. Existing configs/runtime/прочие containers сохранены.
Дампы/rollback images/старые objects сохранены; платежи/почта не запускались.

Private local evidence от workspace и одноимённые server directories в staging:
`.local-artifacts/stage-uploads-20261021.NaJ69Z` (rate failure/cleanup),
`stage-uploads-20261021.NaJ69Z-r2` (accepted9 groups),
`stage-uploads-20261021.NaJ69Z-photos` (accepted4 groups). Там source/bundle/
operator/backup/state/evidence/result receipts. Не публиковать raw dumps/config/
fixture URLs; accepted run повторно не запускать, state одноразовый.

Незакрытый остаток: published32MiB docs/audio и80MiB video. Current API cgroup
268435456 bytes/observed133.7MiB RSS, shared host4GiB/MemAvailable646800KiB.
Тяжёлые payloads не запускались, чтобы не провоцировать OOM рабочего API;
это precaution/resource gate, не подтверждённый OOM/утечка памяти. Нужен отдельно
согласованный план ресурсов. Не повышать memory/квоты/таймауты, не пересоздавать
API и не менять лимиты самостоятельно. Local isolated7 maximum checks не
становятся published proof. Browser/mobile/editor/playback приёмка отдельно.

## Очистка временных сборочных материалов,21 октября2026

По отдельному прямому разрешению удалены15 точных own targets: временные
архивы, распакованные build contexts и старые candidate-only Linux dependencies.
Все targets проверены по ownership/private parents, provenance/manifest/SHA,
отсутствию bind mounts и неизменному inventory до удаления.21 225 сохраняемых
файлов,30 containers,135 image references/15 volumes совпали после очистки;
backups/env/config/rollback images и рабочая БД не менялись. Общее хранилище
BuildKit включает чужие проекты и не очищалось. Приложение не перезапускалось.

Свободно497704960→2458550272 bytes, освобождено1960845312 bytes (около1.83GiB).
8 project services healthy, public home/API capabilities200. Это измерение после
очистки, не гарантия места для будущей сборки. Private local evidence:
`.local-artifacts/server-cleanup-20261021.kl8XsH/apply.stdout` от workspace;
сохранены exact target list/digests/protected inventory. Удалённые контексты и
архивы не нужны работающим контейнерам; повторная сборка требует нового context
из соответствующего Git source. Accepted deploy/artifact не запускать повторно:
их прежние context/archive уже удалены, но receipts/scripts/backups/images сохранены.
Новый выпуск/откат — только с fresh preflight и действующим разрешением.

## STAGE-UPDATE — staging и стенд обновлены,21 октября2026

По прямому поручению «обнови стейдж» выполнены normal push и web-only rollout.
Fresh origin/staging07cada2 содержал авторские frontend admin/editor изменения;
merge d9a8c9c сохранил их byte-exact, без ручных UI/style/generated правок.
Наши6 commits — только tests/docs, production backend/packages/lock не менялись
от deployed427195a. Поэтому API/TEST images не пересобирались/не переключались.
Оба CI workflow проверены: verify-only, автоматических deploy/migrations нет.

Проверки: root/frontend types, API90/35404 bytes,48 focused tests/5 suites,
38 existing browser editor/admin tests/1.1min, native pnpm prod audit0,
Next29 routes. Browser fixtures подменяют API — не live SQL/S3 acceptance.
Build `YtXVGc0Hb8niy9-5rNFOG` с прежними public flags, включая thumbnails=true;
public assets/dependencies прежние. Native Linux image7 offline pages/752 exact
file SHA checks GREEN. Archive29588603 bytes/SHA
`d9d8a2823ed16063c3c8a26400c12e03586ea70842b6b8fd9848d3ef683cb78f`.

Working web image
`sha256:7bee80492b73ba7717162946cb19eb7ac3d5cbbf4e6e21fe17b009274c2a4312`;
web container `ab26fc39ea7498d85e7fe5203ed7abc6a488c24dd6279145cd3a52e4b096dfa7`.
Phase accepted: healthy/restart0/OOMfalse,10 public HTTPS checks со staging host,
13 independent Mac HTTPS checks с SHA новых JS и playback.provider=vk, Chromium
guest22 cards/19 loaded images/3 null/2 opt-in catalog requests. Реальное новое
provider playback этим выпуском не проверялось. Старые public copies не закрывались.

Same DB UUID/schema42/all40 table counts/admin credential+role+session fingerprint/
video82 digest,29 остальных container IDs/images/start states и13 остальных
config files сохранены. Изменены только .env STAGING_IMAGE/resolved web.image;
existing edge configtest/reload. Без migrations/SQL writes/S3/payment/mail/flags.
Fresh backup40 tables/355566 bytes/SHA
`507e0d90e7cc9b12d8a001a0f892445e1c6ac9576875628380bda642f3830fef`
проверен на сервере и Mac до переключения, файлы0600/parent0700.

Evidence/procedure/receipts/backup: private `.local-artifacts/release-stage-20261021.0SWvc4-r2`
и одноимённая папка в `/home/edem/apps/daryadarcy-staging/`. Первый artifact
attempt0SWvc4 не переключал приложение: BuildKit принял FROM config-ID за имя
registry image. Исправлен только private Dockerfile на existing local tag с
проверкой exact base ID b87fece1…; тот же Next build повторно не собирался.
Mac probe сначала ошибочно ожидал provider в catalog DTO; сверено с контрактом,
исправлен только private probe — provider проверяется через videos.playback.

Rollback: fresh image/config/DB/concurrent-write guards обязательны. Old web
b87fece1… и before.env/config/backup сохранены; вернуть только image/env pair
через web-only --no-deps и edge reload, затем public checks. Не откатывать БД,
VK publications или весь config. Accepted phase повторно не запускать; живой
откат ради репетиции не выполнялся. Server free480MiB: перед следующим выпуском
проверить место; образы/БД/бэкапы/чужие данные не удалять автоматически.

## COVERS-RELEASE — thumbnail build flag включён,21 октября2026

Явное разрешение: включить обложки при сборке и обновить стенд, без ручных
frontend/UI/design изменений; сохранить DB/admin/3 missing covers. Пересобран
ровно deployed source427195a с NEXT_PUBLIC_VIDEO_THUMBNAILS_ENABLED=true.
Handwritten frontend, public assets, package manifests/lock и dependencies
byte-exact прежние. Отдельный07cada2 не объединялся/не выкладывался. Прежние
CLUB_TEST=false/TEST=true/recovery=true/VK=true/private-library=false сохранены.
Никаких backend images/config flags, DB/schema/rows, S3/старых файлов/платежей/писем.

Existing58 catalog +18 VK renderer tests, API90, production native audit0,
Next29 routes/TypeScript GREEN. Новый build `6aNkRjNyI6ouSxY_1276u`.
Private workspace directory `.local-artifacts/release-covers-20261021.LRdeST`
и одноимённый child staging base на сервере содержат manifest/package/probes/
guarded procedure/backup/receipts. Parent0700, sensitive files0600; public
probe/manifest0644 только для отдельного bind mount uid1000, env не в образе.
Archive29577903 bytes/SHA
`6581dec10e091123ab21652d0f2e852366489df04722979544fc9e755eddd8a5`.
Состав699 exact files/no AppleDouble/symlinks/traversal/env/cache;698 .next
files SHA проверены внутри Linux image. Base image/dependency layers прежние,
public assets не перекладывались.7 offline native HTTP checks GREEN;
client flag inline true даже при runtime false, providers/network отсутствуют.

Новый web image
`sha256:b87fece1c384cbc976fc7f39658f5edf70acd9de9f580fa28ec7ee6e383e66c5`;
web container `dff5a1ba2c0bb33f8727331eef6bc84a3fba88edbfcdf4a655e8d906f70f958f`.
Web-only compose --no-deps, healthy/restart0/OOMfalse; edge configtest/reload.
Остальные29 container IDs/images/start states, в том числе API/MySQL/TEST,
сохранены. Config delta — только STAGING_IMAGE в .env и resolved web.image;
14 остальных/проверяемых файлов не переписывались. Fresh DB UUID/schema42/
admin passwordHash+role+session fingerprint/all40 table counts/video82 digest
совпали до/после. Backup40 tables/355564 bytes/SHA
`00065bc2ae9b9e38739c395ce58fc634ee9b3a88d19c7f3ceb4cd23243cbf056`
server+Mac0600, gzip/SHA проверены до deploy. Данные не восстанавливались и
не изменялись, админский пароль не читался/не сбрасывался.

Phase accepted:10 public HTTPS checks —22 VK/public/canWatch,19 covers/3 null,
legacy0,3 exact served JS hashes и5 pages200. Существующие old YouTube60 hidden
сохранены. Независимый Chromium/guest на настоящем стенде:22 cards/19 loaded
native images533–537x300–301/3 прежних fallback,2 catalog requests с opt-in
на обеих страницах. Никаких mocks/DB writes/provider requests; VK hosts не
разрешались. Сохранены browser-check.json и catalog-covers.jpg в private local
release directory. Браузерный прогон первоначально остановился на штатном
first-visit install guide: center backdrop-кнопки перекрыт card. По исходникам
и UI установлено, что штатное действие — «Понятно →»; исправлен только private
test harness, не приложение/дизайн. После обычного dismiss полный прогон GREEN.
Реальный VK playback не проверялся и не заявляется.

Rollback: сначала fresh current image/config/DB identity и отсутствие concurrent
config writes. Сохранены before.env/after.env/private state и old web image
7ba6a5caddc7. Вернуть только прежний STAGING_IMAGE/тот же web.image через
web-only --no-deps, edge test/reload и public checks. Не восстанавливать всю
БД и не возвращать YouTube publications. Автоматический rollback подготовлен
для applying phase; accepted deploy повторно не запускать. Принятый выпуск
ради повторной репетиции не откатывали. Remote procedure/config/backup с
секретами не переносить в Git/чат. Новые source UI/style files не создавались.

## VK-CUTOVER —22 VK опубликованы,60 YouTube скрыты,20 октября2026

После mixed release пользователь явно выбрал22 открытых VK и скрытие60
YouTube с сохранением старых записей. Это **content-only transition**, не новый
app build/deploy и не разрешение переносить старые файлы/менять другие таблицы.
API/web/TEST images, BUILD_ID и DB ниже прежние. Перенос выполнен существующим
strict VK parser/upsert,22 matching src из user export; никаких придуманных
источников, hash или сопоставлений старых YouTube ID новым роликам.

Private local workspace directory `.local-artifacts/vk-cutover-20261020.U52Zwx`
и server staging base `/home/edem/apps/daryadarcy-staging/` с одноимённой папкой:
input22/19 cover bytes/operator/supervisor/guards/backup/progress/ID mapping/
publication и acceptance receipts. Directory0700/files0600; env/raw dump/embed
hashes не переносить в Git/чат. Transport archive5474612 bytes/SHA
`b59f890b6e06af6d255bd1d0291d8f99e4e9feeefd36256dffa7dff97af1140d`.

### Репетиция и подготовка

Own MySQL8.4 loopback/tmpfs512MiB `backend_test`, fresh42 migrations,
synthetic admin+60 synthetic YouTube: plan/draft/replay/cutover/replay/rollback
проверены. Concurrent old metadata edit отвергнут до publication writes;
60 old остались доступны. После восстановления fixture и удаления только
своего receipt loss-of-ACK replay дал те же22 IDs/82 rows без дублей.
Own labelled container удалён после ID/owner/tmpfs/no mounts guards;
images/volumes/чужие контейнеры не удалялись.

Live prepare закрепил current MySQL UUID/candidate,42 migrations/40 tables,
admin credential/role/session fingerprint, counts всех39 non-video tables,
14 config files и existing container ID/image/start/state. Fresh consistent
backup353118 bytes/SHA
`5f39153b4140c2349895ef3f572f2857781766cace1e41417c9dd417f3b006d8`
сохранён server+Mac0600, gzip/40 CREATE TABLE/SHA проверены **до apply**.
SSH был intermittent: два backup download timeout до успешной копии; apply
до неё не запускался. Первый extract guard ошибочно ожидал24 tar members вместо
23; остановился до extraction/DB/S3. Состав перепроверен, разрешена только
пустая own0700 папка и expected23 entries, без symlinks/absolute/traversal paths.

### Apply и проверенный результат

- 19 PNG5443271 bytes помещены только в новый public prefix
  `app-assets/vk-catalog-20261020-U52Zwx/`. Conditional create/no overwrite;
  HEAD metadata/size, signed GET и anonymous GET SHA совпали у всех19.
  Никаких policy/ACL/старых object writes. Native533–537x300–301, не HD.
  У456239226/456239052/456239035 thumbnailUrl=null: оригиналов нет.
- 22 новых VK сначала unpublished, sourceKey replay через existing upsert.
  Titles из VK export,22 durations из user TXT/PDF. Затем publication flags
  изменены одной transaction с named lock/row locks/exact guards:22 VK public
  published,60 YouTube hidden. Старые IDs/access/metadata и все82 rows сохранены.
- Phase `accepted`:33 HTTPS checks со staging host — catalog22/covers19,
  pagination10+10+2 without duplicates,22 exact matching playback responses,
  legacy list0, old playback404 и YouTube proxy/thumbnail HEAD404, pages200.
  Guards после каждой стадии: same admin/history/non-video counts/config/
  runtime images/other containers. Ни migrations, ни платежей/внешних писем.
- Независимый Mac HTTPS: catalog22/public/canWatch/durations/covers exact,
  legacy0, два sample covers byte SHA, served chunk SHA совпал с release build.
  Published chunk всё ещё читает NEXT_PUBLIC_VIDEO_THUMBNAILS_ENABLED из browser
  env, не inline true. Это frontend build integration остаток: следующий build
  фронтендера с true. Runtime-only env готового Next image не решает его.
- Реальное VK воспроизведение **не принято**: browser site-safety отказал,
  raw HTTP/CDP/другой браузер/CDN не использовались для обхода. API200 проверяет
  контракт/источник, не запуск/перемотку/звук. Handoff и3 missing covers:
  [фронтендеру](../development/frontend-video-fixes-2026-10-20.md).

Fresh fetch после переноса: origin/staging07cada2 содержит21 frontend admin/
editor/E2E files, не меняет video contract/thumbnail flag. Он не объединялся,
не перезаписывался и не выкладывался в этой content-only задаче. Новые docs
коммитятся только локально; это не утверждение, что07cada2 уже работает на dev.

### Откат только публикаций

Не повторять `supervise.py apply`: accepted phase намеренно отказывает.
При отдельном поручении отката сначала сверить actual UUID/DB/runtime/config,
current82 rows и ID map с private before-videos/drafts-ready/publication receipt,
проверить отсутствие новых правок владельца. Использовать сохранённый operator
mode `rollback` в том же pinned API image/isolated network/user1001, с own
private env/bind mounts/read-only root как в supervisor. Operator атомарно
возвращает old60 published/new22 draft; повтор безопасен на unchanged state.
При drift он отказывает: не снимать guards и не restore всей working DB.
Новые22 записи/19 cover objects остаются для повторного выпуска; старыеS3,
users/credentials и другие таблицы не трогать. Backup — страховка, не команда
автоматического overwrite. Реальный rollback выполнен только на synthetic DB;
на стенде принятую публикацию ради повторного теста не отменяли.

## RELEASE-MIXED — выбран выпуск остальных правок, cutover VK отложен

### Итог: выпуск принят,20 октября2026

Нормальный push `origin/staging`:b32d0bc→1994e19 без force/переключения ветки.
App source `427195a957ed58315c8e32d8f52a50fac8e41f6c`;
1994e19 добавляет только документацию, app/dependencies byte-exact427195a.
Handwritten frontend сохранён byte-exact b32d0bc, только generated contract
согласован с covers API. Никакого ручного UI/дизайна.
Immutable release tag: `staging-2026-10-20-427195a` указывает на app source.

API image `sha256:d602803efec7286aa04a8a3ff4c6d3ef02b6da842bb0b47952d7e544e4e6d576`,
web image `sha256:7ba6a5caddc765b2c211f3d87595db9c5d2a17e4d33344544fcc4d7e6e5dab99`.
Active API `2cae1064530d`, web `1b7dc5ba43f2`, restricted TEST `475ecf8691fd`;
BUILD_ID `3AnAHG4Xnst8bDvWGRSal`. Native image checks17/17 без DB/providers,
source/served files hashes1613 verified. Не устанавливались новые зависимости:
использованы проверенные pinned Linux production runtime images, offline build.

Guarded prepare: тот же MySQL container/UUID/current candidate DB, history42,
40 tables; admin passwordHash/role/sessionVersion/not-blocked fingerprint совпал.
Pending mail/bindings/scheduled/deletions/billingProfiles/shopMail все0 перед
обоими apply. Два consistent backups server/local0600 проверены gzip/SHA40 tables:
353137 bytes/SHA31010ce7… перед первым apply и353143 bytes/SHA
`4af608f87c7ff9003b01b3161dedf51ea280e327c8a3d7a707fde506bc12fbe5`
перед принятым retry. Операционные файлы/receipts остаются в private directory
`.local-artifacts/release-mixed-20261020.AY5lVU` от workspace и одноимённой
папке staging base на сервере. Env/resolved config/raw backup не коммитить.

Изменились только API/web/TEST images и путь монтируемого restricted TEST bundle;
resolved compose config проверен exact delta,14 configuration guards сохранены.
Та же DB, схема, credentials/roles/session, все provider/private flags прежние,
27 other containers (включая MySQL/video/S3 egress/другие проекты) неизменны.
App services healthy/restart0/OOM=false, edge configtest/reload штатный.
Никаких DDL/DB switch/content import/S3 writes/платежей/внешних писем.

Acceptance:20 read-only public HTTPS checks со staging host: capabilities,
auth guest, launch readiness, original catalog60 с прежним exact shape,
opt-in includeThumbnails200/60 (до выпуска400), forward pagination10+10 без
дублей, legacy60 с прежним публичным DTO, public playback metadata, admin401,
guest Library list/direct GET/HEAD404,6 frontend pages200 и SHA нового JS asset.
Отдельный Mac public HTTPS covers200/60 подтверждён. `state.json=accepted`;
live-read-check.json сохраняет результаты. Это не browser/mobile acceptance,
не загрузка/чтение реальных S3 files и не воспроизведение YouTube/VK.
22 VK sources/covers/access mapping не импортированы, cutover намеренно отложен.

Два исправления процедуры, не application code:

- Первый tar содержал1845 AppleDouble metadata files; все1616 app files SHA
  совпали. Fail-closed guard остановил build. Repack COPYFILE_DISABLE=1,
  v2 archive206588383 bytes/SHA2ae18710… проверен exact1616/no extras.
- Первый rollout автоматически вернулся к прежним images: harness ошибочно
  ожидал provider/access у legacy DTO, который намеренно их исключает.
  После сверки repository/generated contract проверяются60 matching public IDs,
  youtubeId format и отсутствие private/provider fields. Образы/приложение
  не менялись. Rearm подтвердил same DB/admin/config/other containers и создал
  fresh backup; same-image retry прошёл все20 checks. Image-only rollback
  фактически проверен, без восстановления/изменения DB.

Удалены только3 подтверждённых own temporary archives777619075 bytes,
распакованные старые contexts сохранены; own failed context/transport archive
и новый build context убраны после exact byte checks. Local source/context,
backups, native images и все прежние rollback images сохранены. Не было prune,
удаления images/volumes/DB/чужих файлов. Свободное место остаётся ограниченным.
Финальный fresh df:768MiB free;8 project services healthy, BUILD_ID подтверждён.

Не запускать apply/старый rearm снова: phase accepted. При новом поручении
rollback сначала fresh inventory/config/snapshot и отдельный guarded reversal
только images+TEST mount на ту же DB, с учётом актуальных file hashes/ID.
Текущий helper намеренно не откатывает accepted release автоматически.

### История подготовки до принятого выпуска

20 октября пользователь принял временный выпуск без отключения60 текущих
YouTube до переноса VK. Обратный commit4c04d62 сохраняет историю и mixed API,
не затрагивает covers/прочие fixes и working content. Generated frontend
API contract синхронизируется штатно, ручных UI/design changes нет.
Выпуск в подготовке: fresh tests/audit/artifact/backup/guarded image-only rollout
и read-only acceptance ещё обязательны. Старые scripts нельзя запускать без
обновления baseline/config set (теперь включает compose.private-uploads.yaml).

### Локальный пакет готов, сеть остановила публикацию

Source427195a957ed58315c8e32d8f52a50fac8e41f6c.443 tests/15 suites/0skip:
222 native HTTP/JWT/SQL/worker/content/session +221 frontend/collector/admin.
Fresh own tmpfs backend_test migration profile42 GREEN. Первый helper run
не выполнил тесты из-за отсутствия test-only migration markers на full schema;
markers добавлены только для уже применённых миграций fixture, повтор GREEN.
Root/frontend/E2E TypeScript, ESLint, API90, boundaries713/docs64, backend/TEST/
frontend production builds29 routes и native prod audit0 findings GREEN.

Private local directory от workspace:
`.local-artifacts/release-mixed-20261020.AY5lVU`. Manifest1616 files,
context.tar.gz206733749 bytes, BUILD_ID `3AnAHG4Xnst8bDvWGRSal`.
Зависимости/package manifests/lock byte-exact прежнему U1 source2fede813;
production Linux runtime reuse требует проверки exact base images на сервере.
Next build сохраняет TEST/recovery/VK=true и CLUB_TEST=false, новый general
private-library flag=false: recipes/Petersburg прежние; existing patterns hook
не зависит от нового flag. Handwritten frontend byte-exact b32d0bc, только
generated contract изменён штатным generator. Source covers/download-name fixes
сохранены, playback через внешний provider этим прогоном не принят.

Начальный read-only SSH показал830MiB free;8 project services healthy и старые
images прежние. Позднее4 SSH banner timeout ДО авторизации/исполнения,
Mac HTTPS SSL timeout, bounded Git fetch SSL_ERROR_SYSCALL. Первый зависший
fetch остановлен адресно по PID; chained push не исполнялся. Ветка clean после
source commit, origin/staging остаётся последним проверенным b32d0bc.
NO push/deploy/restart/remote mkdir/backup/new image/config/DB/S3 writes.
Запрошено переключение VPN; дальнейшие одинаковые retries не выполнять без
изменения внешнего состояния. Нельзя выдавать package за deployed image.

В private directory подготовлены, но НЕ выполнены new-baseline scripts:
prepare-artifact.py (tar path/file/digest guards, pinned image IDs, offline native
API/web/restricted TEST17 checks и served tree byte checks), rollout-images.py
(backup/admin+schema/config/inventory guards, image-only apply/verify/rollback).
Удаление трёх прежних own temporary archives только намечено: контексты,
backups/images/БД остаются; cleanup на сервере не выполнялся. Перед запуском
снова проверить source/remote/actual container IDs/config и доступное место.
Артефакт не содержит env/provider credentials; rollback использует прежние
images и ту же DB, не restore/DDL. Скрипты не являются новым разрешением.

## RELEASE-VK — разрешение обновления получено, preflight остановил полный выпуск

20 октября2026 пользователь разрешил push в staging и обновление frontend/backend
с сохранением current DB/admin/S3. Source до подготовки:local2e12c80,
origin/staging=b32d0bc, ahead23/behind0, clean tree. CI configurations выполняют
verify; явного auto-deploy job нет. Push и server apply ещё НЕ выполнялись.

Проверенный running baseline:teamassist-dev/155.212.216.16/uid1001,
API2c604839f745/image15865765a80d, web e84c205cc6c7/imageca936764114d;
все8 project containers healthy. Одно промежуточное подключение завершилось
banner timeout до авторизации/исполнения; повторный read-only probe успешен.
Не запускались старые rollout-images.py/storage-rollout.py: их guards относятся
к предыдущим revisions/images/compose file sets.

SQL в SET SESSION TRANSACTION READ ONLY + START TRANSACTION READ ONLY:
readOnly1, database=daryadarcy_candidate_20261019, migration rows42,
adminExists=true (email/role/not-blocked/has-password predicate, без вывода hash).
Video aggregate:60 youtube/public/published,0 VK. API namespace launch200,
videos.catalog200/60 и legacy videos.list200/60; public HTTPS с Mac catalog200/60.
Secrets/raw users/stream URLs не выводились, DB writes/DDL отсутствовали.

**Стоп-факторы:** текущий local4c04d62 прекращает YouTube-выдачу/worker fallback
и фильтрует VK до pagination, поэтому полный rollout даст0 карточек.22 VK src
из ручного export — ещё не working import, не карта60 старых ID/access и не
принятые covers/playback. Также fresh check:api exit1/outdated — release check
не зелёный, игнорировать его ради push/deploy нельзя.

Пользователю предложен выбор: временно выпустить остальные правки с отложенным
VK-only cutover либо сначала согласовать/завершить VK migration и затем полный
выпуск. Не угадывать missing sources/access и не менять working content/flags
на основании общего update request. До решения остановиться: новый artifact,
native audit/backup/new guarded rollout и acceptance ещё не готовились, приложение
не переключено. DB/admin/password/S3/schema/config/работающие images сохранены.

## RELEASE-U1 — обновление применено, приёмка загрузок открыта,20 октября 2026

### WIN-LIVE — четыре зимние выкройки включены и backend API принят

Пользователь отдельно разрешил Library flag и2 временных аккаунта/1 synthetic
access row без провайдера/SMTP, с точной очисткой. Применён только
PRIVATE_LIBRARY_FILES_ENABLED=true в closed0600 private-uploads.env; private
content flag уже был true. Recreate только API тем же image15865765… и штатный
edge reload без правок. Финальный API
`2c604839f745f7b88aa907341d284fa5f73bb7d43ab9de20946f603e6535548f`,
image `sha256:15865765a80d030dd2e80aa863c5b45e5714a0e9162e6940554907f486eabb87`,
healthy/restart0. Другие containers/images/config/flags/network isolation прежние;
никаких push, нового image, frontend, DDL/DB switch или S3 writes.

До включения — consistent backup40 tables/353120 bytes, server/local0600 SHA
`a53f157be69e029e1e336d75cfe706c7a9d50c66af0e9a54fb338c4ccb6c007c`.
Private artifacts: local `.local-artifacts/library-enable-20261020.ER3Dqo`
от workspace и server `/home/edem/apps/daryadarcy-staging/library-enable-20261020.ER3Dqo`.
Там closed baseline/env backups/receipts; не выводить prepared.json/env/DB dump
в отчёт и не добавлять в Git. Production native dependency audit0 findings.

Public verified HTTPS с staging host:89 checks, admin/member list200/4 exact
WebP full GET SHA/HEAD200/Range206, guest/unpaid/deleted fixture sessions404 на
list/direct GET/HEAD/Range; anonymous direct S3 GET/HEAD403. Full HTTP GET246–359ms.
Каждый прогон создавал только2 test users/1 synthetic club_payments row, без
email/phone/billing profile/outbox/provider; все fixtures всех прогонов удалены.
После очистки fingerprints40 tables совпали с baseline, кроме normal admin
lastSignedIn/updatedAt; credentials/role/session, schema42/4 bindings прежние.
AUTO_INCREMENT не сбрасывался. Четыре рабочих S3 copies сохранены; старые sources,
«Лошадка», recipes/Petersburg не переносились/не закрывались.

Границы: два внешних Mac прогона не accepted. Во втором admin/apple GET уже200,
Content-Length972770, body не завершился до абсолютного30s deadline harness.
Оба завершились exact cleanup и проверенным rollback flag; точная причина
внешнего поведения не доказана. Same API namespace S3 full reads417/51/54/73ms.
Отдельный финальный прогон с VM использовал публичный HTTPS/обычную проверку
TLS, не loopback/mock и не browser. Его accepted receipt — server-acceptance.json;
enabled.json/cleanup.json подтверждают состояние. Нестабильная SSH разрывалась
после apply; актуальное состояние проверено по running container/receipt,
apply вслепую не повторялся. Acceptance worker был ограничен300s и выполнялся
независимо от SSH с cleanup/guarded rollback на ошибке.

Откат только по отдельному поручению: enable.py rollback проверяет текущие
hashes/прочие сервисы, возвращает exact before-private-uploads.env и recreate
только API тем же образом + edge reload. Не применять старый storage-rollout.py
enable/disable: его baseline IDs/config устарели. Не повторять apply/importer/
acceptance без свежей проверки статуса и нового scope; эти копии НЕ fixtures.
Старые public sources и клиентская/браузерная приёмка остаются отдельными шагами.

### История WIN-PREP — четыре зимние выкройки подготовлены до включения

Новое явное разрешение20 октября: только новые private copies и bindings
holly/sock/star/apple, без включения Library API/старых sources/frontend/deploy.
Этот scope уточняет прежний запрет записи DB только для четырёх материалов;
старый U1 live helper всё ещё не разрешён.

До изменения сохранён consistent backup текущей DB:40 tables/351868 bytes,
SHA256 `9c5ce99735ef1d97a2c762f46450de6ad857d2d8886b80e5feede7adf8eca537`.
Server/local0600 copies совпали; gzip complete, schema/history42. Backup содержит
конфиденциальные данные: не публиковать/не читать raw rows в отчёт и не коммитить.
Private operational directory: local `.local-artifacts/winter-patterns-20261020.LlzoI0`
от workspace и server `/home/edem/apps/daryadarcy-staging/winter-patterns-20261020.LlzoI0`.
Там закрытые manifest/preflight/backup/apply receipts; сохранять вне Git.

Существующий importer из exact deployed API image15865765… запущен отдельным
non-root/read-only/cap-drop operator без HTTP listener в isolated API network.
Operator-local flag не менял работающий API. Stable idempotency key
`winter-patterns-20261020-v1`, material `patterns`, expectedRevision0 на каждом
slot, manifest payload SHA256
`7d889b8ec0a55c61e3bd98428dfbf8420808137fd0cd6ae5f44999c7defb5c12`.

| fileKey | MIME | bytes | source/body SHA256 |
| --- | --- | ---: | --- |
| holly | image/webp | 907380 | 3806194d71bef3f6644d878a354212d958ab60647eab92b9a9115fd498981235 |
| sock | image/webp | 903476 | 1cc0462841dbff90e9ad0f9d65427289e3d7f453f394e72690ec7631396369c1 |
| star | image/webp | 897376 | 493a6b466590d5c796ddc5a36bb946e2301be896a02778fabafb4175c7131b4d |
| apple | image/webp | 972770 | 73f233acce5d7b9589b10f8d5326aabef9bafe6c4428c59e8bff16f488df5a90 |

Все4 source hashes совпали с originals внутри deployed web image; metadata
EXIF/XMP/IPTC отсутствует. Созданы4 ready libraryPhoto copies и4 enabled
bindings revision1, total3681002 bytes; signed GET body SHA/HEAD/Range совпали,
anonymous GET/HEAD/Range403. Same-key replay сохранил rows/objects/revisions.
Точные SQL increments: private_content_files+4/library_file_bindings+4/
library_file_migrations+1. Все прежние rows40 tables/admin/password/role/session,
schema/history42, S3 policy SHA0484dfa2… совпали с baseline. API035752d8… прежний,
healthy/restart0; Library flag false, content/media/video/delivery true.
Оператор и его временный env удалены, runtime не перезапускался.

Эти4 S3 copies рабочие, НЕ synthetic fixtures — не удалять. Глобальный Library
flag не включать без следующего согласования и live club/admin/guest проверки.
Старые public sources/derivatives/cache не закрыты; «Лошадка», recipes/Petersburg
не менялись. Не считать full content protection/Library delivery принятыми.

Откат, только по отдельному поручению: existing `rollbackLibraryMigration`
с тем же key и свежим current admin/session actor проверяет CAS/revision и
отключает созданные slots; objects/history сохраняет. Сначала dry inspect
текущих revisions и receipt. Whole-DB restore/delete objects/смена image здесь
не нужны и не разрешены. `operate.py apply` повторно не запускать: receipt
уже записан; importer replay проверен внутри успешной операции.

Повторный isolated content API/SQL/real S320 октября:4/4 pass/0skip после
исправления устаревшего fresh-schema test guard41→42. Потеря ACK upload/save,
restart/status-first retry/no duplicates, current access/account isolation
проверены для article/post/comment.4 synthetic objects удалены с metadata/ETag/
HEAD404, policy прежний; own loopback/tmpfs DB9e2d2b9f… удалена. Evidence:
`.local-artifacts/release-u1.pUAwLj/isolated-content-FeRT7R/acceptance-retry-1792497505236.log`.
Это снимает provider-timeout blocker этого isolated suite, не заменяет
published U1/audio/video/max-size/browser acceptance. Новый свежий стенд
отложен: Mac ниже safe512MiB; images/БД/чужие files не удалялись.

### Позднейшая read-only проверка после смены VPN

SSH и HTTPS снова доступны; API ID035752d8…/image15865765…неизменен,
healthy/restart0. Working SQL выполнен в `TRANSACTION READ ONLY`, readOnly=1:
history42, Library flag false/content flag true, pattern bindings0 и0 winter
bindings. Четыре upload/delivery flags true. Ни deploy, ни restart/DB/S3 policy
или рабочих flags в этой проверке не выполнялось. Current images ещё не accepted.

Последнее разрешение пользователя: без изменения working DB/старых files,
push/deploy/frontend. **Не запускать старый `run-live.py`/`live-uploads.mjs` ниже:**
он создаёт synthetic records в working DB. Сначала отдельный isolated API/DB
стенд либо новое явное разрешение на такие fixtures. Исторические rollout/
disable/rollback команды ниже не являются новым поручением их выполнять.

Изолированный current-code native Library API/SQL/real S3:4/4 pass/0skip,
fresh42/40 tables,6 new objects, PUT/import ACK loss и replay, exact GET/HEAD/
Range, anonymous denial, expiry/block/session revoke, scoped rollback проверены.
Все6 objects удалены по metadata/ETag/HEAD404, policy SHA0484dfa2…прежний;
own a6c4d0e…tmpfs container удалён. Это не working pattern migration/enablement.
Отдельный content S3 suite:2 provider policy timeouts10s в beforeAll,4 skipped,
не pass. Перед удалением own c736ae86…fixture проверены все40 таблиц: только
42 migration rows, users/uploads/bindings0. Никаких S3 writes в этих2 attempts.
Private evidence: `.local-artifacts/release-u1.pUAwLj/isolated-library-aYMyJE`
и `isolated-content-TOiFYB`; не добавлять закрытые fixture URIs/профиль в Git.

В публичном anonymous denied read замечены duplicate `nosniff` headers от edge;
строгое равенство одного значения в старом harness потенциально ложно падает.
Это не доказательство точной старой read assertion и не основание менять
proxy/product headers. Working U1 read/access/browser/max-size acceptance открыта.

### Историческая последовательность выпуска U1

Пользователь разрешил выпуск последних правок и live upload acceptance с
сохранением current DB/admin/password/design/legacy files. На старте работает
именно D7 ниже. New app source2fede8134b13f0e6ee6d02fb503cb28675846262,
production manifests/lock/public assets/Next config совпадают с D7; рабочие
compiled VK/recovery/Prodamus TEST flags сохраняются. Library/cleanup flags не
включать и старые источники не переносить в рамках upload release.

Fresh preflight выявил отсутствие S3 config и only-internal API networking.
Optional compose.private-uploads.yaml добавляет отдельный non-root readonly
S3 TLS passthrough, не общий egress API: canonical endpoint/DNS alias, один
upstream IPv4:443 и exact SNI, no published ports/secrets/TLS termination.
IP217.78.234.145 подтверждён DNS staging host и verified HTTPS20 октября;
перед apply перепроверить DNS/certificate. Это operational pin, не вечная гарантия.
Механизм SNI основан на [официальном ssl_preread](https://nginx.org/en/docs/stream/ngx_stream_ssl_preread_module.html).

Существующий key из явно разрешённой переписки проверен с staging web namespace:
signed PUT/HEAD/GET и anonymous GET/HEAD/Range403 на трёх новых UUID objects во
всех private prefixes. Policy SHA0484dfa2cc0164225db616bc516c53e8be377aca975d32701b6a6467ce1715e8
до/после прежний; versioning disabled, exact metadata/ETag delete и HEAD404.
Никаких old object/policy/ACL writes. Это storage preflight, ещё не API приёмка.
Private evidence local0700 `.local-artifacts/release-u1.pUAwLj` от workspace;
server0700 `/home/edem/apps/daryadarcy-staging/release-u1.HxeY5r`.
Закрытые operational credentials/configs/backup не добавлять в Git или отчёты.

Последовательность: pinned image delta/native checks → fresh consistent backup
и same-DB/schema/admin guards → image-only rollout с прежними flags → metadata/
S3 identity/privacy through isolated API → только4 upload/delivery flags →
own synthetic live acceptance/cleanup. Ни prepare, ни image health сами по
себе не означают working upload readiness. Существующие rollback images,
backup и current DB сохранять; не применять исторические cutover scripts.

### Фактически применённый U1 и точка продолжения

Normal push becaf6d69112a845ac5173fba0e237cf9fd33994 подтверждён remote staging.
Runtime app source2fede8134b13f0e6ee6d02fb503cb28675846262:
API/restricted TEST `sha256:15865765a80d030dd2e80aa863c5b45e5714a0e9162e6940554907f486eabb87`,
web `sha256:ca936764114d51fc0e0b1c3c8fceb26bd5e6e485326acb6d1e25bb945b50292b`.
API bundle82ff11c0a04e66ae8970dd9615e34a5f7bb31567e5d812504244ed5e8f28d440,
restricted TEST11768605a3b045d071b449f7d61f0d64e1f72611abb7b804f91c24a1884cc2de,
BUILD_ID iWTVsayf9GvrBy89i4TdJ. Native server offline17 checks pass, non-root,
no provider/DB/S3 secrets embedded, dependency/native base pinned D7 unchanged.
Передан не полный535MB image archive, а checked build context29795331 bytes,
SHAf46ecdb27f9611e810d93a03e0365a54912ecec5212f65fa4b191599e61cbb5d;
server offline delta build на прежних exact image bases. Old served .next tree
удалён только внутри нового image перед COPY; старые public assets неизменны.

Fresh backup351863 bytes/40 tables,
SHA9ca1191a9ae9109be7d798e8766598df662f7c38ec69d173bffa6b77a920073a,
server/local0600 copies совпали. Та же DB daryadarcy_candidate_20261019,
schema/history42/admin/password/role/sessionVersion fingerprints до/после равны.
Images-only verify: все3 services healthy/restart0/OOMfalse, остальные26
containers неизменны; pending mail/binding/deletion/shop/scheduled/billing0.

Затем storage-rollout.py применил compose.private-uploads.yaml и отдельный
closed0600 private-uploads.env только API; первоначально все4 flags false.
API-only isolated networking сохранён. Из actual API повторены S3 signed
read/anonymous GET/HEAD/Range403 и точная очистка3 новых probe objects;
policy прежний, verified TLS/exact SNI, wrong SNI rejected, general egress denied.
После storage-preflight.json включены PRIVATE_CONTENT_FILES_ENABLED,
PRIVATE_POST_MEDIA_UPLOAD_ENABLED, PRIVATE_POST_MEDIA_DELIVERY_ENABLED,
PRIVATE_POST_VIDEO_UPLOAD_ENABLED. Last-known API container
035752d8e1d7a748bff6b08bae27fbbfbaa2f83dad2f0fff83fed5680d28b9a5;
proxy9b53c54a…healthy. Library/cleanup/provider/SMTP/CORS/roles/квоты прежние.

Первый live acceptance реально дошёл до9 ready objects: post photo/poster,
article photo/PDF, MP3/TXT/raw MP4,2 comment photos. PNG >256KiB, public HTTPS,
actual deployed API/SQL/S3; собственный proxy теряет completed successful
responses, затем status/retry подтверждают прежние asset/parent IDs без дублей.
Чужой actor status notRecorded/bind409, max2 comment photos400 на третьем.
На группе authorized bytes/headers/range — AssertionError, причина неизвестна.
Read/access revocation/browser/полные предельные размеры не приняты.

Finally первого прогона удалил только9 guarded own objects (HEAD404), synthetic
post/article/teaser/comment/4 users и recovery rows. Count+digest всех исходных
SQL tables совпали до/после; policy прежний, helper container9fe674e2…удалён.
Старые files/данные не менялись; искусственных платежей/писем не создавали.
Private live-output.log содержит safe failure/cleanup evidence. Старый harness
писал подробности в tmpfs /tmp, исчезнувший после exit, поэтому copied report
не сохранился и wrapper groups0 НЕ означает отсутствие пройденных mutations.
Local harness исправлен на0700 persistent evidence directory и non-root1001
bind /evidence, но повторная доставка не удалась: несколько SSH banner timeout,
Mac HTTPS TLS timeout. У пользователя запрошена смена VPN/сети.

**Не считать выпуск accepted.** images state.json running-new, storage-state.json
enabled. После восстановления связи сначала health/schema/admin/config guards,
затем доставить local live-uploads.mjs/run-live.py и установить точную read
assertion. При confirmed read defect — guarded storage-rollout.py disable
до product RED/GREEN и повторной приёмки. Для полного отката сначала
storage-rollout.py rollback (перемещает только3 own configs в private directory,
восстанавливает isolated API и удаляет только own proxy/network), затем
rollout-images.py rollback на D7 в той же БД. Не восстанавливать старую DB.
После окончательной acceptance нужны свежие fingerprints/receipt с actual
current API ID и storage delta; первоначальный images verify не покрывает
последующее включение flags. Старые backups/images не удалять.

## Предыдущий working dev — RELEASE-D7,20 октября 2026

Публичный `https://daryadarcy.dev.reeskeen.ru` реально обновлён, runtime commit
`1fc155e44c9d2c689e6cf567cfa735556975c61c` в staging. Выпущены ADM-P2 и SAVED-P1.
До apply обнаружена несовместимость strict postsPage с direction=forward,
который добавляет настоящий tRPC infinite client. RED unit/native HTTP400,
минимальный optional forward, backward/unknown400; GREEN7 input units +33
native SQL/HTTP, root2653 pass/1612 opt-in skips, types/build/API90/35148 pass.
Schema/roles/quotas/flags не менялись. Old incompatible images не применялись.

- API/restricted TEST:
  `sha256:498aa1a9bda02c41ab8bf1f75870907f703bb03ac33bbca31a4686c683b9eae9`;
  web `sha256:becc5c65d17f46c99d09f2bdafa7b2be87e75e4c8f5972524f8e21f28a855649`.
  API bundle SHA `3210fa9bf530b0ae09709be1773d4cb4ec58e9de13cb3cee0238a58fb899b3ca`;
  TEST SHA `7b9892b3afb129c55a248aa759fccc0a9c17ee9636e08075aee1aa2039c00d83`.
  BUILD_ID `ioLtYikvyK780DlSuNqiI`. Web filesystem layers/runtime config равны
  проверенному baaeb47 Next29 build; frontend diff только generated type,
  поэтому assets/runtime переиспользованы с новой revision metadata. API/TEST
  собраны из актуального Git source, pinned D4 deps/config прежние;
  audit0/325 deps, native --network none API5/web7/TEST3 pass.
- Final archive535315197 bytes, SHA
  `4695f4163d2a45259ff799a8221ed9b1633a5f5e752d3be229a90a009e5e9444`
  проверен до load. Fresh single-transaction backup351598 bytes/40 tables,
  SHA `234e1177ba9b17676d413c7fe87883c4b35afb1f208c8cece1d1c60f3f0a0c97`:
  server0600 и matching local0600 copy. Active DB всё ещё
  `daryadarcy_candidate_20261019`; schema/history42/admin password hash/role/
  sessionVersion до/после равны. Full Compose delta только3 images и TEST source;
  provider/SMTP/DB URI/JWT/flags прежние. Side effects6 counters0, все3 services
  healthy/restart0/OOMfalse; остальные26 containers неизменны, actual bundles match.
- Public HTTPS73: existing-password admin login/me/logout,742 IDs/38 pages с
  прежним порядком/без дублей, filters/detail/counters, forward200/backward400/
  guest401. First20 cards15685 bytes vs legacy1544982. Разовые замеры888/1932ms
  не являются нагрузочным benchmark. Current61-day calendar корректно пуст;
  отдельно historical2 nonempty days/2056 bytes сверены с полным baseline.
- Реальный Chromium без API mocks:40 cards после scroll, IDs unique, calendar
  navigation без admin.posts; unpaid temporary user507 сохраняет и открывает
  public post1 в профиле. Own account507 и1 own saved row точно удалены;
  payments/outbox не создавались. Install guide штатно закрыт Escape после двух
  остановок automation на backdrop, production UI не меняли.

**Первоначальный предел live проверки снят отдельным follow-up20 октября.**
По прямому согласию созданы1 synthetic published club post745, unpaid account512
и2 own bookmarks (existing public1/test club745). Club bookmark добавлен только
тестовому аккаунту как retained old record, не через paid subscription/role grant.
Admin API подтвердил существование и точный synthetic body; guest/unpaid API
getById200/null и реальный Chromium direct link «Пост не найден» без body.
savedPosts/вкладка клуба скрывают старую закладку, новый toggleSave403, public
saved post по-прежнему открывается, public search не раскрывает клубный текст.
API mocks, внешних писем, платежей, файлов и изменения existing content не было.

Finally cleanup с exact ID/source/text/password-hash/owner/dependency guards:
post745/user512/2 saved rows удалены. Все исходные posts/saved rows совпали с
baseline по digest, user count прежний (742 posts/3 users), auto-increment gaps
не сбрасывались. Admin/schema/history/config/running release прежние, все6
side-effect counters0. Фронт/дизайн/S3/старые файлы не менялись, нового rollout нет.
Evidence local0700 `.local-artifacts/saved-club-20261020.kjEsfo`;
server0600 `release-baaeb47.4qlmx5/saved-club-followup.json`, SHA
`9cf7177ea329de619229ea229db827ed6d71b62e554d041370f4b554285a0257`.
Original release receipt ниже immutable и исторически содержит первоначальный
предел; это дополнение снимает только club-only Saved limitation, не является
full contract/mobile/pilot/S3/real payment acceptance.

Private local0700: `.local-artifacts/release-baaeb47.31scch`;
server0700: `/home/edem/apps/daryadarcy-staging/release-baaeb47.4qlmx5`.
Receipt0600 SHA
`a07440325f191e3de2765a7c2a4c7ebee4de8176e5ab9c609c963aca4e576e89`.
Имя directory сохранено от начала D7, actual revision1fc155e в images/receipt.
State accepted. Старые images/configs/TEST source/backups сохранены; после
acceptance новый rollback требует отдельного разрешения и fresh same-DB guards.
Не применять старые DB cutover scripts и не возвращать устаревшую old DB.

После acceptance удалены только own local/server image archives: exact path/
owner/non-symlink/size/SHA guards, воспроизводимы из retained images. Fresh backup,
configs, receipts и old images сохранены, server1092MiB free. Финальный read-only
осмотр: accepted, admin/schema/config прежние, posts742/club0/fixtureUsers0,
все6 side-effect counters0. Никаких foreign files/images/volumes/DB cleanup.

## RELEASE-D7 — историческая подготовка до возобновления20 октября

19 октября разрешены совместный image-only выпуск и live проверка pagination,
calendar, Saved. Normal push runtime `baaeb470979378c70c8fc33351e08682ba8bf0f0`
подтверждён remote staging ref (incoming0/ours7). **Сервер ещё D5:** health200,
admin.postCounts/postsPage404;7 staging services healthy на прежних images.
SSH закрывается примерно через2s при rsync и raw chunk transfer. Docker load,
prepare/fresh backup/apply/accept ещё не выполнялись. БД/admin/password/config/
schema/flags/provider/SMTP/S3 не менялись; тестового пользователя не создавали.
Для продолжения запрошено переключение VPN/сети; не заявлять обновление стенда.

Final clean-source Linux amd64/node images (пока локально):
API/restricted TEST `sha256:0f53b87e68485aeb447487602020393a712b9fd78178f9a231a43ffeb46dd173`;
web `sha256:c805299e18e36e00ed2d1ea2cb8281a3b1b44571700a7ec2f8d5243619d51015`.
BUILD_ID `ioLtYikvyK780DlSuNqiI`; API SHA
`5acd5123bc53836f30d593404ffcd817f29d0e504aedff89ea54a4a92e845d28`, TEST SHA
`f38c0d68d8138f2761068882c96a287c691cb843b3e2732fe87dc7622455415e`.
Pinned D4 base/runtime/deps/config/compiled flags прежние; audit0/325 deps,
Next29 pages, native --network none API5/web7/TEST3 pass. Initial packaging
с Next build cache заменён ДО load; cache удалён из собственного build directory,
web перепакован и isolated checks повторены. Не использовать initial web206162…
или initial archive623080855 bytes как release artifact.

Private local directory0700: `.local-artifacts/release-baaeb47.31scch`.
Server directory0700: `/home/edem/apps/daryadarcy-staging/release-baaeb47.4qlmx5`.
FINAL archive535314232 bytes/SHA
`c751b2532de061d0d66ecdd12684a88915c9259d71ff96d2128f61a43c44a802` локально;
старый incomplete server archive327680 bytes удалён после prefix SHA check.
Перед resume сверить exact current files/refs и запускать stage.cjs: он доставит
новые images.json/TEST source/guarded rollout-images.py до prepare. Скрипт ожидает
current D5 images и ту же DB/schema/admin; никаких старых DB cutover scripts.
Сначала full archive SHA, load, fresh backup/guards; только затем apply и live
проверки. До acceptance same-DB image rollback; старые DB/images/backups сохранять.

D6 obsolete own local archive534852537 и remote partial200540160 удалены с
exact path/owner/non-symlink/size/full-or-prefix SHA guards, только после проверки
отсутствия D6 state/backup; retained images/configs/receipts не удалялись. Это
обновляет сведения о наличии archive в историческом разделе D6 ниже. Mac после
own build-cache/archive cleanup1.3GiB, server1.2GiB free; образы и базы не чистились.
Live acceptance D7 и временный unpaid Saved fixture пока не выполнялись.

## RELEASE-D6 — исправление «Сохранённого» в Git, server rollout отложен

19 октября normal push `37c1bf2f80314db2647514b745da8de7140fba8d` в
origin/staging подтверждён remote refs; входящих commits не было. Clean Git
archive/Next29 pages, production audit0/325 deps и isolated native Linux web7
HTTP проходят. Новый web image:
`sha256:e052c50b333c0815d285b03af211cd377d2b8517e0c26094162cddf70b8a1f5a`,
BUILD_ID `rnbY-9QeXaHIe08g7pb85`. Pinned D4 base/runtime/deps/config прежние;
API/restricted TEST не требуют обновления и не пересоздавались.

**Это не working версия.** SSH несколько раз закрывался при передаче image
archive; openrsync append-verify не поддержан, затем append и chunk stream
прерывались. Prefix SHA проверялся перед продолжением. Полный archive ещё не
доставлен, Docker load/prepare/backup/apply не выполнялись. Последний read-only
осмотр: все семь staging services healthy, API/web/TEST всё ещё D5; config,
working DB, migration history, admin account/password и flags не менялись.
По ответу пользователя «давай потом протестим, делай другие правки» передача,
rollout и live acceptance остановлены. Тестовый аккаунт отдельно разрешён,
но ещё не создавался; новых HTTP/SQL writes/писем/оплаты/S3 не было.

Private local directory0700 (от корня workspace, вне repo):
`.local-artifacts/release-37c1bf2.B5rzP4`.
Server directory0700:
`/home/edem/apps/daryadarcy-staging/release-37c1bf2.B0ZMz0`.
`images.tar.gz` local0600 —534852537 bytes; server partial —200540160 bytes.
При возобновлении сначала сравнить exact partial prefix SHA с local archive,
затем полный SHA из private `archive.json` перед load; не доверять одному размеру.
`rollout-web.py` меняет только STAGING_IMAGE в .env, сравнивает всю Compose delta,
готовит fresh consistent backup и same-DB/admin/schema guards. Только web будет
пересоздан; rollback в пределах незавершённого выпуска возвращает D5 web image
на той же DB. Не запускать старые DB cutover scripts и не восстанавливать dump
поверх текущей DB. После user-deferred возобновление выпуска согласовать отдельно.
Pending scripts ещё не являются server acceptance; итог в начале tasks/todo.md.

## Предыдущий working dev — RELEASE-D5,19 октября 2026

По прямому поручению объединённая версия опубликована в origin/staging и
фактически выпущена на `https://daryadarcy.dev.reeskeen.ru`:
`11e4c6d43d0a10a75a0ae8b85f3171147daee54a`. Сохранён весь frontend123aef8
и backend CF-HTTP1. Последующий documentation-only commit не меняет runtime.
Без ручных правок дизайна, миграций, импорта, смены DB/пароля или flags.

- API/restricted TEST image:
  `sha256:479c7f72e6d564f774fc158c9688f44ebd96d5fb4a86821690b7dc4700bdc0bc`.
  Web image:
  `sha256:9952d6cb1f05171b9cd5252bcbbd12c886690d4adbf20e92991c6139e0e08c86`.
  Running API bundle SHA:
  `d5bca8029fa63655a0625287b08b9e68fa001b10c1503e8fb4ed3d16b26da6a6`;
  running TEST bundle SHA:
  `13c2dee69e909b159e60b2f4d078d46673e833143a501de08543e7978fb20723`.
  Actual web BUILD_ID: `BCIgEvcJAF_SDkYF8wYp7`.
- Source — clean Git archive. Package/lock/config/assets/dependencies прежние;
  pinned D4 base IDs/layers/User/Cmd/Entrypoint/Env проверены до упаковки.
  Новый Next29-page build без build cache в image, старый .next удалён только
  внутри нового immutable image. Native isolated --network none API5/web7/
  restricted TEST3 HTTP pass, exact bundles и BUILD_ID проверены. Merged
  regression2646 pass/1601 opt-in skips/types/lint/API86/32138/boundaries689
  прошли до push; production audit0 advisories/325 deps повторён перед release.
  Initial local FROM image-ID syntax и неверный cwd web probe исправлялись
  только в packaging/check fixture, не в product source или working service.
- Archive535380430 bytes, SHA
  `1783ed2f8e87bc98f76061331243f555c59aa17ad6ab59124ead09084605f54c`.
  SCP/первый stdin transport оборвались до перезапуска; частичный префикс
  сверялся перед resume, полный archive сверялся перед Docker load.
  Только после успешного prepare выполнен guarded image-only rollout.
- Active database по-прежнему `daryadarcy_candidate_20261019`, history42.
  Current schema/admin password hash/role/sessionVersion сохранены, сравнение
  до/после и повторно после публичного входа прошло. Fresh consistent backup
  `before-candidate.sql.gz`0600,351593 bytes/40 tables, SHA
  `e34e00dcc55ec5b2d6ebe344955aecca9c62ccf5e0d3d149e6639320cae4fb94`.
  Все6 side-effect counters были0. Полная Compose delta — только api/web/TEST
  images и TEST bundle source; DB URI/JWT/provider/SMTP/flags прежние.
  Три сервиса healthy/restart0/OOMfalse; остальные26 контейнеров неизменны.
- Public HTTPS23 checks pass: pages/chunk/health/launch config, guest me и
  subscription, videos.catalog default/forward200/backward400, checkoutStatus
  guest401/admin200/notRecorded, same-password admin login/me/stats/logout,
  hasClubAccess. Invalid300KiB к обеим disabled private content procedures
  возвращают pre-body404, ordinary JSON остаётся413. Это проверка фактически
  работающего нового parser admission, не успешная загрузка в S3. Private flags
  не включались; legacy files/S3/платежи/внешние письма не затронуты.

### D5 evidence и откат на той же БД

Server directory0700:
`/home/edem/apps/daryadarcy-staging/release-11e4c6d.rpQ0dY`.
`release-receipt.json`0600 SHA:
`99a36eff889ca84a233dfd1179d59ec39d061b4880e295b7c2f37e9ab5e9bdca`.
Локальные receipts/code вне Git:
`.local-artifacts/release-11e4c6d.SqdAUZ`.
Config copies/state содержат чувствительные операционные настройки: не печатать,
не копировать в Git/чат. TEST source0644 не секретен, parent остаётся0700.

D4 images dcbe4bba…/a0115b67… и previous configs сохранены. Во время неудачного
rollout `rollout-images.py rollback` разрешён только до acceptance и возвращает
images на **той же current DB**, без restore/reverse migration/cutover. D5 прошёл
без server rollback. После accepted новый откат требует отдельного разрешения,
fresh backup/admin/schema/config guards; не применять старый D3 DB-cutover script
или возвращать устаревшую old DB как автоматический откат приложения.

После acceptance удалены только own local/server archive и synthetic1MiB
transport probe, exact path/ownership/non-symlink/size/SHA guards. Archives
восстанавливаются из retained images; backup/configs/receipts/rollback images
сохранены. Server free1176MiB; чужие caches/images/volumes/files не очищались.
Browser/mobile/pilot/full contract acceptance не повторялись. Обсуждённый gate
профиля/«Сохранённого» не исправлялся этим выпуском и требует отдельного решения.

## Предыдущий working dev — RELEASE-D4,19 октября 2026

По прямому поручению свежий frontend staging9e933d2 объединён с AUTH-S2 и
VCAT-C1: merge7433e7f, source/runtime `b7d733814fb3d535bc3a3c624016a10eec490d8f`.
Normal push в origin/staging выполнен; последующий documentation-only commit
не меняет runtime code. Дизайн и ручные компоненты автора сохранены целиком;
единственная интеграционная правка frontend — generated API contract forward.

- API/restricted TEST image:
  `sha256:dcbe4bba90e6cae85517c5dcab21a786188e5251319fa59746752fa178a0cf12`.
  Web image:
  `sha256:a0115b6752e7fb343a970eb444ae75d6151a219bca76c17b444de3bfb82891aa`.
  Backend bundle SHA:
  `ddf280e362fad4dc327079181d375cd31f538ec7873003bc04f80d20e03c38e6`;
  TEST bundle SHA:
  `5fac7afd35ec81b50926a55701d7b4db75d21e3b2b889430c504aa50188d5858`.
  Frontend BUILD_ID: `Cnfusp_tQGMiJ5PRX1B1Y`.
- Package/lock/public assets/Next config неизменны с D3. Reused pinned Linux
  runtime/deps, только clean-source API/TEST bundles и новый Next29-page build.
  Native bundle checksums совпали; root/frontend types/lint/API86/32138/
  boundaries688/docs pass. Full merged suite2601 pass/1597 opt-in skips,
  отдельно real JWT/HTTP/MySQL49 pass/0 skip на own disposable tmpfs backend_test.
  SQL helper fixture не выдаётся за повторную репетицию всей миграционной истории.
  Native isolated web7 HTTP/restricted TEST3 HTTP, production audit0/325 deps.
- Только api/web/prodamus-test пересозданы; все healthy/restart0/OOMfalse.
  Остальные26 контейнеров не изменились. Compose delta проверен целиком:
  только три image references и TEST bundle source. DB URI, JWT, SMTP, provider
  settings, permissions и runtime flags сохранены. Схема/history42/admin
  hash/role/sessionVersion прежние; старый password login успешно проверен.
  Working DB по-прежнему `daryadarcy_candidate_20261019`; старую DB не читали
  для переноса/не меняли. SQL apply/copy/seed и S3 операций не было.
- Public HTTPS20 checks: catalog без direction/forward200, backward400,
  normalCheckoutStatus guest401/admin200/notRecorded, subscription.hasClubAccess,
  same-password admin login/me/admin.stats/logout, страницы/launch config/chunk.
  CUA browser после гидрации `/videos`:20 настоящих карточек, «Показать ещё»,
  без ошибки каталога. Плееры/оплата/внешняя почта не запускались; это не full
  end-to-end подтверждение договора2.1, mobile, legacy files или реальных денег.

### D4 evidence и проверенный image-only rollback

Server private directory0700:
`/home/edem/apps/daryadarcy-staging/release-b7d7338.k9MJvF`.
`release-receipt.json`0600 SHA:
`1a2a8578e1d3621a6e2ef79a5051e5f61feead6ab7f236af7b2a2e5d8b80228b`.
`state.json`, `before-config.json`, `before-*`/`after-*` config copies0600 —
секретные операционные файлы, не печатать/не переносить в Git или чат.
Локальные matching receipts/code вне Git:
`.local-artifacts/release-merge-20261019.k6ps1h`.

Первая попытка была **откачена**, не принята: новый TEST bind-mounted source
имел0600 и был нечитаем node UID. Сохранены `attempt1.json` и частный failure log.
EACCES подтверждён native чтением, только non-secret `prodamus-test.mjs` получил
0644; parent0700 и configs/backups0600 сохранены. Затем actual Linux TEST startup
и3 HTTP checks в `--network none`/без DB/с synthetic provider config прошли.
Повторный guarded rollout принят. Это ошибка доставки файла, не смена платёжного
режима/провайдера и не изменение source API. Откат реально вернул D3 images на
той же DB: без restore, reverse migration, переключения на старую БД или password
reset. Старые API `b8e2a908…` и web `3b3011d6…` образы сохранены.

Перед обеими попытками side-effect queues проверены0. `before-candidate.sql.gz`
и `before-retry-candidate.sql.gz`0600 — два consistent single-transaction dump
active DB, gzip прочитан/40 таблиц подтверждены. Не восстанавливать их вслепую.
`rollout-images.py rollback` ограничен pre-acceptance фазой; после accepted новый
откат требует отдельной авторизации, fresh backup/schema/admin/config guards и
same-DB image-only процедуры. Старый D3 `rollout.py` **не применять**: он относится
к первоначальному DB cutover. Никогда не возвращать устаревшую old DB как
автоматический откат приложения после новых записей.

После приёмки удалены только новые собственные `images.tar.gz` на Mac и сервере:
exact path/non-symlink/size/SHA256 guards, архив воспроизводится из retained images.
Образы, два DB backup, configs, receipts и TEST bind source сохранены.
Server после cleanup:1249MiB свободно; чужие файлы/образы/volumes не удалялись.

## Предыдущий working dev — RELEASE-D3,19 октября 2026

Пользователь явно разрешил обновить backend **и frontend**, переключить приложение
на проверенную candidate, сохранить admin/password и старую DB для отката.
Отдельно подтвердил VK catalog и normal checkout recovery; private flags/S3/
legacy files не входят в разрешение. **Выпуск выполнен, публичный API проверен.**
Исторические запреты switch и результаты2083911 ниже относятся к прежним этапам,
а не описывают текущую working версию. Не переисполнять empty-candidate import.

- Source: `da47b54c19129a8eeee976312bc3bd4f9e7cbbd3`, включая AUTH-S1.
  Backend/ограниченный TEST image:
  `sha256:b8e2a908108e667c04975f3873c95c8e828c77e0b7d98e83cb81bcaff00ed21c`.
  Web image:
  `sha256:3b3011d62dfa641204e8494828cc4435ca461610673b91da3f43e1f7828ecac2`.
  Это новые exact images, не старые e774/0763. Неизменённые Linux runtime/deps
  из0763 (lock/package unchanged since2083911), новые API/TEST bundles из clean
  Git archive, Next29-page build. Frontend source совпадает с remote staging e25ffda;
  дизайн/компоненты вручную не изменялись. Labels/full revision/non-root verified.
- Actual main bundle SHA:
  `35d8613396ff0487e1b61091c2a90169e2d006f082c11b9317da4b84f4a63fa8`;
  TEST bundle SHA:
  `0ac8f24c2e4eb893b59e7d9ea5206c582886984c145fd0189c6bed601ee7a48a`;
  frontend BUILD_ID: `7i5Wu32yYc4hxf-fZKfrm`.
  Frozen production audit0/325 deps; targeted regression84, root types/API86 pass.
  Native isolated web7 HTTP checks; actual candidate39 ORM/18 HTTP, same password.
- Working database: `daryadarcy_candidate_20261019`, existing42 history unchanged.
  Source `daryadarcy_staging` retained and unchanged after write boundary; no
  migration-history repair, reverse SQL, seed, truncate or source DML.
  Fresh boundary comparison850 rows/29 tables, only users activity differences;
  counters already at/above source floors. Old API/TEST stopped before final
  comparison/dumps; only api/web/prodamus-test recreated with exact immutable IDs.
  Original JWT/SMTP/provider configuration preserved; candidate-only permanent
  runtime SQL account, VK_CATALOG_ENABLED/NORMAL_CHECKOUT_RECOVERY_ENABLED=true.
  Frontend matching flags=true, prior Prodamus TEST=true/YooKassa TEST=false remain.
  Working private content/library flags remain disabled. No S3 operations.
- Public HTTPS16 checks pass: videos.catalog200; normalCheckoutStatus guest401,
  same-password admin200/notRecorded; club.subscription boolean hasClubAccess;
  login/me/admin.stats/logout, launch config and frontend pages. This is **live
  acceptance**, unlike previous isolated image checks. No payment or external
  mail tests; pending provider-effect queues0 before startup. Existing seven
  project services healthy; three new restart0/OOMfalse, other26 containers
  unchanged. Existing edge nginx tested/reloaded for updated Docker DNS only.
  Actual native worker gzip backup contains40 tables; file0600/dir0700 checked.

### Evidence, backups and rollback boundary

Server private directory (0700):
`/home/edem/apps/daryadarcy-staging/release-da47b54.al4N82`.
`release-receipt.json` (0600), SHA:
`608a539ff9ef864d7d0bf48e01811da651fa6769a35dd14ad80f1c2358d321c1`.
It records16 public HTTP checks, admin hash/identity preservation, source hashes
unchanged after the write boundary, candidate history/schema and actual images.
`final-check.json` additionally verifies native worker backup/health/cleanup.
Local matching private receipts/code under `.local-artifacts/release-20261019.RrRO3g`
outside this repository; no credentials/rows/cookies are recorded in Git.

`before-*.sql.gz` (0600) retain source29/candidate40 table snapshots, gzip validated;
`before-*` config copies and `before-config.json` preserve exact prior image/env
and JWT values privately. `rollout-state.json` contains candidate credentials:
never print/copy it into Git or chat. Previous images and old DB were retained.
Only confirmed own archives/caches removed with exact guards. Export archives
can be recreated from retained images; receipts/checksums were kept.

`rollout.py rollback` is intentionally restricted to pre-acceptance states.
After `running-new`, **do not blindly switch to the stale old DB**: pause writers,
back up candidate, compare new writes and agree reconciliation first. Never run
historical C/D1 copy, recreate the populated candidate or repair0017–0019 as a
rollback shortcut. No reverse migration or SQL restore was performed here.

Known separate remainder: old public pattern/static/Yandex URLs are unchanged;
this release does not revoke anonymous access or purge their long-lived cache.
Actual money/provider flows, old-file migration and mobile acceptance are not
certified by these checks. No Git push was performed for this deployment.

## Историческая граница разрешения до RELEASE-D3 —19 октября 2026

FRESH-C4 разрешала **только локальную подготовку** образа и процедуры отката.
Следующее прямое поручение FRESH-C5 разрешило transfer/load точного image только
для isolated SELECT-only API check на существующей БД-кандидате; выполнено ниже.
Следующее прямое поручение FRESH-D1 разрешило data-only snapshot в candidate
с сохранением admin/password, без source writes/switch; выполнено ниже.
FRESH-D2 разрешила transfer/load corrected0763 image, isolated API acceptance
на populated candidate и read-only source delta, не sync/switch; выполнено ниже.
Этот документ и example override не разрешают deployment, restart/switch рабочих
сервисов, permanent grants, seeds, SQL apply, S3 mutations или private flags.
Текущая БД, frontend и существующая конфигурация rollout остаются прежними.
Результаты схемы/API кандидата: [основной runbook](teamassist-staging.md).

**Актуализация AUTH-S1,19 октября:** после D2 локально исправлен ложный guest
при временном сбое проверки сессии; см. [API-контракт](../architecture/api.md).
Images2083911/e774/0763 этого fix **не содержат**. Проверки D2 ниже исторически
валидны для0763, но не подтверждают актуальный исправленный source. Перед
будущим rollout нужен новый image с AUTH-S1 и отдельная isolated acceptance;
не переключать приложение на0763 как на «последний исправленный backend».
Новый image/transfer/load/deploy по AUTH-S1 не выполнялись и не разрешены.

Состояние подготовки: **исправленный image0763 принят на server candidate**
в FRESH-D2 ниже:39 ORM/13 HTTP, admin/password сохранены. D1 data snapshot850
rows принят; D2 source delta — только activity timestamps, без sync/switch.
Native backup/restore10/10 и offline image2/2 прошли в FRESH-C6 ниже.
Original e774 image принимался в C5 на server candidate42:39 ORM +8 HTTP,
но C6 нашла backup directory0755 и подготовила исправленный0763 image.
Разрешения на deployment/switch нет; transfer/load обоих images был только
для изолированных проверок, не release approval.

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

## FRESH-D1 — data-only snapshot в существующую candidate

19 октября по отдельному разрешению скопированы данные из `daryadarcy_staging`
в `daryadarcy_candidate_20261019`. Source только SELECT/read-only consistent
snapshot; никакого repair0017–0019, migrations/history или app-data writes в
старую БД. Приложение не переключалось, working DB connection осталась прежней.
Candidate до переноса:39 пустых application tables +42 migration rows;
source:29 tables/no history/850 rows. Column/index/engine/UUID/container guards
подтверждены до копирования; foreign keys/triggers/routines/events отсутствуют.

Воспроизводимый helper [candidate-data-transfer.ts](../../tooling/scripts/candidate-data-transfer.ts)
не импортируется executable приложения. Только exact live pair/UUID или own
два disposable `backend_test`; источник обязательно без history. Preserving
explicit common columns, nullable widening, только удовлетворимые new columns;
даты/JSON/bigints без преобразования типов. Bounded snapshot в RAM, без dump
user rows на ноутбук/в Git/логи. Один candidate DML transaction, count+SHA всех
common rows перед commit, warning/constraint/schema mismatch → rollback rows.
Counter-only ALTER candidate выполняется **до** transaction: при отказе могут
остаться повышенные counters, но не частично committed rows; counters не снижать.
Helper не является разрешением запуска или универсальным мигратором старой DB.

RED→GREEN:6 mapping units +4 real MySQL8.4 tests, own fresh42/legacy29 tmpfs
fixtures. Непустой target refused; native case-insensitive identity conflict
откатил все rows без утечки SQL/data. Synthetic Unicode/JSON/admin/password hash/
session/paid subscription/opaque mail+token rows и counter floors сохранены.
Дополнительно local data API:39 ORM/13 HTTP. Root types/docs/diff pass.

Actual server copy:29 tables/850 rows, per-table count+SHA exact. Сохранены742
posts/60 videos/2 users/10 payments/2 receipts/8 outbox/7 password_tokens/17 tags/
2 consents. Скопированы старые URL strings, **не** S3 objects/ACL. New video
provider/access default youtube/public, VK/poster nullable; all10 new tables0.
Admin id1/password hash/role admin/sessionVersion2/blockedAt exact. Fresh42
hashes сохранены без переписывания. Source count/history29/none остались прежними.

Временная SQL identity: SELECT source, SELECT/INSERT candidate +ALTER только
candidate counter tables. Перед API source/INSERT-all grants отозваны; API
разрешены SELECT candidate и INSERT/UPDATE users для штатного login upsert.
Working session/encryption/provider secrets не читались; password hashes
перенесены opaque. Existing owner login password взят в памяти из уже
согласованного private0600 file.
Image e774/source2083911 и его production deps, compiled composition-only probe
без executable/workers. API source/schema/lockfile между2083911 и D1 неизменны.
UID1001, internal network/no ports, read-only root/mount, cap-drop/no-new-privileges,
256MiB/CPU0.4. Exact39 ORM +13 HTTP: guest lists/launch/auth, protected admin401,
default-off file404, wrong password401/no cookie, old password login200,
me200/admin.stats200/logout200/secure host-only cookie. Exit0/OOM=false.
Login меняет только candidate activity timestamps (и может создать ID gap из
штатного upsert); protected hash/role/session/history после него сверены.

Оба own server probes/technical account/upload удалены guarded. Все29 existing
containers IDs/images/start times/health совпали до/после; current HTTPS200.
Final read-only:850/850 rows,10 new tables empty, counters не ниже source.
Own local test DB containers/network удалены, чужие2 containers/12 volumes и
все images сохранены. Safe receipt локально вне Git:
`.local-artifacts/candidate-transfer-20261019.4m7y89/operation-receipt.json`;
server `/home/edem/apps/daryadarcy-staging/candidate-transfer-20261019.EjmNRV/receipt.json`.
Обе копии SHA-256:
`5002210c4046aaac2430fea97324feef6904e8fd0d7d87c11679053315af4a44`,0700/0600;
отдельный final-verification.json содержит безопасные aggregate checks.

**Не повторять copy/initialize или прежний empty-target `--check-api`: target
теперь содержит данные.** Не ослаблять empty-target checks ради нового прогона.
При потере SSH после commit сначала прочесть safe receipt и проверить target;
не truncate/delete/retry blindly. Это подготовленный snapshot, а не continuous
sync. Source остаётся активной: перед отдельно разрешённым cutover нужны свежая
дельта/write boundary, backup, permanent app grants, сохранение прежних session/
encryption/provider settings и rollback policy. Pending outbox не replay вслепую.
Corrected0763 image ещё не загружен/не проверен на сервере; D1 относится только
к прежнему e774 runtime, не закрывает corrected-image gate. Для future read-only
probe populated target проверять schema/guest responses без ожидания users0/
empty feed; login probe отдельно требует минимальных candidate users grants.
Ни frontend/deploy/push/switch, ни S3/payment/mail/workers acceptance не выполнялись.

## FRESH-D2 — corrected image и проверка новых изменений после D1

19 октября13:44MSK. Exact artifact0763/source2083911, archive SHA-1b957…/
266596352 bytes и D1 receipt SHA-500221… проверены перед подключением. Exact
host/user/API/MySQL IDs/images/start times/health/UUID/internal network прежние,
history42 hashes совпали. До upload free1735MiB/RAM available~594MiB; rebuild/
install/pull на shared server не выполнялись. Архив загружен в own private700
directory, его SHA подтверждён **перед** docker load. Image metadata/amd64/
non-root/config/source label и executable bundle SHA-bb977… подтверждены.
В каждом probe `/app/backups`0700/UID1000: исправление C6 присутствует в image.

Delta: один consistent read-only snapshot охватил обе БД через временный
SELECT-only account. Общие columns/PK из проверенных metadata, JSON/dates/
bigints/UTC без преобразования, canonical D1 row-digest algorithm, bounded RAM,
никаких actual row values вне сервера/в логах. Comparator отдельно проверен
на5 synthetic cases в offline image: insert/delete/update/row-order/guards.
На сервере850 rows в каждой БД. Все28 таблиц, кроме users, совпали с D1 SHA;
в users2/2/no insert/delete. Различие одной строки между source/candidate:
только lastSignedIn/updatedAt, не контент/подписки/права/credentials. Admin id1
password hash/role admin/sessionVersion2/blockedAt совпадают.10 added tables
пусты, columns/history42 прежние. Это сверка текущего состояния, не CDC/audit
всех промежуточных изменений; после момента проверки source остаётся активной.
Никакие timestamps/data не синхронизировали и не перезаписывали.

Дополнительная read-only metadata сверка подтвердила unchanged indexes/table
engines/collations, triggers/routines/events/FK0. Обнаружена и техническая
delta: users AUTO_INCREMENT source next500/candidate499 на13:50MSK, при2/2
rows. Counter не выравнивали по поручению «проверить», а не синхронизировать.
Перед future cutover нужен свежий floor не ниже source на согласованной write
boundary, а не hardcoded ALTER500 по устаревающему наблюдению. Supplementary
checker сначала отказал из-за порядка JSON keys при string comparison; deep
object comparison/captured metadata подтвердили отсутствие schema drift.
Minimal private comparator RED→GREEN2, реальная смена engine по-прежнему
отклоняется; повторная проверка сохранённых metadata локальна, SQL не replay.
Это диагностика own operator, не изменение схемы или приложение.

Перед API source SELECT grant отозван; account получил только SELECT candidate
и users INSERT/UPDATE для штатного login. Actual image0763 production deps +
**неизменённый** D1 composition probe bundle, не старый empty-target CLI.
39 ORM/13 HTTP pass: guest/auth/launch/feed/articles, admin401/default-off files404,
wrong password401/no cookie, прежний password login200/me200/admin.stats200/
logout200 и secure host-only cookie. Protected hash/role/session/history после
login сверены. В candidate обновились только обычные login timestamps/возможный
AUTO_INCREMENT gap штатного upsert. Working env/session/provider secrets не
читались; пароль использован только в памяти из прежнего private owner profile.
No production CMD/WorkerJobs.start/providers/S3/mail/payments. UID1001/internal
net/no ports/read-only/cap-drop/no-new-privileges/256MiB/CPU0.4, exit0/OOMfalse.

Оба own containers/technical account удалены guarded; own uploaded archive254MiB
и code files удалены по hashes после успеха. Local original archive, loaded0763,
e774 и working images сохранены. Все29 existing containers IDs/images/start
times/health совпали, рабочая DB connection daryadarcy_staging/current HTTPS200.
Private server directory0700/receipt0600 содержит только safe receipt:
`/home/edem/apps/daryadarcy-staging/candidate-final-20261019.SCIDGJ/receipt.json`.
Local `.local-artifacts/candidate-final-20261019.4w5NSy/verification.json` вне Git;
обе копии SHA-256:
`89392d893c58f71d2192acce137f8ed3161da398626b508c4aa904fd0a07de72`.
Рядом local/server `postcheck.json` дополняет receipt metadata/counter checks;
SHA `6e603b4c46ceb6c3fb29ff3aa72bbd9830763b1b79326055233f888010e4f0c1`.
Никаких source data/schema writes, sync, frontend/S3/push/deploy/app switch.

Corrected-image candidate gate закрыт для неизменного0763 artifact. Это не
разрешение switch и не проверка production workers/провайдеров, backup working
mount/off-site или production-scale concurrent-write recovery. Перед будущим
switch: новая delta/users counter floor на границе согласованных writes/downtime,
backup/rollback, permanent minimum grants и сохранение working session/
encryption/provider config. Original0017–0019 preflight не обходить. Успешные
unchanged local native backup tests C6 не повторяли без изменения artifact.

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
6. Corrected0763 image на populated candidate проверен в FRESH-D2:39 ORM/13 HTTP,
   без workers/providers/egress; temporary account/process удалены. Не повторять
   прежний empty-target CLI, не выдавать D2 за write-cutover. При изменении image/
   schema/context требуется новая isolated acceptance. Native backup/restore
   именно с image client на own disposable
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
