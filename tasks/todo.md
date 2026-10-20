# Daryadarcy Modular Monorepo

## Активный чек-лист агента — 13 октября 2026

### Действующая граница — frontend не менять, 20 октября

#### RELEASE-VK — запрос обновить staging/server,20 октября: preflight stop

- [x] Получено явное разрешение push/server update с локальным backend и свежим
  frontend. Fresh fetch:origin/staging=b32d0bc, HEAD2e12c80 ahead23/behind0,
  clean tree. CI configs содержат verify, не автоматический deploy. Старые scripts
  rollout-images.py/storage-rollout.py привязаны к прежнему baseline: не запускались.
- [x] Read-only server155.212.216.16/teamassist-dev/uid1001: API2c604839f745,
  web e84c205cc6c7 и все8 project containers healthy. Один SSH banner timeout
  до исполнения, следующий retry успешен. SQL SET/START TRANSACTION READ ONLY,
  readOnly1, database=daryadarcy_candidate_20261019/history42/adminExists=true.
  Video groups:youtube/public/published=60, VK=0. API namespace launch/catalog/
  legacy list200, оба списка60; внешний Mac HTTPS catalog200/60.
- [x] check:api повторно RED/outdated. Локальный VK-only4c04d62 выключает legacy
  и фильтрует каталог: полный выпуск на подтверждённых данных даст0 роликов.
 22-src export не импортирован и не заменяет60 прежних записей/ID/access mapping.
  Не обходить CI/preflight, не наполнять working DB и не менять flags автоматически.
- [ ] Нужно решение: выпустить остальные правки с отложенным VK-only cutover
  (рекомендовано) либо сначала согласовать/завершить VK migration и затем полный
  выпуск. Вопрос пользователю задан. После решения — точный release source,
  generated contract coordination/check, audit/build/backup/guards/rollback,
  image-only rollout и real API postcheck. На этом шаге NO push/deploy/restart,
  DB/S3/schema/users/env/provider flags не менялись; рабочий сервис прежний.

#### FE-SYNC — подтянуть авторские правки фронтендера,20 октября

- [x] По отдельному поручению fetch origin/staging:becaf6d→b32d0bc, один новый
  frontend commit/70 files. Clean worktree до начала, текущая feature-ветка
  сохранена; локальный merge467253e с родителями17a0dea/b32d0bc без конфликтов.
  Apps/frontend byte-exact origin/staging; ручных правок фронта не добавляли.
  Backend/database/tooling byte-exact17a0dea, все21 локальных commits сохранены.
- [x] Проверки после объединения:301 pass/12 suites/0skip/5.04s; root/frontend/
  E2E TypeScript, ESLint, frontend production build29/29, boundaries712/docs64/
  diff GREEN. Браузер/живые API/SQL/S3 не проверялись; env/flags не менялись.
- [x] Авторский commit удаляет20 старых public pattern variants только из local
  frontend tree; публичные обложки сохранены/test GREEN, удалённое восстановимо
  из Git history. Working S3/server/DB/admin и Downloads exports не затронуты.
- [ ] Прежний check:api остаётся RED/outdated. Контракт не перегенерирован:
  отдельная координация с фронтендером, не самостоятельная ручная правка UI.
  Это локальная синхронизация, не разрешение push/deploy или дальнейших frontend
  изменений. Публикация/новые flags/закрытие старых внешних sources не выполнялись.

#### VK-COVER — качество обложек всех22,20 октября

- [x] Read-only scope: JSON22, предоставленные PDF/HTML и локальные app/own
  artifact image paths; без VK/CDN media requests, frontend/working DB/S3/push/deploy.
  PDF2 страницы просмотрены полностью; embedded rasters сопоставлены с22 link
  annotations по геометрии, split-page объекты дедуплицированы.
- [x] В новый private Downloads/daryadarcy-vk-cover-audit-20261020.GjUur6 извлечены
  19 PNG в native533–537x300–301, без crop/upscale/перерисовки. Manifest22 rows,
  SHA256/size/Pillow decode/permissions0600 проверены, unique images19,
  candidate bytes5443271; contact sheet визуально просмотрен. Не готовые большие
  обложки: highResolutionVerified0/importReady=false. Hash/подписанные URLs вне Git.
  Final QA:22 source mappings/source PDF SHA unchanged/expected3 missing/directory
  0700/contact JPEG decode GREEN; docs64/diff GREEN, app/tooling/tests diff пуст.
- [x] PDF не содержит картинок456239226 (зимний декор),456239052 (переделка комнаты),
  456239035 (День Валентина). Сохранённый HTML:img0; проверенные локальные image
  paths не дали больших VK-исходников. Пользователь подтвердил: оригиналов нет.
- [ ] Полный набор22 больших обложек не получен. Предложенный официальный путь —
  разовая пользовательская выгрузка video.get/image с размерами; схема требует
  user authorization. Новую авторизацию/сбор токенов не настраивать без решения;
  не обходить browser site-safety, не менять size подписанного CDN URL наугад.
  После получения sources проверить actual bytes/dimensions/визуальное соответствие;
  1280x720 — рекомендация для крупной карточки, не новое требование договора.

#### VK-META — пакетный сбор метаданных,20 октября

- [x] V1: existing TXT распознан как22 unique community-211171256 URLs;
  native CLI --plan: sourceCount22/networkRequested=false. RED1→GREEN16.
- [x] V2:3127a95, явный official video.getOembed collect без credentials/cookies,
  bounded body/timeouts/no redirect, match iframe oid/id через existing parser,
  thumbnail metadata без скачивания; private new output/no overwrite. Проверить
  на own loopback provider server, не обходить browser VK site-safety блок.
  RED19→GREEN36, CLI RED3→GREEN43; review RED quoted-title fake-src→GREEN44,
  mixed batch→45. Final metadata45 + existing VK validator18:63 pass/2 suites/
  0skip/1.99s; TSC/Prettier/boundaries704/diff GREEN. Полный suite не запускался.
- [x] [Handoff одной команды](../docs/development/vk-metadata-export-2026-10-20.md):
  status/errors/exit0/1/2, JSON0600/outside Git, no overwrite, no HTML execution,
  paused after external failures не выглядит success. Test-only processes/server/
  directories закрыты/удалены. Working DB/S3/frontend/runtime/deploy untouched.
- [x] Первый реальный export выполнен пользователем:0 ok/22 incomplete/0 failed;
  локальный JSON содержит22 titles/thumbnail URLs и22 invalid_embed. Пользователь
  предоставил raw response одного ролика: причина — единственный `__ref=vk.web2`.
  Browser policy не обходилась, агент не выполнял реальные VK calls.
- [x] Узкий collector-only fix: удалить только один известный __ref перед прежним
  parseVkEmbed; неизвестные/дублированные параметры, чужой host/oid/id, missing hash
  по-прежнему отвергаются. Application validator/API/frontend не менялись.
  RED2→GREEN73/2 suites/0skip/2.29s (55 collector+18 validator), native CLI проверен
  на multiline HTTP fixture с synthetic hash, без raw HTML в отчёте. TypeScript,
  docs64/boundaries704/Prettier/diff GREEN; full suite/live export не запускались.
- [x] Пользователь выполнил повторный live export после d9e7c50:22 ok/0 incomplete/
  0 failed. Read-only проверка локального -v2.json:22 unique sources/players,
  matching oid/id для всех22, source TXT missing0, strict parser принимает все,
  autoplay0/no __ref, titles/HTTPS cover URLs заполнены, output0600. Агент не
  выполнял сетевых VK calls и не копировал exports/hash в Git.
- [ ] Остаток: у13 cover URLs указан size130x96, у9 размер в URL не указан.
  Реальные bytes/dimensions/качество не проверены; не использовать как готовые
  большие обложки. Public/club/published, old/new ID mapping, разрешённые публичные
  covers, импорт и playback acceptance — отдельный шаг. Все readiness flags false.

#### VK-ONLY — убрать YouTube из раздела Видео,20 октября

- [x] Подтверждён backend-only scope/документ фронтендеру; old source rows,
  рабочая DB/S3/стенд/frontend вне изменений. Никакого массового fake-ID import.
- [x] 4c04d62: catalog provider=vk до cursor/limit; playback output только VK,
  YouTube ID404. Legacy list=[]/detail=undefined без fallback даже с VK flag off;
  valid admin.importVideos404 без writes, auth/input validation прежние.
  Удалён backend youtube-stream proxy; standalone worker с текущим пустым
  catalog не выдаёт GET/HEAD/Range/thumb даже при warm cache. Schema/rows прежние.
- [x] RED7 native HTTP/JWT/SQL→GREEN7. Финальный affected Vitest260 pass/
  13 suites/0skip/8.56s, TSC/build/docs63/boundaries704/diff exit0. После
  изоляции fixture title от старого cleanup-prefix ещё7/7,1.50s. Общий исторический
  suite не запускался; frontend parsers проверены read-only, frontend diff пуст.
  check:api exit1/outdated: generation только фронтендером, не обходить запрет.
- [x] Exact owned container b58741e5…/loopback49542/tmpfs512MiB/volumes0 удалён
  по ID/name/labels/mount/port guards. Удалена только синтетическая БД; images,
  чужие контейнеры/БД, рабочие rows/файлы не менялись. Backend proxy восстановим
  из Git, рабочий сервис не останавливался. S3/network/provider не вызывались.
- [x] Два существующих video-fixes документа обновлены: VK-only contract,
  removed paths/UI fallback, regenerate types, rollout gate и все22 page URLs
  с названиями/временем из PDF. Hash не сохранён и iframe не выдумывался.
- [ ] До выпуска:22 iframe/title получены через VK-META; остаются covers/access,
  согласованная карта old/new IDs и наполнение, frontend integration/real VK
  playback acceptance. Один backend не выпускать: старый клиент/пустой VK
  каталог иначе останутся без видео. Рабочие данные/фронт/push/deploy не разрешены.

#### U1-ISO — повторная приёмка загрузок,20 октября

- [x] Пользователь разрешил отдельную одноразовую БД и новые synthetic S3
  fixtures для upload/read/размеров/audio/video/revoke. Working DB, старые
  objects, frontend и deploy вне scope; прежний working-DB helper не запускать.
- [x] Preflight: clean353bc75/прежняя feature branch, Docker29.8.1 отвечает,
  disk843MiB. Ранее предоставленный S3 profile найден вне Git с правами0600;
  значения не выводились. HTTPS HEAD: curl28/SSL timeout; SDK GetBucketPolicy
  с maxAttempts1/absolute12s: TimeoutError, HTTP-ответ отсутствует. Причина
  прежнего read assertion не установлена. Новые DB/objects не создавались.
- [x] Независимая проверка `pnpm exec vitest run tests/private-content-request-bodies.test.ts --maxWorkers=1`:
  exit0,26 pass/0skip,3.83s. Реальный HTTP/JSON/JWT и полные Base64 envelopes
  4/32MiB; превышение decoded/envelope quota413, admission/roles/503 проверены.
  Account SQL заменён double, upload SQL/S3 не вызываются: НЕ сквозная загрузка.
- [ ] После восстановления соединения с S3 продолжить actual API/SQL/S3
  на own loopback/tmpfs backend_test: audio/video/read/размеры/revoke,
  exact metadata/ETag cleanup новых UUID objects. Не повторять неизменный
  quota suite; published U1 acceptance остаётся незавершённой.

#### VIDEO — локальный backend контракт и переход на VK

- [x] FOLLOW-UP «доделай всё» в прежних границах: найден и исправлен разрыв
  сохранения обложки VK. admin.upsertVkVideo принимает thumbnailUrl?/null;
  отсутствие сохраняет при update, null очищает, unsafe URL400 без изменения
  строки, изменённый create409. Единая политика с catalog, без uploads/migrations.
  RED2 HTTP/SQL400 → GREEN102/5 suites. Реальная потеря ACK после commit через
  loopback HTTP relay, concurrent create без дублей. TSC/backend build/docs GREEN.
  Code commit b6dbdf4, frontend не менялся; check:api по-прежнему RED/outdated.
- [x] Свой follow-up backend_test611501a3… удалён после ID/labels/tmpfs/loopback
  guards, volumes отсутствовали. Образы/чужие данные/working DB/S3 не затронуты.
- [x] Два video-fixes handoff документа приведены к текущему VK-контракту:
  точные поля/ошибки/retry/null, список действий фронтендеру и приёмка. Это не
  выкладка или live VK acceptance; старый YouTube-сбой не объявляется исправленным.

- [x] Пользователь разрешил backend-правки по handoff, без frontend/working
  DB/S3/push/deploy; затем уточнил VK вместо YouTube. YouTube-доработку
  приостановить, старый обрыв не считать исправленным.
- [x] Read-only staging: edge `/api/yt/` → video:8082, cached first video
  96197089 bytes, public HEAD200/video-mp4/Accept-Ranges. Это не full GET или
  browser acceptance; несколько SSH подключений зависли до авторизации.
- [x] RED8 HTTP/SQL400 → opt-in includeThumbnails. True добавляет безопасный
  thumbnailUrl/null; false/отсутствие сохраняет прежний strict-клиентский ответ.
  Только existing public image namespaces, без внешних fetch/N+1/миграций.
- [x] GREEN93/5 suites: real loopback SQL/HTTP, VK access/worker границы,
  существующие frontend parsers read-only; root TypeScript/backend build GREEN.
- [ ] Generated frontend contract ожидает штатной генерации фронтендером:
  check:api RED/outdated, намеренно не менялся под запретом frontend.
- [x] После wall/Widgets.Post получен реальный iframe video_ext.php на vk.ru,
  oid=-211171256/id=456239238. Локально parseVkEmbed/vkVideoInput принимают URL,
  canonical replay/autoplay0/public+club input и отказ wall/JS проверены.
  Полный URL/hash в Git не сохраняется; валидатор не требовал исправлений.
- [ ] Browser tool отклонил открытие VK по site-safety policy; обход не делался.
  Live VK playback/seek/наполнение обложек не приняты. Working catalog не менялся.
- [x] Свой container67ec05eb… удалён после guards exact ID/labels/tmpfs/loopback,
  volumes отсутствовали. Только synthetic backend_test; images/чужие БД не тронуты.

#### WIN-LIVE — разрешено включение и проверка четырёх выкроек

- [x] Пользователь подтвердил включение Library flag для4 ready winter bindings.
  Дополнительно разрешил2 временных test-only аккаунта и1 synthetic access row,
  без provider/почты, с точным удалением только fixtures. Frontend/старые файлы/
  «Лошадка»/recipes/Petersburg остаются вне переноса; credentials admin сохранить.
- [x] Fresh preflight: тот же API image15865765…/schema42/4 ready bindings;
  normal production dependency audit0. Consistent backup40 tables/353120 bytes,
  SHAa53f157b… server/local0600 одинаковый; config/snapshot/rollback сохранены
  вне Git в library-enable-20261020.ER3Dqo. Пока это не acceptance.
- [x] Включить ровно PRIVATE_LIBRARY_FILES_ENABLED, recreate только API,
  edge config reload без правок; остальные images/services/flags/DB прежние.
- [x] Public HTTPS: admin/member четыре byte-exact WebP GET/HEAD/Range;
  guest/unpaid/удалённые test sessions denied на list/direct API URL,
  anonymous direct S3 denied; точная очистка2 users/1 synthetic access row.
- [x] Проверить baseline40 tables/schema/bindings/config и admin credentials;
  normal admin activity timestamps не восстанавливать. При неуспехе — guarded
  rollback одного флага, не whole-DB restore и не удаление рабочих files.
- [x] Первый WIN-LIVE: recreate только API7e2e5c3f… с прежним image; guest/unpaid
  denied и4 admin byte-exact/HEAD/Range прошли. Authorized group затем TypeError
  клиента, точная граница не сохранена — не объявлять причиной S3/прав доступа.
  Обе temporary users и1 access row удалены, baseline/schema/bindings сохранены
  (кроме normal admin activity). Флаг safely rolled back, API2169d6d4…healthy.
  Добавлена только диагностическая точка в private harness, проверки не ослаблены;
  выполнен один guarded повтор Mac-прогона после проверки исходной конфигурации.
- [x] Повтор Mac: admin/apple GET уже HTTP200/Content-Length972770,
  body не завершился до абсолютного30s deadline harness → TimeoutError.
  Снова scoped cleanup и rollback, API741b77e7…healthy; это не установленный
  дефект прав/S3. Из того же API namespace отдельно прочитаны все4 S3 copies:
  byte-exact, full GET417/51/54/73ms. Старые objects не читались/не менялись.
  Дальше отдельный public verified HTTPS прогон с staging host, не выдавать
  его за успешный Mac/browser прогон и не ослаблять server access checks.
- [x] Финальный WIN-LIVE accepted:89 checks с staging host через public verified
  HTTPS, без TLS bypass. Admin/member list200/4 exact WebP, full GET SHA/HEAD200/
  Range206; guest/unpaid/deleted-fixture tokens list/direct GET/HEAD/Range404,
  anonymous direct S3 GET/HEAD403. Full GET246–359ms. Это проверка backend API,
  НЕ Mac/browser/frontend приёмка. Mac absolute30s body abort не исправлялся
  изменением продукта или ослаблением assertions; его точная внешняя причина
  не доказана. Server acceptance выполнялся независимо от нестабильной SSH.
- [x] Library flag true/content true, API2c604839… image15865765…healthy/restart0;
  остальные containers/images/config/flags прежние. Тот же backend/DB, без
  push/image deploy/migrations/frontend. Все temporary users/access rows всех
  прогонов удалены; исходные40-table fingerprints совпали кроме normal admin
  lastSignedIn/updatedAt. Credentials/role/session и schema42/4 bindings прежние.
  Рабочие4 S3 copies сохранены, S3 writes не было. Private receipts:
  library-enable-20261020.ER3Dqo/server-acceptance.json + enabled/cleanup.json;
  точный откат env сохранён. Старые public sources не закрыты, «Лошадка»/
  recipes/Petersburg не перенесены. Передача фронтендеру обновлена.

#### WIN-PREP — новая разрешённая подготовка четырёх выкроек

- [x] Пользователь разрешил новые private copies и4 bindings в рабочей БД,
  пока без включения Library flag. Scope зафиксирован в plan; старые public
  sources/«Лошадка»/recipes/Petersburg/frontend и остальные записи не менять.
- [x] Проверить точные4 исходника, metadata/hash и соответствие working assets;
  offline manifest и scoped rehearsal, свежий backup/schema/actor/config guards.
- [x] Existing importer, stable idempotency key/expectedRevision0, затем4 ready
  copies/bindings и replay без дублей; signed bytes/HEAD/Range + anonymous403.
- [x] Проверить unchanged existing rows/admin/schema/runtime flags; записать
  rollback receipt. API Library flag остаётся false, полная защита старых копий
  и реальная выдача через работающий API этим не объявляются готовыми.
- [x] Фактический WIN-PREP: holly/sock/star/apple,4 WebP/3681002 bytes,
  source SHA совпали с deployed web assets; EXIF/XMP/IPTC нет. Backup40 tables,
  351868 bytes/SHA9c5ce997… сохранён server/local0600. Existing importer exact
  deployed image; key `winter-patterns-20261020-v1`, expectedRevision0 → revision1,
  4 ready bindings. Signed GET/HEAD/Range byte-exact, anonymous403, replay без
  новых rows/objects. Только +4 private_content_files/+4 library_file_bindings/
  +1 library_file_migrations; все прежние rows40 tables/admin/schema42/policy
  unchanged. Эти4 objects рабочие, НЕ fixtures: сохранять. API flag false,
  image/healthy/restart0 прежние; live Library выдача ещё не включена/не принята.
- [x] Content API/SQL/real S3 теперь GREEN4/4/0skip: после provider timeouts
  выявлен RED fixture guard41 при fresh schema42, исправлен только backend test.
  ACK loss/restart/replay без дублей article/post/comment, account isolation и
  live access revocation проверены.4 own objects удалены metadata/ETag/HEAD404,
  policy прежний; own loopback/tmpfs container9e2d2b9f… удалён. Evidence вне Git:
  isolated-content-FeRT7R/acceptance-retry-1792497505236.log. Это isolated
  current-code acceptance, НЕ приёмка опубликованного U1/браузера/всех размеров.
- [x] Дополнительные лёгкие backend проверки: raw-video errors, encoded size
  ceiling и media read errors —45/3 suites/0fail/0skip. Root tsc/check:docs61/
  diff check без ошибок; frontend и generated contract не менялись.
- [ ] Остаток после WIN-LIVE: browser/client приёмка4 зимних и отдельно старые
  public sources. Published U1 read/max-size/audio/video ещё
  не приняты. Предыдущая остановка fresh SQL/S3 была при Mac <512MiB; теперь
  наблюдалось1.5GiB, перед новым стендом проверить ресурс заново. Образы/БД/чужое
  не удалялись. WIN-LIVE изменил только разрешённый flag/runtime API выше;
  frontend/push/нового image нет.

#### Проверенные результаты до WIN-PREP

- [x] После смены VPN повторная SSH попытка успешна; public health200/ok и
  capabilities проверены браузером и HTTP/1.1 без обхода TLS. Причина прежних
  сетевых таймаутов не установлена. API035752d8…/image15865765…healthy/restart0,
  тот же U1; deploy/перезапуск/конфигурация не выполнялись.
- [x] Рабочая БД проверена только в `TRANSACTION READ ONLY` (readOnly=1):
  history42; Library flag false, content/media/video/delivery flags true;
  всего pattern bindings0, winter bindings0. Это подтверждённая причина
  недоступности зимних выкроек, не задача фронтендера. Anonymous list/holly
  дают404/no-store; club/admin bytes ещё не проверены и готовыми не считаются.
- [x] Изолированный native API/SQL/real S3 прогон Библиотеки:4/4 pass,0skip,
  fresh backend_test42 migrations/40 tables, only-loopback/tmpfs own container.
  Lost PUT/import ACK, replay без дублей,6 byte-exact files GET/HEAD/Range,
  anonymous S3 denial и club expiry/block/session revoke проверены. Только
  новые synthetic материалы; recipes/Petersburg/зимние originals не читались
  и не менялись.6 S3 objects удалены по metadata/ETag guards/HEAD404; policy
  SHA0484dfa2…прежний; own test container a6c4d0e…удалён, образы/volumes не тронуты.
- [x] История до GREEN выше: content-upload S3 прогон,2 attempts stopped in
  beforeAll на GetBucketPolicy TimeoutError10s, все4 сценария skipped, не pass.
  Users/receipts не создавались; перед удалением own c736ae86… проверены все
  40 tables: только42 migration rows, остальное0. Container/tmpfs удалён.
  Сохранены private logs вне Git; сервер/working DB/старые S3 files не менялись.
  Native Library success не заменяет ни этот прогон, ни published U1 acceptance.
- [x] Дополнительное наблюдение U1: edge выдаёт два одинаковых `nosniff`
  headers. Старый harness строго сравнивает joined value с одним `nosniff`:
  это возможный источник assertion, но точная причина старого падения всё
  ещё не доказана. Headers/proxy/product code не исправлялись вслепую.
- [x] Backend-only follow-up: воспроизведено скачивание закрытых файлов без
  расширения. Shared HTTP boundary теперь добавляет canonical MIME extension
  к безопасному label; исходные upload filename/storage paths не раскрываются,
  права/bytes/inline/error semantics прежние. RED22/25 (ошибка fixture x-id
  устранена до product fix), GREEN25; final affected60/5 suites/0fail/0skip,
  root tsc, backend build944.5kb, API90/35243, boundaries704 и docs61 pass.
  Только локально; frontend/generated contract/working DB/S3/flags не менялись.
  Это НЕ диагноз прежней live U1 assertion. Повтор SSH снова timeout до banner,
  staging HTTPS SSL timeout до TLS (HTTP000); живой прогон не возобновлялся.
- [x] По запросу пользователя подготовлена [подробная передача фронтендеру](../docs/development/frontend-fixes-contract-audit-2026-10-20.md):
  F1 legacy full archive в quick management, F2 смешение review/gallery state,
  F3 отсутствие «Смотреть», F4 links внутри button, F5 безымянные grid links.
  История строк проверена; это задачи слоя frontend, не перенос ответственности
  за Library404/наш переход «Лошадки» в club flow/Prodamus TEST/read acceptance.
  Повторно прочитаны страницы5–6 доступного оригинала договора, исключения
  сохранены. Existing246 tests/14 suites/0fail/0skip, check:api90 pass; это не
  новый browser/live прогон. Fetch staging timeout20s, local frontend равен
  последнему доступному origin/staging becaf6d. App source/tests/DB/S3 не менялись.
- [x] Уточнены зимние выкройки:4 keys holly/sock/star/apple — действующий club
  access или admin; гость denied. Handoff/SPEC больше не требуют переноса
  «Лошадки» как пятого платного файла: b06a46a подтверждает исходный free статус,
  2fede81 — переход на закрытый flow. Отдельное решение о платности ещё требуется.
- [x] Зимние выкройки на staging: WIN-PREP подготовил4 copies/ready bindings,
  WIN-LIVE выше включил и принял backend API для admin/member/guest/unpaid.
  Browser/client и старые public sources отдельно; public fallback не добавлять,
  старые источники автоматически не закрывать; «Лошадка» отдельно.
- [x] Последнее уточнение пользователя: рецепты и Петербург остаются как есть;
  не менять их ссылки, выдачу, флаги или привязки. Backend-only/handoff сохраняется.
- [x] Повторная диагностика после c0067bc: ветка прежняя, рабочее дерево чистое.
  SSH к staging снова timeout во время banner exchange; HTTPS к S3 — SSL
  connection timeout (HTTP000), до авторизации. Live acceptance U1 не запускалась,
  причиной read assertion это не объявляется. На Mac свободно337MiB: тяжёлый
  Docker/SQL/build стенд не запускался, никаких очисток не выполнялось.
  Изменены только документы; рабочие конфигурация/DB/S3/frontend прежние.
- [ ] Продолжить U1: SSH/HTTPS теперь доступны, fresh health/flags/read-only
  guards проверены выше. Старый live helper пишет synthetic rows в рабочую БД,
  поэтому при последнем запрете её менять не запускать. Для published read
  assertion и оставшихся прав нужен отдельный согласованный изолированный
  API/DB стенд или новое явное разрешение на temporary working fixtures.
  Не подменять этот остаток успешной изолированной проверкой Библиотеки.
- [x] Подготовлен [документ фронтендеру по Библиотеке и загрузкам](../docs/development/frontend-handoff-library-uploads-2026-10-20.md):
  backend-блокеры, действующие контракты, точные client проверки и совместная
  приёмка. Общий handoff и карта docs ссылаются на текущий документ; frontend
  код/tests/generated types, runtime, рабочие DB/S3/старые files не менялись.
- [x] По последнему прямому поручению frontend ведёт фронтендер. Самостоятельно
  не менять его код, данные, tests, generated API contract или сборку на стенде;
  предыдущие разрешения frontend-работ ниже считать историей.
- [x] Нужные client правки оформлять здесь сообщением фронтендеру: проблема,
  контракт/поведение API, минимальные изменения и проверка результата. Не
  отправлять внешние сообщения и не откатывать уже выпущенное автоматически.
  В этом уточнении изменены только планы; runtime/Git remote/БД/S3 не менялись.

### RELEASE-U1 — выпуск и приёмка загрузок на staging,20 октября

- [x] Clean feature branch/2fede81, incoming staging0/ours9 после fetch;
      существующий D7 runtime и guarded image rollback inspected. SSH доступен.
- [x] Fresh ограничения: server1086MiB free; API только internal network,
      S3 configuration отсутствует. Одних flags недостаточно. DB/admin/config
      пока не менялись, push/deploy ещё не выполнены.
- [x] Настоящий S3 с host-egress web namespace:3 новых UUID probe objects,
      signed PUT/HEAD/GET, anonymous GET/HEAD/Range403 во всех3 private prefixes;
      exact metadata/ETag cleanup и HEAD404. Policy SHA0484dfa2…прежний, versioning
      disabled, policy/ACL/старые objects не менялись. Доступ восстановлен только
      из явно присланных пользователем ключей, значения не попали в Git/вывод.
- [x] Новый opt-in Compose overlay: API остаётся только на internal network,
      отдельный non-root/read-only/cap-drop TLS passthrough только к pinned S3 IPv4
      и SNI, без published ports/TLS termination. RED missing S3 environment →
      GREEN native Compose contract1/0skip. Конфигурация пока не применена на сервере.
- [x] Native production audit0/325 deps; Next29 pages с прежними working
      compiled flags (VK/recovery/Prodamus TEST true, other TEST false); focused68
      pass, types/lint/API90/35243/boundaries704/docs59/diff pass. Runtime bundles
      собраны из app source2fede81, manifests/lock/public assets/config неизменны.
- [x] Schema/history42/admin fingerprint проверены; fresh single-transaction
      backup351863 bytes/40 tables, SHA9ca1191a… на server0600 и local0600 равен.
      Native uniqueness preflight5; старую/current DB не переключали и DDL нет.
- [x] Push becaf6d в staging подтверждён remote ref. API/web/restricted TEST
      image-only rollout app source2fede81 реально применён сначала с прежними
      flags. Exact bundle hashes/BUILD_ID, health/restart0/OOMfalse, admin/schema
      сохранены, остальные26 containers неизменны. Server offline native17 pass;
      API image15865765…, webca936764…, подробности/rollback в runbook.
- [x] S3 config добавлен только API через closed private-uploads.env и узкий
      opt-in proxy. С самого isolated API: ещё3 own objects, signed read и
      anonymous GET/HEAD/Range403 во всех3 prefixes; metadata/ETag cleanup HEAD404.
      Policy прежний, canonical verified TLS, wrong SNI отказ, общий egress API
      закрыт. После этого включены ровно4 upload/delivery flags. Library/cleanup,
      provider/SMTP/CORS/roles/квоты не менялись. Это ещё не полная live приёмка.
- [ ] После preflight включить только complete upload/delivery workflow;
      проверить post/article фото, audio/doc/video и comment photos, права/отзыв,
      lost response/status-first retry/no duplicates на новых synthetic fixtures.
- [x] Первый live HTTPS/API/real S3 прогон:9 synthetic objects (PNG/JPEG/WebP,
      article PDF, MP3/TXT/raw MP4 и2 comment photos), large >256KiB inputs,
      upload/create ACK loss через собственный dropping proxy; status/retry,
      чужой actor notRecorded, bind conflict409, post/article/comment без дублей.
      Затем AssertionError на read/header/range группе: точная причина НЕ
      установлена, полного success нет. Дальнейшие revocation/open/read группы
      ещё не исполнены. Не выдавать первый прогон за полную готовность.
- [x] Finally первого прогона: все9 own S3 objects точно удалены с ETag/metadata
      guards/HEAD404, own posts/article/comments/4 actors/recovery rows удалены.
      Hash+count всех исходных40 SQL tables после cleanup совпали с baseline;
      policy прежний, own fixture container удалён. Existing files не читались.
- [ ] Возобновление требует рабочей SSH/HTTPS сети. После первого прогона SSH
      несколько раз timeout до banner, Mac HTTPS TLS timeout; новый helper не
      доставлен. Working last-known flags ON, acceptance не accepted. Проверить
      health/config, при подтверждённом read дефекте отключить upload flags
      guarded storage-rollout.py disable до исправления и повторной приёмки.
      Старый harness писал diagnostics в tmpfs, который исчезает при exit:
      local harness исправлен на private persistent /evidence, server пока старый.
      Текущую причину read assertion не угадывать и без RED не менять продукт.
      Browser/полные предельные размеры/оставшиеся live права — ещё не подтверждены.

### LIB-P — принят20 октября; локальная реализация

- [x] Проверены clean fd8378d, feature branch, планы и frontend AGENTS/Next guide.
  Контракт принят прямым поручением. Рабочие DB/S3/flags/старые файлы не трогаем.
- [x] Server slice:7 backend-owned payloads, shared shape без текстов, live
  session/club GET+HEAD,404 denial/503 infra/private no-store. RED15 из19 native
  checks → GREEN19/0skip на own loopback/tmpfs backend_test65488. Отзыв версии,
  block/expiry/unpaid/service/cancel-until-end/invalid key/query/infra проверены.
  Контрольные суммы всех7 paid payloads совпадают с исходными mixed modules.
- [x] Оба consumer (гид/quiz result) получают только validated server payload.
  Платные5 fields удалены из7 client modules, все7 free hashes прежние. Query
  owner-scoped, gc0, abortable, без persistence/placeholder/public fallback;
  stale/failed refetch не показывает prior paid payload. Quiz грузит club read
  только после «Читать», расчёт/guest flow/free result прежние. CSS/layout и
  public covers/assets не менялись; используются existing loading/retry states.
- [x] Patterns → existing LB list/read,5 known slots, bounded50/page metadata,
  canonical same-origin URLs и MIME validation. Нет originals в guest preview
  (existing public cover), прямой Yandex fallback убран также с карточки
  «Лошадка» в каталоге: она ведёт к закрытым patterns. Metadata unavailable,
  pending/empty/missing bindings не дают публичного fallback; обе PDF actions
  disabled при отсутствии binding. Account/access scope remount закрывает viewer.
- [x]42 focused checks:7 paid hashes +7 free hashes, bundled consumer graph,
  client parse/wrong-key/404/503/abort/canonical metadata/pagination и existing
  quiz calculation. Existing native LB list/read/import/rollback16 pass/0skip
  на own SQL + loopback SDK wire; никаких настоящих S3/старых bytes.
- [x] Production Next29/29 pages; отдельный scan9 pass проверяет новые
  JS/HTML/RSC и обе client entry graphs: paid style/space/blog payloads и
  Yandex horse fallback отсутствуют, backend не попал в browser graph.
  Старые cached builds/legacy copies этим не отозваны. Native guide19/0skip
  и browser acceptance записаны отдельно; default regression2702 pass /
  1653 opt-in skips (снимок до добавления3 последних browser cases и build scan).
- [x] Финальный Chromium suite9 pass/0skip,22.20s: оба text consumers, guest
  полный quiz, failed refresh/retry, late reply/account switch, SPA leave/return,
  pending pattern metadata/account switch и отсутствие public fallback. Два
  content paths идут через настоящий Next proxy/Nest/JWT/SQL: guide expiry и
  importer→5 synthetic bindings→4 decoded PNG + PDF→expiry/read404. Storage —
  owned loopback SDK wire, не actual S3; прочая UI рамка/subscription hint —
  controlled HTTP fixtures. Даже устаревший active hint не обходит server check.
  Найдена/исправлена вторая PDF action, которая первоначально не disabled.
  Отдельно исправлены harness: markup answer labels, lazy image scroll,
  native media route interception и exact migration requestKey cleanup.
  Focus может дать дополнительный safe GET при возврате, не новую запись.
- [x] Review по correctness/security/architecture/performance/React: payload
  server-only; нет нового schema/dependency/roles/CORS/proxy/quotas/цены/flags;
 7 reads bounded existing aesthetic count, metadata50/page, live access на
  выдаче, private/no-store, strict wire parsing и отсутствие persistence.
  Typecheck root/frontend/E2E, lint, boundaries704/API90/35243, docs59,
  scoped format/diff pass. CSS/assets/layout diff отсутствует.
- [x] Own backend_test1706c52d… удалён после exact ID/name/owner/task/port65488/
  tmpfs768MiB/no-volume guards; synthetic данные воспроизводимы. Next copies
  закрыты/удалены helper finally; в рабочей БД/S3 ничего не читалось/не менялось.
  По дополнительному «почисть ты» удалены inactive duplicate updater cache
  (version/build20770 совпали с установленным, lsof empty), ignored webpack cache
  и ровно1 unused unshared Docker build-cache entry eqoyewvy…537.7MB из нашего
  release frontend. Приложение, sources, images18, постоянные volumes12 и чужие
  containers не удалялись. Это пересоздаваемые кэши, не резервные копии/БД.
- [x] Точная local reference map: docs/audits/library-source-map-2026-10-20.json.
  20 public copies четырёх выкроек (full+w320/640/960/1200), отдельный Yandex
  horse source и220 visual URIs, из них104 shared у guide/quiz; все существуют
  локально. Public quiz houses/landscapes/covers/decor сохраняются. Это карта
  references, не готовый storage manifest/permission на real source migration.
- [ ] Только отдельным разрешением: reviewed bytes/private bindings на рабочей
  среде, проверка actual S3, rollout/flags, затем закрытие старых origins,
  derivatives/Yandex/old JS и управляемый cache purge. Recipes/Peterburg legacy
  delivery не менялась, public стилизации сохранены. Полной защиты старых
  источников сейчас нет; локальную интеграцию не выдавать за working acceptance.

### CAP-U — доступность загрузок связана с интерфейсом,20 октября; локально

- Локальные commits: contract `d368a6c`, integration/tests `156920c`.
- [x] Clean11db3af/рабочая feature branch/планы проверены. Contract slice
  `d368a6c`: GET capabilities дополнен3 booleans из existing flags, video=media
  AND video, no-store. RED13 → GREEN35 focused; дополнительно native Nest
  HTTP/transport/fixtures72 pass. Старые ответы с4 полями/не-bool/null безопасны.
  Один existing aggregate contract fixture потребовал3 новых false, runtime
  поведение shop/disabled функций не менялось. Working settings не читались.
- [x] Both post editors, private article files и comment photos: disabled выбор/
  замена для недоступного формата, без изменения CSS/assets/layout/copy кнопок.
  Новая отправка требует свежего capabilities read с operation signal; old UI
  hint не разрешает mutation. Video editor требует также content для постера.
  Нет публичного fallback. Текст, VK, public cover, remove/reorder и status-first
  recovery сохранены. Исходные File/key/receipt/journal при отказе не очищаются.
- [x] Shared query data cached60s; opt-in refetch stale data focus/reconnect,
  failed refresh больше не использует прежний true. Глобальные query settings
  не менялись. RED browser: оба defect класса подтверждены в реальном Next UI;
  initial cold compile timeout был setup, не product RED. Refresh-test event
  исправлен после проверки window listener query-core, production hacks не нужны.
- [x]7 новых Chromium browser cases pass/0skip: оба редактора old-server/off,
  text-only publish, false после выбора до upload без mutation/create и с
  сохранением фото/текста после reload; comment-photo API503 с text-only comment;
  article private photos/docs disabled, public banner доступен; failed refresh
  после prior true отключает picker. Контролируемые HTTP responses, не actual S3.
- [x]22 existing photo/comment/article browser cases pass/0skip,86.57s:
  lost upload/create ACK, status-first stable keys, reload, account switch и
  closed/deleted scopes. Explicit editor fixture теперь advertises enabled
  uploads, negative cases override response; flags стенда не менялись.
- [x] Full regression2672 pass/1628 opt-in skips;206 passed suites/97 skipped.
  Browser29 выше выполнены отдельно без skips. Root/frontend/E2E types, lint,
  backend607.1KiB, API90/35243, boundaries692, scoped format/diff проходят.
  Review: shared read/strict bool/default false, fresh guard для picker/uploads,
  cancellable requests, no new persistence/deps/auth/roles/quotas. Собственные
  Next fixtures закрыты/удалены helper finally; рабочие БД/S3/старые files не
  использовались. Server runtime по-прежнему D7, это ещё не live upload acceptance.
- [x] Final production Next build29/29 pages, lint/root/frontend/E2E types и
  docs59/exit0 подтверждены после последнего runtime изменения. Browser7 новый
  suite и22 existing suites выполнены без skips; full default suite их opt-in
  skips не скрывает и не считается сквозной приёмкой настоящего API/S3.
- [ ] Reviewed enable/upload→bind→read на dev остаётся отдельной процедурой:
  определить флаги полного workflow, подтвердить storage privacy/schema/config,
  сохранить rollback и проверить реальные API/S3 с own synthetic fixtures.
  Не включать flags и не выполнять выпуск автоматически.
- [x] LIB-P: минимальное предложение и ограничения сохранены в SPEC-private-files:
  five paid sections/7 aesthetics → protected server read для двух consumers;
  free quiz fields/public covers прежние; patterns → existing LB bindings.
  Это proposal, не новая готовая процедура или сделанный перенос.
- [x] LIB-P принят и локально реализован отдельным следующим срезом, см. начало
  чек-листа/reference map. Реальные Yandex/assets/old JS/cache не закрывались;
  полной защиты старых источников нет. S3/working DB/design/push/deploy прежние.

### AUTH-OUT / ADM-T1 — новые замечания,20 октября; только локально

- Локальные code commits: ADM-T1 `53d800a`, AUTH-OUT `818f00b`.
- [x] Clean feature/stage-one-completion-2026-10-10/a8431f1; проверены планы,
  текущая реализация и действующие ограничения. Никаких fetch/merge/push/deploy,
  правок runtime flags, рабочей БД или S3. Дизайн/frontend runtime не менялись.
- [x] ADM-T1: native missing post уже возвращал null, но inferred array element
  считался non-nullable и null исчезал из API type. RED tsc:3 нарушения на
  repository/server/generated client. Явный Promise<(Post & media) | null>
  и штатная генерация исправили контракт; existing native missing/detail/media
  поведение сохранено. Это не новый endpoint/404 и не ручная правка контракта.
- [x] AUTH-OUT: RED4 native HTTP/JWT/SQL failures подтверждают replay старого
  токена и ложный200 при недоступности записи. Пользователь доверил решение:
  logout через REST и tRPC завершает все сессии аккаунта existing sessionVersion.
  Один conditional UPDATE по id/openId/expectedVersion; нет новой таблицы,
  миграции, хранения токенов или изменения JWT/password/roles/subscription.
  Clear-cookie только после успешной записи; guest/invalid/repeated logout
  идемпотентны. Ошибка SQL даёт REST503/tRPC500, без success/cookie/SQL details.
- [x] Native58 pass/0skip: admin reads30 + sessions28 на own loopback/tmpfs
  backend_test, реальные Nest HTTP/JWT/password/SQL. Cookie/Bearer через оба
  адаптера, отказ старому токену на protected read и session exchange, чужой
  аккаунт сохранён, новый login рабочий, delayed/concurrent stale snapshot не
  отзывает новую сессию. SQL trigger fault только на own fixture UPDATE;
  finally удаляет trigger, недоступность настоящей БД не вызывалась.
  Первый GREEN attempt выявил ошибку теста: club.subscription намеренно public,
  заменён protected read, продуктовую политику не меняли.
- [x] Focused unit/HTTP55 pass; full regression2654 pass/1621 opt-in skips,
  206 suites pass/96 skipped. Native58 выше выполнены отдельно без skips.
  Review: атомарный compare-and-swap вместо незащищённого increment; ошибки
  не маскируются, stale actor не затрагивает новый вход, общий механизм обоим
  адаптерам. Runtime сервер всё ещё D7; локальные результаты не выдавать за dev.
- [x] Root/frontend/E2E types, backend build606.8KiB, API90/35243,
  boundaries692/docs59, scoped format и diff check проходят. Own tmpfs container
  abe3117f…65487 удалён после exact ID/owner/task/loopback/tmpfs768MiB/no-volume
  guards. Одноразовые fixture данные воспроизводимы; образы, volumes и чужие
  контейнеры не удалялись. Реальные S3/письма/платежи и live browser не проверялись.
- [x] CAP-U local contract/integration выполнены20 октября, см. новый верхний
  раздел. Working flags по-прежнему off; reviewed enable/live acceptance открыт.
- [ ] Библиотека остаётся реально незакрытой:4 CHRISTMAS_PATTERNS — public
  /assets/responsive originals, «Лошадка» — public Yandex URL; guide импортирует
  7 full club-result modules. Те же7 modules импортирует quiz-result: убрать
  только guide import недостаточно. Нужны точная карта paid/free, server-only
  paid payload с live club check, обе client integration без paid imports,
  protected file bindings и отдельно согласованное закрытие старых URL/copies/
  caches после проверки новых. Публичный результат теста и covers не закрывать.
  LB importer/list/read уже готовы; это не означает перенос настоящих файлов.

### RELEASE-D7 — сервер обновлён,20 октября; live проверка клуба завершена

- [x] После смены VPN выпуск реально применён на публичном dev, а не только
  отправлен в Git. Runtime commit1fc155e44c9d2c689e6cf567cfa735556975c61c;
  normal push staging подтверждён. Ветка прежняя, чужие frontend правки сохранены.
- [x] До переключения найдена реальная несовместимость tRPC infinite query:
  direction=forward отклонялся strict schema. RED unit и native HTTP/SQL400;
  минимальный optional literal forward, backward/unknown по-прежнему400.
  GREEN7 unit +33 native HTTP/JWT/SQL; root2653 pass/1612 opt-in skips,
  types/build/API90/35148/boundaries692/docs59/format/diff pass. Только backend,
  его тесты и generated type; frontend runtime/design не менялись. Own tmpfs
  backend_test3fec99a9… удалён после ID/name/labels/port65486/tmpfs/no-volume guards.
- [x] API/TEST images498aa1a9…/webbecc5c65…, BUILD_ID ioLtYikvyK780DlSuNqiI.
  Web runtime layers/config точно равны подготовленному baaeb47 Next build;
  обновлена только revision metadata. Clean-source API/TEST повторно собраны,
  production audit0/325 deps; isolated --network none API5/web7/TEST3 pass.
  Superseded partial285605888 bytes удалён после prefix SHA, без Docker load/apply.
  Final archive535315197 bytes/SHA4695f4163d2a45259ff799a8221ed9b1633a5f5e752d3be229a90a009e5e9444
  сверён полностью до load. Старую несовместимую версию не выпускали.
- [x] Fresh consistent backup351598 bytes/40 tables/SHA
  234e1177ba9b17676d413c7fe87883c4b35afb1f208c8cece1d1c60f3f0a0c97;
  server0600 и проверенная local0600 copy вне Git. Working DB по-прежнему
  daryadarcy_candidate_20261019; schema/history42/admin hash/role/sessionVersion
  сохранены до/после. Все6 side-effect counters0; полная Compose delta только
  API/web/TEST images и TEST bundle source. Остальные26 containers неизменны;
  все3 новые services healthy/restart0/OOMfalse, actual bundles совпадают.
- [x] Public HTTPS73 pass: same-password admin login/me/logout, новые endpoints,
  все742 IDs/38 pages без дублей и с legacy order, status/target filters/detail,
  backward400/guest401. Первая20-card page15685 bytes вместо1544982 legacy;
  единичные HTTP замеры888ms/1932ms не являются нагрузочным benchmark.
  Header counts совпали. Calendar current61 days пуст и корректен; отдельно
  исторические2 nonempty days/2056 bytes с точными counts/first cards/upcoming.
- [x] Реальный Chromium → HTTPS API → working DB, без mock API:40 cards после
  догрузки, no duplicate DOM IDs, calendar navigation, admin.posts requests0.
  Unpaid own account507 сохранил и открыл public post1 через профиль, не получив
  подписку. Account507 и1 own saved row удалены с exact identity/hash guards;
  письма/платежи не создавались. Первые browser attempts остановились на install
  guide overlay; закрыт штатным Escape, production UI не менялся, повтор GREEN.
- [x] Image rollout принят с явным пределом club verification; receipt SHA
  a07440325f191e3de2765a7c2a4c7ebee4de8176e5ab9c609c963aca4e576e89.
  Local `.local-artifacts/release-baaeb47.31scch`, server
  `/home/edem/apps/daryadarcy-staging/release-baaeb47.4qlmx5`. Старые images,
  backups/configs/TEST source остаются для same-DB rollback; не запускать DB cutover.
- [x] После acceptance удалены только own local/server image archives с exact
  path/owner/non-symlink/size/SHA guards; они восстанавливаются из retained images.
  Fresh backup/configs/receipts сохранены; server free1092MiB. Финальный read-only
  guard: accepted, schema/admin/config прежние, posts742/club0/fixtureUsers0,
  side-effect counters0. Чужие файлы, images, volumes и БД не удалялись.
- [x] **Club-only Saved, отдельное прямое согласие20 октября:** созданы только
  synthetic published club post745, unpaid user512 и2 own bookmarks (public1/
  club745). Никаких paid rows, подписок или изменения ролей: club bookmark
  заранее записан только тестовому пользователю как retained old bookmark.
  Реальные API/Chromium без mocks: admin positive control видит существующий
  club body; guest/unpaid getById200/null, direct browser link «Пост не найден»;
  savedPosts и вкладка клуба скрывают retained club record, toggleSave403 не
  раскрывает body. Public bookmark по-прежнему открывается, public search не
  выдаёт synthetic club content. Этот первоначальный live предел снят.
- [x] В finally exact ID/source/text/hash/owner/dependency guards удалили post745,
  user512 и2 own saved rows. Digest всех исходных posts/saved rows и user count
  равен baseline (742 posts/3 users); admin/schema/config/history/runtime прежние,
  все6 side-effect counters0. Auto-increment gaps не сбрасывались. Фронт/дизайн,
  S3/старые файлы/письма/платежи не затрагивались, новых push/deploy не было.
  Evidence local0700 `.local-artifacts/saved-club-20261020.kjEsfo`, follow-up
  server0600 `release-baaeb47.4qlmx5/saved-club-followup.json`, SHA
  9cf7177ea329de619229ea229db827ed6d71b62e554d041370f4b554285a0257.
  Original release receipt immutable; дополнение снимает только этот предел,
  не является full contract/mobile/pilot/payment/S3 acceptance.

### RELEASE-D7 — история подготовки до смены VPN,19 октября

- [x] Прямое разрешение на push/deploy ADM-P2 + ранее отложенный SAVED-P1.
      Clean feature/stage-one-completion-2026-10-10, fetch: incoming0/ours7;
      normal push runtime baaeb470979378c70c8fc33351e08682ba8bf0f0 в staging,
      remote ref подтверждён. Чужие frontend commits не перезаписывались.
- [x] Clean Git archive: API/TEST build, Next29-page production build;
      pinned runtime/deps/config unchanged, compiled flags сравнены с D5.
      Audit0/325 production deps; API90/35099/boundaries692/docs59/diff pass.
      Final Linux amd64/node images: API0f53b87e…/webc805299e…;
      isolated --network none API5/web7/restricted TEST3 HTTP pass,
      exact bundles и BUILD_ID ioLtYikvyK780DlSuNqiI совпали. Это не live acceptance.
- [x] Осмотр сервера: все7 staging services healthy, API/web/TEST прежние D5.
      Public health200, новые admin.postCounts/postsPage404 подтверждают отсутствие
      rollout. Обычная rsync передача и raw8MiB chunk оборвались с SSH255 примерно
      через2s, remote prefix196608/327680 bytes; Docker load/prepare/backup/apply
      НЕ выполнялись. Config/DB/admin/schema/flags/почта/оплата/S3 не менялись;
      временный аккаунт не создавался. Пользователю запрошено переключение VPN/сети.
- [x] Cleanup только собственных воспроизводимых файлов с exact path/owner/
      symlink/size/SHA guards: obsolete D6 local archive534852537 bytes и remote
      partial200540160 удалены; образы/backups/configs/receipts сохранены. Initial
      D7 packaging включал Next build cache; этот невыгруженный образ не применялся.
      Его local archive623080855/remote partial327680 и собственный Next cache357MiB
      удалены, web image перепакован без build cache и native checks повторены.
      Final archive535314232 bytes, SHA c751b2532de061d0d66ecdd12684a88915c9259d71ff96d2128f61a43c44a802;
      Mac1.3GiB/server1.2GiB free. Docker cache/images/volumes/foreign files не чистились.
- [x] После восстановления связи: повторно проверить Git/server/config/inventory,
      доставить FINAL archive с full SHA guard; stage.cjs обновляет images.json/TEST
      source/rollout script. Выполнить fresh backup/DB-admin-schema/config guards,
      coordinated image-only apply, health/bundle checks и live acceptance.
      Local artifact `.local-artifacts/release-baaeb47.31scch`, server
      `/home/edem/apps/daryadarcy-staging/release-baaeb47.4qlmx5`; state.json пока нет.
- [x] Пагинация: все IDs/order/cursors без дублей, bounded card bytes vs legacy;
      календарь: local-day counts/first cards/upcoming совпадают; browser не делает
      admin.posts. Saved: unpaid own temporary account — public доступны, club closed,
      exact cleanup. Эта запись — прежний план до возобновления; актуальный итог
      и отдельный предел club-only проверки приведены выше.

### ADM-P2 — принятые страницы админки и календарь,19 октября

- [x] Прямое «давай да», clean51523d2/ветка проверены. Scope: local backend +
  existing frontend logic/generated types/tests, без дизайна/working DB/S3,
  push/deploy/flags. Contract записан в начале plan; old admin.posts сохранён.
- [x] Slice1 RED3 новых native HTTP/JWT/SQL сценария на missing postsPage404;
  GREEN25/25 с существующим admin suite. Страницы20 default/50 max, numeric
  offset cursor, status/target, прежний total order. SQL projection: text512
  Unicode chars, first photo/3 tags+tagCount/hasVideo, без richText/media.
  Protected postDetail возвращает full draft с ordered media или null;
  malformed400, guest401/moderator403. Types/build/API88/33680/boundaries691
  pass. Схема/индексы/рабочие данные не менялись. Проверен только local fixture.
- [x] Slice2 RED3 missing calendar/counters; GREEN28 native admin +3 aggregate
  =31/31. Dense741-event day возвращает1 summary с точными counts, следующий
  local-day boundary отдельно; SQL first-card window не обрезает counts. Есть
  <=62 adjacent20–28h day windows/DST, upcoming8, header legacy semantics;
  invalid400/guest401/blocked401 прежние. Первое ожидание blocked403 исправлено
  на действующую native-session401 семантику без auth изменений. Synthetic
  calendar JSON<40KiB,50 cards<150KiB с длинными Unicode текстами; это fixture
  bound, не live speed benchmark. Types/build/API90/35099/boundaries691 pass.
- [x] Review follow-up: равные upcoming times должны сохранять прежний catalog
  tie-order, а не переходить на id. RED [99000,99001] вместо [99001,99000],
  исправлено scheduledAt + прежний postListOrder. GREEN32 native SQL/HTTP,
  включая полноценный62-day HTTP request; нет snapshot/UTC truncation смены.
  Invalid native inputs явно typed as never, остальные новые tests используют
  настоящий AppRouter без any. Public namespace manifest дополнен4 принятыми
  процедурами, прежние endpoints сохранены. Общая regression2646 pass/1611
  opt-in skips (204 suites pass/96 skipped); native32 выполнены отдельно.
- [x] Slice3: admin uses postsPage only visible posts tab/outside editor,
  existing infinite collection/dedup IDs, separate counts/calendar window;
  selected draft loads full detail/media before editor. Pending read cancelled
  by tab/navigation/session/unmount guards; no source/design/CSS/assets changes.
  Next-page failure retains cards/retry, counters error gives dashes/retry.
  Exact-ID delete verification (also unknown reply inspection) cannot infer
  absence from a partial page; no automatic replay. Seven new browser scenarios
  cover these branches plus quick-save cache invalidation across real navigation.
  RED initial3 on old list; RED2 edge cases on missing exact-ID check/counter
  retry; late-account case already safe through shared scope. Quick-cache RED
  confirmed after correcting an ambiguous publish selector; GREEN71 browser
  checks including existing sessions/calendar/stats/editor/action paths.
- [x] Test transport migration: existing full synthetic catalogs serve both
  cards/detail in shared editor fixture, native SQL coverage remains separate.
  Session/layout fixtures updated for the new shapes. Two old upload tests
  still assumed immediate public upload on selection: updated to current
  deferred private submit, preserving assertions draft retained/no post created/
  actionable413/no internal leak. No upload/session production code changed.
- [x] Native own loopback/tmpfs container94f4d0f9… removed after final32 native
  pass with exact ID/name/owner+task labels/port65485/tmpfs/no mounts/backend_test
  guards. Only synthetic data discarded; images, volumes and other projects
  untouched. Working DB/S3/files/flags/credentials not used or modified.
- [x] Финальная regression: root2646 pass/1611 opt-in skips; native32 pass/0skip;
  browser71 pass (7 новых ADM scenarios + existing suites). Editor/media/
  rich-text/draft/VK regression80 из82 сразу pass;2 full malformed-media tests
  ожидали открыть редактор, который новый guard корректно не открывает.
  Актуализированы: visible invalid-response/no editor/no write, затем retry
  с полной media успешен; отдельно GREEN2/2. Quick counterparts не менялись.
  Итого153 distinct browser scenarios подтверждены совокупностью этих прогонов,
  не одним повторным82-test all-green запуском. Первый узкий повтор ошибочно
  использовал anchored title grep (0 tests), затем исправлен filter; также
  исправлен alert locator, отличающий app error от Next route announcer.
- [x] Root/frontend/E2E types, lint, backend и Next production29 pages builds,
  API90/35099, boundaries692, docs59, formatting/diff pass. Final modified
  E2E recovery file отдельно typechecked/linted. Review по correctness/security/
  performance/React: new reads admin-only, parameterized bounds, old role/date/
  header semantics, no partial-page deletion proof; active-tab queries/cache
  invalidation/session scope сохраняются. Скриншоты posts/calendar390 просмотрены;
  CSS/assets/layout classes не менялись, полноценная device acceptance не заявлена.
  Backend SQL/HTTP и browser synthetic HTTP проверены отдельно: это не live
  browser→deployed API/S3 acceptance и не server load benchmark.
- [x] Scope завершён локально; no push/deploy/working DB/S3/старых файлов/flags/
  admin password changes. RELEASE-D6 остаётся отложенным; CAP-U и реальные
  protected materials требуют своих следующих решений, не включать автоматически.

### CAP-U / ADM-S1 — пять новых замечаний,19 октября

- [x] Сверены clean HEAD49954ee/ветка, текущие планы/источники и evidence D5/D6.
  Подтверждены отсутствующие upload capabilities и безлимитный admin.posts.
  Live GET /api/capabilities200 возвращает только четыре прежние возможности;
  private uploads в нём не описаны. Настройки/данные стенда не менялись.
- [x] ADM-S1: статистика больше не переносит весь архив/тексты из SQL в Node
  ради counters. Один aggregate row, прежний numeric response/top5/80 UTF-16
  units, month boundaries в process TZ, status/target и legacy duplicates.
  Нет нового API, индекса/схемы/зависимостей, frontend/design изменений.
- [x] RED на собственной MySQL8.4 loopback/tmpfs backend_test с742 synthetic
  posts: максимальный result set742 нарушал <=5. GREEN3 native statistics +22
  existing native admin HTTP =25 pass/0skip. Проверены также zero rows, Moscow
  month boundary, legacy published flag, future dates, like/save duplicates;
  точные emitted SELECTs возвращают <=5 rows и суммарно <64KiB на fixture.
  Это bounded transfer evidence, не замер ускорения рабочего API/всего SQL.
  Connection-local TEMPORARY tables не удаляют чужие fixtures; начальная
  LIKE-self ошибка setup исправлена SHOW CREATE, до meaningful RED. Контейнер
  удалён после exact ID/name/labels/loopback/tmpfs/no-volume ownership guards.
- [x] Unit maintenance/request-bodies81 pass. Первая full regression нашла
  устаревший SQL transport fixture: пустой aggregate был подставлен как0 rows,
  хотя настоящий SQL возвращает1 строку zero counters. Исправлена только форма
  test response; infrastructure rejection остаётся, read-errors40 pass.
- [x] Финальная full regression2646 pass/1604 opt-in skips (204 suites pass,
  96 skipped); native25 выше выполнялись отдельно без skips. Root/frontend/E2E
  types, API86/32138, boundaries690, backend build598.5KiB, formatting/docs/diff
  проходят. Review: parameterized Dates/columns, прежняя month семантика и
  access checks, SQL errors не подменяются zero stats; нет контрактных изменений.
  Не заявляется live load/полная приёмка пяти замечаний. Только локальный commit,
  без push/deploy/flags/frontend/working DB/S3/старых файлов.
- [x] Upload availability:20 октября local contract/integration CAP-U выполнены
  по прямому продолжению пользователя, см. начало checklist. Отдельное reviewed
  включение полного upload→bind→read на стенде остаётся открытым; flags не включать.
- [x] Admin lists: contract принят и выполнен ADM-P2 выше. Новая админка больше
  не вызывает legacy admin.posts; он сохранён без усечения для других callers,
  включая quick-management verification. Сам факт старого endpoint742 rows
  не выдавать за результат новой страницы; server rollout не выполнялся.
- [ ] Старые protected материалы: карта реальных public patterns/URL и guide,
  защищённая доставка вместо client imports и separately reviewed закрытие
  прежних источников/cache. Не расширять это автоматически на публичный quiz.
  LB backend/importer готовы, не считать настоящие файлы уже перенесёнными.
- [x] CF-HTTP1 уже исправлен/выпущен D5: envelopes6/50MiB при прежних decoded
  photo4/document32; ordinary JSON256KiB остаётся намеренно. Disabled404 —
  отдельный feature gate, не доказательство старого upload body limit.
- [x] SAVED-P1 public/both unpaid уже37c1bf2 в Git; club остаётся закрытым.
  Server D6 отложен пользователем: не повторять исправление/не возобновлять
  выпуск автоматически. Эти два пункта не назначать новыми backend дефектами.

### AG5/AG9 — фактический остаток бэкенда,19 октября

- [x] Пользователь подтвердил отсутствие старых телефонных аккаунтов: первую
  привязку email оставить выключенной, из остатка запуска исключить. Frontend
  ранее удалён, backend/tables/tests сохраняются без автоматического удаления.
- [x] Branch clean831a02a, планы/матрица ТЗ/последние D5/D6/LB4 результаты сверены.
  Подтверждённых незакрытых локальных backend-дефектов не установлено; исправленные
  session errors/catalog pagination/Base64 limits не назначаются заново.
- [ ] Оплата/письмо: отдельная согласованная приёмка ordinary790/recurring/cancel,
  внешней доставки и входа. Согласовать договорное «логин/пароль» против текущей
  setup-link схемы; без автоматического изменения auth/SMTP/provider или платежей.
- [ ] Новые закрытые загрузки: reviewed включение existing flags/полного пути
  upload→bind→read на целевом стенде; local API/SQL/actual S3 уже проверены.
  Нужны отдельное разрешение и scope тестовых данных/писем/платежей по действию,
  не новые API или повтор неизменных synthetic проверок.
- [ ] Старые клубные материалы: согласованная карта реальных файлов/URL,
  отдельно разрешённый перенос и контроль совместимости/anonymous denial.
  Importer/LB backend готовы; frontend integration и реальные материалы отдельно.
  Сами файлы/S3/данные этим пунктом не разрешено читать/переносить автоматически.
- [ ] Target API/DB load/пилот: критерии/окружение и отдельное разрешение;
  local9900/9900 не заменяет результат целевого сервера. Physical devices,
  реальные VK/сезонные assets/даты/контакты — совместная приёмка, не новый бэкенд.
- Не включать retention/auto cleanup ради закрытия чек-листа: это отдельно
  разрешаемое обслуживание, не обязательная новая функция первого этапа.
  Backup/restore/fresh42 уже проверены; legacy0017–0019 не возвращать как блокер.
  «Сохранённое»37c1bf2 в Git, отложенный D6 — web-only, не новый backend fix.
  Обновлены только план/статус; проверки docs/diff, без runtime tests/внешних действий.

### RELEASE-D6 — Git опубликован; server rollout отложен пользователем,19 октября

- [x] Прямое разрешение push/deploy с сохранением current DB/admin/password;
  дополнительно разрешён один временный unpaid account/own saved rows/cleanup,
  без писем и оплаты. Fetch: origin/staging c3fcf25 — предок37c1bf2, incoming0;
  normal push37c1bf2 подтверждён remote refs. Рабочая ветка не менялась.
- [x] Clean Git archive37c1bf2, Next29 pages; pinned D4 Linux amd64/User node
  runtime/deps/config прежние. New web native --network none7 HTTP проходят,
  BUILD_ID rnbY-9QeXaHIe08g7pb85 совпадает. Production audit0 advisories/325 deps.
  Никаких новых backend/schema/dependency/design правок. Первая archive-команда
  запущена вне checkout и исправлена на git -C до build; исходники не менялись.
- [ ] Передача и guarded web-only rollout отложены по прямому ответу
  «давай потом протестим, делай другие правки». SSH прерывает большие передачи;
  сначала openrsync не поддержал append-verify, затем обрывы при append/stream.
  Только own unique archive, prefix SHA проверяется до resume, полный SHA —
  до load. До успешного prepare/apply working сервисы/DB/config не менялись.
  Все transfer processes завершены; local archive534852537 bytes сохранён,
  server partial200540160 bytes, образ не загружен. Собственные scripts/receipts
  `.local-artifacts/release-37c1bf2.B5rzP4` (workspace parent), server
  `/home/edem/apps/daryadarcy-staging/release-37c1bf2.B0ZMz0`; оба parent0700.
  Это остаток для resume, не новая working версия. Подробности в runbook.
- [ ] Fresh consistent backup, current DB/schema/history/admin guards; web
  healthy и runtime BUILD_ID, неизменность API/TEST/остальных контейнеров/config.
- [ ] Public HTTPS/API/admin same-password и live browser unpaid bookmarks,
  club denial, точечное удаление разрешённого test account/own saved rows.
  Account не создавался, seed/HTTP writes не запускались. CUA показал настоящую
  guest login gate прежнего стенда, временная вкладка закрыта; не acceptance D6.
- [ ] Финальная receipt/runbook/cleanup только own transient archive; старый
  web image и backup сохранить. Не заявлять server acceptance до этих checks.
- [x] После переноса проверки сверены активные AG5–AG9 и прежние evidence.
  Иных подтверждённых локальных backend-дефектов/доступных implementation задач
  в актуальном плане нет: AG5 ждёт отдельно разрешаемых email/private/retention
  flags и материалов; AG9 — настоящие mail/Prodamus/VK/devices/load/pilot.
  Готовые тесты/код без нового риска не повторялись; новые функции/правки фронта
  не добавлены. Нужен выбор следующего внешнего включения/приёмки, не код ради кода.

### SAVED-P1 — открытое «Сохранённое» без подписки,19 октября, локально

- [x] Прямое поручение после RELEASE-D5; исходные branch/clean status/HEAD
  c3fcf25 проверены. Снята подписочная блокировка всего профиля, а не доступ
  к клубу: session/guest gates сохранены; состояние/ошибка подписки выводится
  внутри прежней subscription card. Авторизованному без подписки доступны
  сохранённые опубликованные feed/both посты; club-only карточки дополнительно
  скрываются из retained response без подтверждённого доступа. Права оплаченной
  участницы и служебный доступ модератора не смешиваются и не меняются.
- [x] RED на прежнем production build: первый browser test не находит открытую
  сохранённую карточку, snapshot подтверждает прежний full-profile клубный gate.
  Минимальная правка одного TSX, без CSS/assets/перераскладки/нового UI/API.
  GREEN7 новых browser scenarios: unpaid public/both/detail, club-only denial,
  paid/moderator, subscription503 без ложного inactive, отзыв доступа с retained
  club snapshot, saved read503/retry, guest. HTTP в браузере синтетический,
  React/query/router настоящие; это не сквозной browser+live API/S3 результат.
- [x] Browser regression: session-safety25 pass без правок. Новые7 + отмена
  подписки26 =33 pass после актуализации двух прежних assertions о закрытии
  всего профиля; checks отсутствия cancel/recovery и one-write сохранены.
  Первый reconnect test не вызывал refetch, потому что online уже true:
  исправлен только stimulus offline→online с ожиданием ответа, не доступы.
  Отзыв проверяется именно во вкладке клуба, в том числе после reset экрана.
- [x] Сервер уже фильтрует published/status/target и проверяет действующие
  права: unchanged nest-content native JWT/Nest/HTTP/MySQL56 pass/0skip.
  Только own loopback/tmpfs backend_test; exact container ID/labels/port/mounts
  проверены перед удалением, контейнер удалён без volumes. Рабочие DB/S3 и
  внешние интеграции не использовались; backend/schema/types/flags не менялись.
- [x] Общая Vitest regression2646 pass/1601 opt-in skips (204 files pass/95
  skipped); root/frontend/e2e types, lint, API86/32138, boundaries690 pass.
  Next production build29 pages с same-origin API проходит. Review: изменение
  только profile logic и соответствующих тестов; клубные API gates прежние,
  both остаётся публичным; ошибки подписки не блокируют открытые сохранения
  и не выдаются за отсутствие подписки. Локальный screenshot нового unpaid
  состояния использует существующий профиль; физическая mobile/full contract
  приёмка не заявляется. Impeccable context launcher недоступен по правам:
  existing UI/стили и прямые инструкции прочитаны без изменения инструментов.
- [x] План актуализирован; локальная правка не опубликована. Сервер по-прежнему
  RELEASE-D5. Нет push/deploy/merge, правок дизайна, рабочей DB, S3 или пароля.

### RELEASE-D5 — объединённая11e4c6d опубликована на dev,19 октября

- [x] Прямое разрешение push/server update с сохранением текущей DB/admin.
  Origin/staging123aef8 — предок merge11e4c6d; normal push11e4c6d подтверждён
  remote refs. Frontend автора и backend CF-HTTP1 сохранены, без ручных правок.
  По проверенному merged source2646 tests/types/lint/API и builds pass.
- [x] Clean git archive11e4c6d, backend/TEST/Next29 pages собраны отдельно,
  runtime/deps/Next config/public assets неизменны с D4. Audit0/325 deps.
  Linux amd64/USER node и pinned D4 base layers/config проверены; native
  --network none API5/web7/restricted TEST3 HTTP проходят, bundles/BUILD_ID
  совпадают. Initial local FROM image-ID syntax и неверный cwd web probe
  исправлены только в packaging/probe, product source не менялся.
- [x] SCP/первый stdin stream оборвались до working changes; rsync продолжил
  передачу. Archive535380430 bytes, полный SHA1783ed2f…f54c совпал на обоих
  хостах перед load. Guarded prepare: текущая daryadarcy_candidate_20261019,
  history42, schema/admin digest зафиксированы; consistent gzip backup351593
  bytes/40 tables валиден, все6 side-effect counters0. Только api/web/TEST
  image references +TEST bundle source изменены; полный canonical config
  сравнивался, включая сохранение DB URI/JWT/flags/provider/SMTP. Миграций,
  seed/import/DB switch/пароля/S3/новых платежей/внешней почты не было.
- [x] Rollout принят без server rollback: три сервиса healthy/restart0/OOMfalse,
  26 остальных контейнеров неизменны. Actual running API/TEST SHA и web BUILD_ID
  совпали с exact release. Public HTTPS23 checks: pages/chunk/health/launch,
  guest me/subscription, videos.catalog default/forward200/backward400,
  normalCheckoutStatus guest401/admin200/notRecorded, прежний admin password
  login/me/stats/logout, hasClubAccess; обе disabled private procedures на
  invalid300KiB дают pre-body404, ordinary остаётся413. Это не успешная
  загрузка в S3: рабочие private flags не включались, файлов не создавали.
  После публичного входа schema/history/admin hash/role/version проверены снова.
- [x] Private receipts/code: local release-11e4c6d.SqdAUZ; server
  release-11e4c6d.rpQ0dY. Release receipt0600 SHA99a36eff…bdca, parent0700.
  Только own archive на Mac/server и synthetic1MiB probe удалены после
  exact path/ownership/non-symlink/size/SHA guards; архив восстанавливается из
  retained images. Fresh backup, configs и previous images оставлены;
  server free1176MiB. Точные hashes и same-DB rollback — [runbook](../docs/operations/candidate-backend-image-rollback.md).
  Browser/mobile/полная приёмка договора не повторялись; gate «Сохранённого»
  в профиле не менялся. Одноразовое release approval не разрешает следующий deploy.

### MERGE-ST5 — свежий staging123aef8,19 октября, только локально

- [x] Прямое поручение «стяни все с стейджа». Исходная ветка чистая, c8b4973;
  fetch нашёл один новый frontend commit123aef8 SergeyM,44 files. Проверены
  изменения logic/tests, пересечение с локальными backend files отсутствует.
  Merge без конфликтов, frontend точно совпадает с origin/staging; CF-HTTP1
  сохранён. Изменения автора импортированы целиком, без ручной правки фронта
  и дизайна; package/lockfile/schema/flags не менялись. Новый commit не трогает
  профиль: обсуждение доступа к «Сохранённому» без подписки остаётся отдельным.
- [x] Root/frontend/e2e types, frontend lint, API86/32138, boundaries689,
  docs59/diff pass. Backend598.3KiB/restricted TEST595.4KiB и Next build29
  pages проходят. Полная merged Vitest suite2646 pass/1601 opt-in skips,
  204 files pass/95 skipped,74.78s; native SQL/S3 и browser не запускались.
  Next собран с API base127.0.0.1:1: это локальная проверка
  сборки, не выпуск и не настоящее API/S3/browser acceptance. SQL/провайдеры,
  рабочая DB/S3, push/server/deploy этим поручением не затронуты.

### CF-HTTP1 — лимит Base64 новых закрытых загрузок,19 октября, локально

- [x] Подтверждён пользовательский дефект: admin.uploadPrivateContentFile и
  club.uploadPrivateCommentPhoto не классифицировались как загрузки и получали
  ordinary256KiB. Изолированный native HTTP RED22fail/4pass воспроизводит
  преждевременные413 и отсутствие pre-body admission. Минимальная правка в
  request-bodies: прежние media50MiB и photo6MiB; decoded квоты документов32MiB
  и фото4MiB не менялись. Флаг PRIVATE_CONTENT_FILES_ENABLED и сессия/admin
  проверяются до большого тела; точные encoded имена и batch учтены,
  mixed batch требует admin. Статусные/обычные256KiB, auth16KiB прежние.
- [x] GREEN26 транспортных проверок: full4/32MiB envelope до настоящей schema400,
  контроль300KiB, feature-off404/anonymous401/non-admin403/session-fault503
  до парсинга, encoded/batch/mixed, envelope6/50MiB413, decoded quota+1
  tRPC PAYLOAD_TOO_LARGE413. Только SQL lookup/activity seams подменены;
  upload SQL явно запрещён, storage не вызывается. Вместе с existing parser и
  session availability79 pass/0 skip. Native HTTP/SQL25 pass/0 skip/4.57s на
  own mysql8.4 tmpfs backend_test: valid32MiB text document + replay = один
  asset/один PUT; реальные PNG>256KiB post/article/comment проходят WebP
  обработку. Это настоящий JWT/Nest/HTTP/MySQL, но **loopback SDK wire, не S3**.
- [x] Root tsc, backend build, restricted TEST build, API86/32138 и
  boundaries688 pass; generated frontend contract неизменен. Полный локальный
  прогон2627 pass/1601 opt-in skips,204 test files pass/95 skipped,62.73s;
  native SQL25 выше выполнены отдельно, не выдаются за skipped E2E.
  Docs59/diff pass. Review по correctness/security/architecture/performance:
  только две точные private процедуры получают existing upload policy;
  большой JSON доступен после флага/сессии/роли, бизнес-квоты и доступ к post
  не обходятся; новых зависимостей/схемы/публичных типов нет. Own container
  3f71ab92…c9f удалён после exact ID/labels/loopback61862/tmpfs768MiB/no volumes
  проверки; синтетическая БД была одноразовой и воспроизводится фикстурами.
  Frontend/дизайн/working DB/S3/flags/server не трогались; no push/deploy.
  Рабочий RELEASE-D4/b7d7338 этой правки не содержит; включение флага само по
  себе прежний parser bug не исправляет. Контракт — [API](../docs/architecture/api.md).

### RELEASE-D4 — объединение и фактический выпуск19 октября

- [x] По прямому поручению объединён origin/staging9e933d2 с нашей веткой:
  merge7433e7f без конфликтов, сохранены AUTH-S2/VCAT-C1 и весь frontend автора.
  Единственное интеграционное изменение frontend — generated API contract:
  optional direction:forward. API86/32138, types/lint/boundaries688/docs pass.
  Общий прогон обнаружил устаревший guest double в nest-profile: generic Error
  заменён на настоящий typed ForbiddenError; ожидания401/403 не ослаблены,
  профиль+request bodies39 pass. Это тестовая фикстура, не runtime изменение.
- [x] Full merged suite2601 pass/1597 opt-in skips; отдельно native
  JWT/HTTP/MySQL49 pass/0 skip на own tmpfs backend_test. Containerb44e6bfc
  удалён после ID/labels/loopback/tmpfs/no-volumes проверки. Root/frontend types,
  lint/API86/32138/boundaries688/docs pass; clean-source backend/TEST и Next29
  pages build; audit0 advisories/325 production deps. Финальные Linux bundles
  совпали по SHA с source, isolated web7 HTTP и restricted TEST3 HTTP pass.
- [x] Normal push b7d7338 в origin/staging, без force; обновлены только
  api/web/prodamus-test. Первая попытка выявила mode0600 нового non-secret
  TEST bind source: контейнер node не мог прочитать код. Образы успешно
  откачены на той же DB; EACCES воспроизведён, только этот файл0644,
  parent0700/configs+backups0600 сохранены. Native isolated startup без сети/DB
  прошёл; повторная выкладка принята, три сервиса healthy/restart0/OOMfalse.
  26 остальных контейнеров неизменны. Runtime source b7d7338, image IDs,
  BUILD_ID и actual rollback — [runbook](../docs/operations/candidate-backend-image-rollback.md).
  На действующей candidate сохранены schema/history42/admin hash/role/version,
  прежний password login подтверждён. Config delta строго images+TEST bundle;
  JWT/SMTP/provider/flags/DB URI не менялись. Два fresh private gzip backup40
  tables проверены; никакого SQL migration/copy, S3, платежей или внешних писем.
- [x] Public HTTPS20 checks: catalog без direction и с forward200, backward400,
  checkoutStatus guest401/admin200/notRecorded, subscription.hasClubAccess,
  admin login/me/stats/logout, launch config/pages/chunk. В реальном браузере
  после гидрации /videos —20 карточек и «Показать ещё», без ошибки каталога.
  Это не полная приёмка договора2.1, реальной оплаты, mobile или pilot.
  Private receipt с проверенной SHA256 и ограничения сохранены в runbook.
  Удалены только два собственных временных image archive (Mac/server), по
  exact path/size/hash guards; восстанавливаются из сохранённых images.
  Два backup и образы отката сохранены; после cleanup на сервере1249MiB свободно.

### Совместимость видеокаталога —19 октября, локально

- [x] VCAT-C1 — прямое поручение исправить несовместимость текущего frontend
  запроса только на бэкенде. Реальный tRPC infinite query автоматически шлёт
  direction:forward, strict schema раньше возвращала400. Минимальное изменение:
  optional literal forward; strict, limit/cursor, output и SQL/доступ прежние.
  Native RED: существующий client/QueryClient/InfiniteQueryObserver получает
  BAD_REQUEST/unrecognized direction. Отдельный fixture trigger test требовал
  SUPER; повтор с root только своего backend_test, без настройки MySQL.
  GREEN30/0 skip/1.93s: три страницы/no duplicate/terminal cursor, hidden row,
  source-free locked card, playback gates, paid/expired/blocked/revoked,
  unsupported directions/extra fields/invalid cursor/limit400. Никаких doubles
  API/SQL в этом прогоне; synthetic VK ссылки не запрашивались.
  Отдельно6 targeted files105 pass/0 skip/2.44s; root tsc/backend build/
  boundaries685/diff pass. Generated API check **не проходит**: optional
  direction меняет inferred input; frontend contract по запрету не генерировать.
  Existing generated frontend тип использован в native client test и совместим;
  синхронизация types — отдельный разрешённый frontend шаг, не скрывать gate.
  Own mysql8.4/container8716cd7d…607c0, loopback61691/backend_test,
  tmpfs768MiB/no volumes: принадлежность и изоляция проверены перед удалением.
  Working DB/S3/frontend/flags/платежи/почта/server не трогались; no push/deploy.
  RELEASE-D3/da47b54 этой правки не содержит. Контракт —
  [SPEC](../SPEC-vk-catalog-access.md), [handoff](../docs/development/backend-handoff-2026-10-05.md).

### Дополнительная обработка ошибок сессии —19 октября, локально

- [x] AUTH-S2 — по прямому поручению повторно проверить REST/tRPC: рабочие
  GET /api/auth/me и TrpcService уже используют AUTH-S1. Оставшийся legacy
  createContext переводил все ошибки в guest, POST /api/auth/session — в401;
  raw/tRPC upload admission и повторные проверки двух video controllers тоже
  маскировали lookup/activity failure под401. Все используют существующую
  политику SessionService.optionalUser; роли/отзыв/квоты не расширялись.
  RED5/14 pass → GREEN19; дополнительный RED16/19 pass → GREEN35.
  Контроль блокировки/revocation/смены роли после body admission и tRPC faults
  довёл focused suite до43. Final12 targeted suites:141 pass/0 fail/0 skip,
  5.50s; root tsc, backend build, boundaries685/API86/32048/diff pass.
  Anonymous fixture в request-bodies исправлена на настоящий typed denial
  ForbiddenError вместо generic Error; ожидания401/403 не ослаблены.
  REST checks503/no-store/no cookie mutation, active tRPC500/safe formatter,
  recovery с тем же JWT; confirmed guest/invalid Bearer по-прежнему null/401.
  Native JWT/SDK/Nest/loopback HTTP, fault injection только на SQL seams;
  отсутствуют настоящая SQL-сессия, отключение БД, S3/providers/письма/платежи.
  Frontend/дизайн/working DB/server/flags не менялись, no push/deploy.
  **RELEASE-D3/da47b54 не содержит AUTH-S2**; изменения только локальные.
  Контракт и границы — [API](../docs/architecture/api.md).

### Фактический выпуск на dev — 19 октября 2026

- [x] RELEASE-D3 — пользователь явно разрешил обновить backend/frontend,
  переключить приложение на проверенную candidate, сохранить admin/password
  и старую DB для отката; отдельно разрешил VK catalog +normal checkout recovery.
  **Выполнено на публичном https://daryadarcy.dev.reeskeen.ru, не только isolated.**
  Source runtime/frontend: `da47b54c19129a8eeee976312bc3bd4f9e7cbbd3`;
  frontend совпадает со свежим remote staging `e25ffda`, без ручных правок дизайна.
  Новый backend/TEST image `b8e2a908…`, web `3b3011d6…`; полные IDs и откат —
  [runbook](../docs/operations/candidate-backend-image-rollback.md).
  Ранее проверенный native frozen runtime0763 сохранён; package/lockfile с2083911
  не менялись, добавлены exact archived-source API/TEST bundles и новый Next build.
  84 targeted regressions, root types, API86/32048 и production audit0 advisories;
  frontend29 pages/types и native Linux web7 HTTP checks pass. Image/archive/SHA
  guards; actual server candidate39 ORM/18 HTTP checks, прежний password login.
  На границе остановлены только API/TEST writers; fresh read-only delta850 rows,
  29 tables: product data совпали, users отличается только activity timestamps.
  Созданы private gzip backups обеих DB (29/40 tables), counter floors проверены:
  повышать не требовалось. Candidate runtime account только для её schema;
  JWT/SMTP/provider configuration прежние, изменены DB URI и два approved flags.
  Обновлены только api/web/prodamus-test, edge DNS reload без изменения config.
  **Working DB теперь `daryadarcy_candidate_20261019`, history42 без изменений.**
  Old `daryadarcy_staging` не изменяли/не удаляли/не ремонтировали0017–0019.
  Public HTTPS16 checks: videos.catalog200, normalCheckoutStatus guest401 /
  authenticated200/notRecorded, subscription200/hasClubAccess:boolean;
  прежний admin login/me/admin.stats/logout, страницы/launch config pass.
  Admin id1/hash/role/sessionVersion2 сохранены. Source table hashes после
  write boundary совпали; остальные26 containers unchanged, seven services healthy,
  три новых restart0/OOMfalse. Actual new worker native backup40 tables/gzip
  verified, file0600/directory0700. Temporary SQL readers/probes удалены;
  approved temporary image archives удалены с SHA guards, images/DB/backups retained.
  Working private flags остались off, S3/legacy URLs не менялись. Публичные старые
  выкройки **не закрыты этим выпуском**. Платежи/внешние письма не запускались;
  pending email/binding/schedule/deletion/cancellation/shop queues до старта0.
  Git push не выполнялся. Server evidence: release-da47b54.al4N82, receipt SHA
  `608a539ff9ef864d7d0bf48e01811da651fa6769a35dd14ad80f1c2358d321c1`.
  Backup/config rollback сохранён; возврат на старую DB после новых writes требует
  отдельной сверки, не запускать historical copy/empty-candidate процедуры заново.

### Локальное исправление проверки сессии —19 октября

- [x] AUTH-S1 — подтверждённый пользователем дефект: SessionService.optionalUser
  ловил любую ошибку → GET /api/auth/me200/user:null → ложный confirmed guest.
  Minimal fix: null только для typed HttpError401/403; остальные failures →
  sanitized Nest503 без cookie mutation/no-store. Обнаружен второй путь в том
  же lookup: getUserByOpenId при !DB client возвращал undefined; теперь throw,
  undefined остаётся только для отсутствующей строки в доступной DB.
  RED4 failures/6 pass на настоящих JWT/SDK/Nest/loopback HTTP, injected SQL
  lookup/activity failures; после первого fix10 pass. Дополнительный !DB test
  RED1/10 pass → GREEN11. Никакую реальную DB не отключали/не читали/не меняли.
  Проверены503 → recovery тем же JWT/cookie, no cookie clearing, safe body;
  upstream plain status403 не считается authenticated denial; no-cookie/bad/
  expired/deleted/blocked/revoked по-прежнему200/null. tRPC auth.me вместо200/null
  даёт существующий safe500/INTERNAL_SERVER_ERROR и восстанавливается; отдельную
  tRPC error mapping не вводили. Неизменённый legacy createContext не active entry.
  Targeted regression:9 files/84 pass/0 skip/1.83s (включая11 новых), root types
  и backend build pass. Это HTTP/JWT +fault injection на SQL seams, не native
  MySQL/browser acceptance. No workers/provider/network outside loopback.
  Фронт/дизайн/схема/working DB/candidate/S3/роли/квоты/CORS не менялись;
  server access/push/deploy/app switch отсутствуют. Scope — local fix only.
  **Images2083911/e774/0763 не содержат AUTH-S1.** Для будущего rollout нужен
  новый backend image с этим fix и его отдельная acceptance, не reuse старого
  образа как «актуального». D2 receipt остаётся исторической проверкой0763.

### Разрешённая подготовка staging/server — 19 октября

- [x] FRESH-D2 — прямое разрешение проверить corrected final image0763 на
  populated candidate и source delta после D1 snapshot. Старую DB только
  SELECT/read-only; candidate data не синхронизировать/не перезаписывать.
  Сохранить admin/password hash/session/role, проверить existing password через
  isolated API. Exact archive/image/bundle/host/container/UUID/history guards,
  temporary least-privilege account/no workers/providers/ports, cleanup receipts.
  App switch/deploy/frontend/S3/push и source writes запрещены. Delta сравнивать
  с сохранёнными D1 hashes, не только row counts; candidate login timestamps
  отделить от новых изменений источника. Выполнено19 октября,13:44MSK:
  local archive SHA-1b957… и D1 receipt SHA-500221… verified; exact host/DB UUID/
  containers/network/history42, disk1735MiB/available RAM594MiB guards.
  Archive254MiB загружен без rebuild/install/pull; server SHA совпал перед load.
  Actual image0763/source2083911/amd64/non-root/config/bundle SHA-bb977… verified;
  backup directory0700/UID1000 проверен внутри обоих isolated probes.
  Real SQL consistent read-only snapshot в обеих DB, временный SELECT-only
  account, explicit source columns/dateStrings/jsonStrings/bigints/UTC и D1
  digest algorithm. Source850/candidate850; все28 tables кроме users совпали
  с D1 SHA. Users2/2/no insert/delete; различие одной строки только
  lastSignedIn/updatedAt. Hash/role/admin/sessionVersion2/blockedAt совпали,
  new10 tables пусты/history42/column fingerprints прежние. Sync/DML отсутствуют.
  Дополнительный read-only metadata check: indexes/table engines/collations
  совпали, triggers/routines/events/FK0. Users AUTO_INCREMENT после snapshot
  вырос: observed source next500/candidate499 (13:50MSK), rows по-прежнему2/2.
  Candidate counter не меняли: перед future cutover нужен свежий source floor
  на согласованной write boundary; никакого фиксированного ALTER500 сейчас.
  Первый supplementary checker ошибочно сравнивал JSON property order как
  строку; diagnostic capture подтвердил равенство объектов. Minimal RED→GREEN2
  исправил только own private checker; captured metadata проверены повторно
  локально, без SQL replay/изменения guards. Product code не менялся.
  Диагностический comparator отдельно прошёл5 synthetic checks на image без
  network/SQL; это не дополнительные native SQL cases. После delta source
  grant отозван; API только SELECT candidate +users INSERT/UPDATE для login.
  Exact D1 API probe bundle повторно использован без изменения/overlay deps:
  39 ORM/13 HTTP pass, wrong password401/no cookie, прежний password login200,
  me/admin.stats/logout/secure host-only cookie; hash/role/session/history
  после login неизменны. Workers/providers/working executable не запускались.
  UID1001/internal network/no ports/read-only/cap-drop/256MiB/CPU0.4, exit0/OOMfalse.
  Оба own probes и temporary account удалены с exact guards. Uploaded archive
  и own code files удалены по hashes; local original/loaded0763/old images сохранены.
  Все29 existing containers IDs/images/start times/health совпали; working API
  по-прежнему daryadarcy_staging/current HTTPS200. Server private directory0700/
  receipt0600, local/server receipt SHA
  `89392d893c58f71d2192acce137f8ed3161da398626b508c4aa904fd0a07de72`.
  Дополнительный local/server postcheck.json (metadata/counter), SHA
  `6e603b4c46ceb6c3fb29ff3aa72bbd9830763b1b79326055233f888010e4f0c1`.
  No source writes/sync/frontend/S3/push/deploy/switch. Остаток для future cutover:
  новая delta/users counter floor на границе writes, backup/config/secrets continuity/permanent app
  grants/rollback и отдельное разрешение. При unchanged image прежние успешные
  local native backup tests не повторялись; production workers/реальные providers
  этим isolated acceptance не проверены. Только plans/runbook изменены в Git.

- [x] FRESH-D1 — прямое разрешение подготовить перенос staging data в existing
  `daryadarcy_candidate_20261019`, сохранив admin/password, без app switch/deploy.
  Source только SELECT/read-only snapshot; никакой repair history0017–0019,
  schema/data writes, блокировки writes или удаления старой DB. Candidate42
  history не переписывать, all application tables должны быть пусты. Exact
  server/container/UUID/schema guards, least-privilege temporary operator,
  synthetic native rehearsal перед server copy; row/column/hash/counter/default
  comparison и isolated candidate API/auth/admin checks без workers/providers.
  No frontend/S3/payments/mail. Source rows не скачивать в local fixtures/logs.
  Snapshot не является continuous sync: будущий cutover требует новой сверки
  writes/дельты, отдельного разрешения и готового image/frontend rollback.
  Read-only19 октября: old DB29 tables/no history, candidate40/history42,
  candidate application rows0. Source850 rows (742 posts/60 videos/2 users,
  payments10/receipts2/outbox8/password_tokens7/tags17/consent2), admin active.
  Foreign keys/triggers/routines/events0; только nullable youtubeId widening,
  new default provider/access и nullable poster/VK fields. Schemas/row counts
  сохранены private вне Git, без user data/credentials. Local RED→GREEN:
  6 mapping units +4 native tests, fresh42/legacy29 own tmpfs backend_test.
  Real identity conflict откатывает все rows, непустой target refused, source
  SQL writes запрещены read-only transaction. Синтетические password hash/
  session/paid subscription/JSON/opaque mail+token rows сохранены, counters
  не понижаются. Candidate-only counter DDL предшествует row transaction:
  при отказе могут остаться повышенные counters, но не частичные rows/history.
  Root types pass. Выполнено19 октября: exact host/MySQL3442fbda…/UUID/network/
  source API29e02dc… guards, verified fresh42 hashes/indexes/column fingerprints.
  Read-only source snapshot → candidate:29 tables/850 rows, explicit columns,
  per-table count+SHA exact before commit; all10 added tables остались пусты.
  Account id1/password hash/admin/sessionVersion2/blockedAt сохранены; paid
  records/receipts/outbox8/password_tokens7/JSON/old URL strings без изменений.
  Actual server API с image e774/runtime source2083911 (код API не менялся):
  39 ORM +13 HTTP, guest/admin denial, wrong password401/no cookie, прежний
  пароль login200/me200/admin.stats200/logout200, secure host-only cookie.
  Hash/role/session/history после login неизменны; только candidate login
  timestamps и возможный AUTO_INCREMENT gap от штатного upsert допустимы.
  Source account имел только SELECT; candidate SELECT/INSERT и exact counter
  ALTER grants. Перед API source/INSERT-all отозваны, users INSERT/UPDATE only.
  Isolated UID1001/internal net/read-only/no ports/no workers/provider config,
  exit0/OOM=false. Account и оба own server probes/upload удалены с guards.
  Local synthetic API39/13 тоже pass; own local DB fixtures/network удалены,
  прежние2 containers/12 volumes/images не трогали. Все29 existing server
  containers IDs/images/start times/health совпали; API по-прежнему использует
  daryadarcy_staging, current HTTPS200. Final read-only counts850/850, all10
  new tables0, counter floors не ниже source, candidate history42 сохранена.
  Source history по-прежнему отсутствует: ничего не repair/apply на old DB.
  Private local/server receipt SHA
  `5002210c4046aaac2430fea97324feef6904e8fd0d7d87c11679053315af4a44`;
  .local-artifacts/candidate-transfer-20261019.4m7y89 + server own receipt,
  permissions0700/0600. Rows/passwords/JWT/SQL credentials в Git/logs не попадали.
  Это snapshot, не cutover/sync/production-worker/S3/payment/mail acceptance.
  App/front/current DB/S3/flags/config/deployment/push не менялись. Corrected
  0763 image всё ещё только локально; future switch требует его отдельной
  populated-candidate проверки, delta/write/backup/permanent-grants/rollback gate.

- [x] FRESH-C6 — прямое разрешение проверить backup/restore **финальным image2083911**
  локально на двух own loopback/tmpfs `backend_test`. Native dump + restore
  clients из immutable image, настоящий production backup module без workers;
  fresh42/synthetic rows, точное сравнение всех tables/data/DDL/history,
  uniqueness/recovery и отказ restore в непустую target. Ownership guards до
  SQL/cleanup; image/source/bundle SHA, private artifact permissions, no S3/mail.
  Текущую и server candidate DB/frontend/app configuration не менять;
  без server access/push/deployment/switch. Обновить evidence/runbook после проверки.
  Выполнено19 октября: две own MySQL8.4.11/tmpfs без volumes, loopback autoports.
  Прежний rehearsal RED1/7 pass подтвердил, что он использовал MySQL-container
  client, а не image. Новый opt-in native image path запускает source-identical
  backup module/ENV и настоящие mysqldump/mysql из image, UID1000/cap-drop/
  namespace только guarded DB, provider env не наследуется, no workers.
  На original e774…:8 pass/1 fail — реальный дефект Dockerfile, backup directory
  0755 вместо0700. Сами gzip0600; data/DDL/history/restore уже проходили.
  Исправлен только Dockerfile: дополнительный chmod0700 layer. Clean selected
  archive2083911 + exact one-line canonical Dockerfile patch; runtime source/
  bundle/dependencies/config и все9 base layers побайтно прежние.
  Новый **локальный** tag fresh-c6-2083911-private-backups, image0763…,
  Dockerfile SHA-c5d13…; source label2083911 означает unchanged runtime source,
  не отсутствие отдельного packaging patch. Final native10 pass/0 skip/3.47s:
  40 tables exact DDL/data,42 history, Unicode/JSON/indexes/auto increments,
  identity/recovery/library uniqueness, source unchanged, непустой target refused,
  реальный wrong-password dump без complete/partial/credential leftovers.
  Новый image offline2/2/2.43s (6 HTTP/native deps), root types/prettier pass;
  backup units16 pass/2 opt-in skips (не выдавать за acceptance этих2).
  Image/archive254MiB/checksum/verification+JSON test report сохранены вне Git:
  .local-artifacts/backend-2083911-c6; archive SHA-1b957… verified, receipt SHA
  `63faf78c6fe63678dc805e598feed8c46a990690659a7f0582cc9e4e801d705c`.
  Own probe/DB containers и empty network удалены с точными guards; прежние
  2 foreign stopped containers/12 volumes/images сохранены, free~3.1GiB.
  Preflight: internal network не публиковала loopback ports, заменена только
  own network на bridge с masquerade=false; initial readiness race устранён
  штатным wait-test-database, SQL тогда ещё не менялся. Product не изменяли.
  Server/current DB/candidate/frontend/S3 не читались/не менялись. Новый0763
  image не загружался на сервер: C5 относится только к прежнему e774. Будущий
  corrected-image candidate check/switch/owner/grants/writes, backup mount0700
  и off-site/production-scale recovery остаются отдельными gates.
  Final docs59/diff/code prettier/root types pass; self-review scope/security/
  correctness: production change только owner-only backup directory в image,
  no runtime/API/schema/lockfile/frontend changes. Full unchanged suite не повторяли.

- [x] FRESH-C5 — прямое разрешение проверить **финальный image2083911** на
  existing `daryadarcy_candidate_20261019`, без switch/frontend/текущей DB.
  Разрешён transfer/load versioned artifact только для isolated probe; не
  deployment/update Compose/working env/services. Exact host/MySQL UUID/ID/
  internal network, archive/config/bundle SHA, history42 до любых новых credentials.
  Canonical candidate CLI `--check-api`, временный SELECT-only account, без
  dependency overlay/пересборки/server installer/schema DDL/seed/workers/providers/ports.
  Проверить39 ORM schemas/8 HTTP; удалить только own probe/account/env, сохранить
  receipt и сравнить existing container/config metadata/history/volumes до/после.
  Выполнено19 октября: strict SSH exact host/key; MySQL3442fbda…/UUID/network
  прежние, candidate history42 SHA-e8d87… прежний/users0. Archive SHA-2ad091…
  сверён перед load; exact image e774…/source2083911 и actual bundle SHA-bb977…
  проверены, без rebuild/dependency overlay. Canonical candidate CLI bundle
  SHA-8e871… совпал с C3: runtime source6f06e09..2083911 неизменён.
  Actual image/Nest/SQL:39 ORM tables/columns +8 loopback HTTP, exit0/OOM=false.
  Guest auth/launch/feed/articles200; admin401; default-off files404. Только
  временный SELECT на candidate, UID1001/internal net/no ports/read-only/cap-drop/
  memory256MiB/CPU0.4, без executable/WorkerJobs.start/providers/working env.
  Нет SQL initialize/schema DDL/seed/data writes. История/users0 после прежние;
  exact own container/account/env удалены,24 existing containers IDs/images/
  start times/health +configuration metadata и volume names совпали до/после.
  Все7 project services healthy, current HTTPS200. Receipt SHA-256:
  `4c1ef5ad5241298411a98de2a941ce63b42a448ffcb491f00e6fc04bca570f8a`;
  server private candidate-image-20261019-2083911.f1vR0P/verification.json и
  local .local-artifacts/backend-2083911/candidate-verification.json совпали.
  Удалена только own uploaded archive254MiB после guards/hash +receipt success;
  local original/loaded image сохранены, free~1.7GiB, archive-cleanup.json.
  Диагностика до load/account: metadata template не принимал missing Health;
  исправлен безопасный index. Tar allowlist отклонил trailing directory slash,
  затем macOS AppleDouble metadata; нормализованы directory names, архив создан
  COPYFILE_DISABLE=1/59 allowlisted entries, guard не расширен. Initial SSH без
  agent identities отказал; использован existing project key, private bytes не
  читались. Отдельные SSH banner timeouts: основной retry прошёл; поздняя
  optional copy cleanup receipt отказала, основной verified receipt уже локально.
  Runtime не исправлялся.
  Push/deployment/switch/frontend/current DB/S3 отсутствуют. Native backup/restore
  с image client на own disposable MySQL ещё не проверен; release gate открыт.
  Final docs59/diff pass. Только4 существующих Markdown files изменены;
  application/schema/API/dependencies не менялись, успешные unchanged local
  native image/types/full suites не повторяли. Это actual server SQL/HTTP,
  не mock/browser/payment/mail/S3/production worker acceptance.

- [x] FRESH-C4 — по прямому разрешению подготовить локальный Linux amd64
  backend-only image и процедуру отката пары image/DB connection. Existing
  combined Dockerfile/compose, frontend и текущую/кандидатную server DB не менять.
  Frozen lockfile/pinned Node22, no install scripts; native offline image probe
  (non-root, sharp, mysql client, real composition HTTP, no workers/providers).
  Образ не загружать на сервер, приложение не переключать, push/deploy нет.
  Откат без reverse SQL/drop/restore поверх существующих БД; новые записи после
  возможного switch — stop/сохранить/согласовать, не обещать lossless switchback.
  Подготовлены Dockerfile/allowlist, offline API-only override и runbook.
  Native RED2 (образ отсутствует); backend compilation597.1kB прошла, но
  production packaging не завершена: две own попытки остановлены, registry
  ECONNRESET и свободное место115MiB, Docker API timeout/Desktop stopped.
  Удалены только own extracted dependency tree/pnpm cache под private tmp,
  matching SHA-256 archive сохранён; свободно~760MiB. Targeted Docker cache
  prune ID `v0augx12yu8atgzx3hfyozdxg` вернул daemon timeout, очистка не подтверждена.
  Native image GREEN/ID/export отсутствуют; не считать artifact готовым.
  Compose RED1→GREEN1: actual offline config candidate diff только api image/URI,
  baseline round-trip exact; Docker containers/SQL не запускались. Synthetic
  env files0600/temporary removed, no working env/credentials read.
  Нужны восстановление Docker/места и окончание native image acceptance;
  задан вопрос о запуске Docker и удалении только точного own cache.
  Final local checks: root types/exit0, offline Compose1 pass +image2 opt-in
  skips (не image acceptance), docs59/prettier/diff pass. Native production
  dependency audit0 advisories/325 deps; lockfile неизменён. Existing runtime
  source/API/schema/rollout/frontend не менялись, full2544/S3/SQL не повторяли.
  Продолжено после прямого разрешения запуска Docker/только own cache cleanup.
  Обычный start отказал, restart45s не остановил hung backend. Проверены uid/path
  точных процессов; TERM, затем KILL только supervisor12219 после отсутствия VM.
  Docker29.8.1 восстановлен; own aborted IDs v0aug…/qxvp… уже отсутствовали,
  cache1113MB успешных stages сохранён, broad prune не выполнялся. Те же6 images,
  12 volumes и2 foreign stopped containers сохранены; free~4.7GiB до сборки.
  С чистого archive2083911 image build exit0. Первый native1 pass/1 fail —
  ошибочное ожидание launch200 без DB; подтверждён existing fail-closed503,
  исправлен только test helper, runtime не менялся. GREEN native2 +Compose1 =
  3 pass/0 skip/8.80s; sharp pixel/dump version/non-root +6 actual HTTP,
  network=none/read-only/no workers/providers/ports/SQL/S3. Actual CMD bundle
  syntax check exit0; image frozen package versions сверены. Source2083911,
  image `sha256:e774b30f3b9a04b10de094d2b0999da6be0d8dd3620721e2d1b2cd3ab56403d5`.
  Save archive254MiB +receipt/checksum вне Git в .local-artifacts/backend-2083911;
  tar tag/config digest/source/platform +checksum verified, не server load.
  Финальный image на candidate DB и dump/restore client ещё не принимались;
  upload/deploy/switch/working DB/frontend/old S3 не трогались. Полные hashes
  и процедура — [runbook](../docs/operations/candidate-backend-image-rollback.md).
  Final root types/exit0, docs59/code prettier/diff pass; checksum file verifies
  archive OK. Postchecks:2 прежних stopped containers/12 volumes/6 прежних images
  плюс только новый backend image, free~2.5GiB. Runtime/lockfile/Dockerfile не
  менялись в продолжении, только probe expectation и evidence docs; full suite
  не повторялась, prior frozen-lockfile production audit0 advisories сохранён.

- [x] FRESH-C2/C3 — новое прямое разрешение: применить fresh42 только к
  `daryadarcy_candidate_20261019` и проверить candidate API без switch.
  Exact server/container/network/UUID + pinned plan hash + empty schema guard;
  отдельная candidate-only учётка, затем SELECT-only для API, без working env.
  API composition без executable/scheduler, no external egress/ports/SMTP/S3/
  payments/owner seeds; ORM columns/history и guest HTTP. Текущая БД/фронт/
  services/configs не меняются. Partial DDL сохранять для диагностики, не repair.
  После проверки убрать только свои probe containers/временные credentials;
  приложение не переключать и не пушить без нового запроса.
  Выполнено19 октября: actual Drizzle fresh42, проверенная история; повтор
  initialize отказал без изменения истории. Отдельный candidate-only operator,
  существующие local/preflight guards не ослаблены. Source `6f06e09`, план
  `51616035e287f221c633d8c7975fef46229d6fbc4ef1e80e586f85e96469684a`.
  API на Node22/Linux amd64 с актуальными frozen-lockfile dependencies:
  39 ORM tables/columns +8 actual loopback HTTP/0 users, SELECT-only account,
  internal network/no published ports, workers/providers не запускались.
  Guest auth/launch/feed/articles200; admin401; default-off private files404.
  Исправлен только дефект synthetic probe origin: production запрещает HTTP;
  отдельный regression RED1→GREEN1, CORS/production policy не менялась.
  Server dependency install достиг лимита own container384MiB/OOM; не повышали
  лимит shared host, Linux dependencies подготовлены локально и сверены SHA-256.
  Все7 existing services healthy, IDs/images/start times/config metadata прежние,
  current site200; own containers/account/env удалены. Фронт/текущая БД/S3/flags/
  push/switch не трогались. Full Node22:2544 pass/1574 opt-in skips,
  200 passed suites/91 skipped/43.88s/exit0; focused35, root types, boundaries685,
  API86 unchanged, docs58, code prettier/diff pass. Подробности/receipt hashes:
  [operations runbook](../docs/operations/teamassist-staging.md).

- [x] Fresh remote staging `81e8563` — ancestor local `e4ac07b`, remote-only0;
  правки фронтендера сохранены без замены/ручного редактирования frontend.
  Перед push проверены types/E2E types, backend build, webpack29/29, lint,
  boundaries685, docs58, API86/32048 bytes и production audit (0 advisories).
  Node22.23.2 выявил test-only дефект: structuredClone(File) теряет имя/File type,
  два recovery unit cases падали. Isolated RED воспроизведён; helper копирует
  metadata, сохраняя immutable File, без ослабления production validation.
  GREEN34/34 на Node22 и23; full Node22:2508 pass/1574 opt-in skips,
  197 passed suites/91 skipped,64.19s/exit0. SQL/S3/browser skips не приёмка;
  real SQL/S3/external mail/payment не запускались. Test fix `b810ddb`.
  Обычный fast-forward push `81e8563..b810ddb` принят; ls-remote подтвердил
  `b810ddb29caad4528f18a74168b97c487b2a0dd9`. Ветки не переключались,
  force/merge/rebase не выполнялись; это Git-обновление, не deployment.
- [x] По отдельному ответу пользователя создана **пустая**, не переключённая
  server DB `daryadarcy_candidate_20261019`. До CREATE подтверждены отсутствие
  такого имени, host/teamassist-dev, existing MySQL8.4/container3442fbda5e84,
  project/service labels/healthy и отсутствие published DB ports. После CREATE:
  0 tables/routines/triggers/events; existing rows не читались/не изменялись,
  все container IDs/images/start times прежние. API env/secrets/S3/flags/image
  configs не менялись; контейнеры не перезапускались. HTTPS current unchanged
  deployment: `/`, `/api/auth/me`, `/api/launch-config`200; guest admin.stats401.
- [x] Fresh server candidate: подготовить проверенную отдельную процедуру
  fresh schema на новой БД, candidate image/API checks и rollback приложения;
  **после проверки согласовать switch с пользователем**. Закрыто последующими
  FRESH-D1/D2 и RELEASE-D3/D4: switch явно разрешён и выполнен, admin/password
  сохранены, active candidate/history42/backup/образы проверены. Этот пункт
  не требует повторного создания БД или переноса; evidence в начале checklist
  и [runbook](../docs/operations/candidate-backend-image-rollback.md).
  Историческое состояние до этих выпусков: FRESH-C2/C3 выполнен:
  схема42 и guest candidate API проверены, но данных/owner/permanent app grants
  нет, новый backend не выложен. FRESH-C4 local image/archive/rollback подготовлен;
  FRESH-C5 final image candidate acceptance выполнен; остались backup client и отдельное решение
  о upload/switch/owner/начальных данных; автоматически не выполнять.
  Ordinary preflight: untracked0017–0019, databaseChecked=false/exit1;
  guard не обходили. Для fresh пути история старой базы не нужна. No migration
  apply к текущей БД/DB replacement/old-file migration/private flag enable
  разрешения нет; новое разрешение apply только candidate — FRESH-C2/C3 выше.
  - [x] FRESH-C1 — local offline `--plan` в existing fresh tool: точный порядок/
    SHA-25642 миграций и общий plan hash, без Docker/SQL/network/credential reads.
    RED/GREEN CLI tests: пустое окружение, унаследованные DB URI игнорируются,
    изменённые bytes меняют hash, неизвестный SQL/args fail closed. Existing
    local initialize/check guards не расширять. Это подготовка, не server apply.
    Выполнено: RED3 до реализации; GREEN11 CLI +3 policy +12 history/manifest
    +13 apply-command guards =39 pass/4 suites/0 skip/5.66s на Node22.23.2.
    Без DB credentials/PATH Docker; connection trap0, journal bytes unchanged,
    missing/unknown SQL и combined/unknown modes отказали. Source plan hash
    `51616035e287f221c633d8c7975fef46229d6fbc4ef1e80e586f85e96469684a`;
    databaseChecked/initialized/releaseApproval=false. Existing local guards и
    SQL apply body сохранены; source inspection теперь до fixture inspection.
    Сервер/БД/фронт/S3/flags/push/deploy не трогались в этом срезе.
    Full Node22:2519 pass/1574 opt-in skips,198 passed suites/91 skipped,
    63.67s/exit0. Native SQL/S3/browser acceptance не повторялась. Root types,
    boundaries685, API86/32048 unchanged, docs58, prettier/diff exit0.
    Review: только новый early-return offline mode и общий source preflight;
    existing Docker ownership/URI/production/empty DB locks/apply не ослаблены,
    новых deps/HTTP API/schema нет. Build приложения не повторяли: runtime не менялся.

### LB — Библиотека, принято17 октября

- [x] AG9/LB-handoff —18 октября по продолжению без S3 existing документ
  передачи сверен с774bbe9. Добавлены REST list/read payload, cursor/50 limit,
  live session/club checks, empty200 vs404/503, default-off42-migration boundary
  и отсутствие library usages в editor upload/status. Описаны ограничения для
  будущей интеграции (кэш аккаунта/late responses/no public fallback), без правок
  фронта/дизайна. Доказательства17 октября отделены от actual S3/выпуска;
  LB4 остаётся unchecked. Новых runtime функций/запусков/БД/S3/старых files нет.
  Передача сохранена локально, внешние сообщения не отправлены.
  Docs check58/exit0 и diff check/exit0; API shape/statuses сверены по controller/
  list implementation и принятому SPEC. Повтор runtime suites не требуется:
  изменены только3 существующих Markdown файла, приложение не менялось.

- [x] LB-read integrity — по «пока без S3»17 октября проверены оставшиеся
  локальные границы list контракта. **Подтверждённый дефект:** INNER JOIN скрывал
  enabled binding без receipt и возвращал200/empty либо partial list. Native
  RED:2 failures200→503 (первая и следующая страница). Minimal LEFT JOIN +
  validation перед metadata mapping даёт existing generic503/no-store;
  auth404/disabled hiding/50-item cursor contract не меняются, raw URLs не выдаются.
  GREEN:8 native list/read +8 native import/rehearsal +4 pure/type =20 checks,
  3 suites/0 skips/6.16s.52 valid entries+disabled sentinel:50→2, одинаковые
  sortOrder/граница следующего порядка без gaps/duplicates; malformed cursors
  и отозванная между страницами сессия404, SDK effects на list отсутствуют.
  Root types/check:api86(32048 bytes unchanged)/backend bundle/boundaries685/
  prettier/diff exit0. Review:1 bounded query/51 rows, unique asset join,
  nullable receipt валидируется до сериализации, нет новых deps/quotas/roles/API.
  Общий regression:2508 pass/1574 opt-in skips,197 passed suites/91 skipped,
  60.18s/exit0. Skips не native acceptance;16 native+4 pure checks выше отдельно.
  Docs58/exit0. После review исправление и regression tests сохраняются вместе.
  Own `daryadarcy-library-list-20261017` ed6fd6f7…4c843eb/65228 удалён после
  exact ID/name/label/127.0.0.1/tmpfs768MiB/no mounts guards, SDK/API закрыты.
  Чужие2 stopped containers/images/volumes сохранены. Настоящие S3/старые files/
  working DB/frontend/design/flags/push/deploy не трогались; LB4 остаётся blocked.

- [x] LB4 — по новому прямому разрешению17 октября проверить existing library
  import/read/recovery с actual Timeweb S3, только новые synthetic файлы и own
  fresh tmpfs backend_test. Старые files/working DB/frontend/design/policy writes/
  runtime flags/push/deploy исключены. Второй principal по-прежнему отложен.
  **Выполнено19 октября:** связь восстановилась, signed policy hash совпал,
  versioning off. Новый opt-in `tests/library-files.s3.mysql.test.ts`:
  **4/4 pass,0 skip,80.57s/exit0**, actual importer/fresh processes→SQL42→Timeweb
  S3→Nest/JWT/loopback HTTP. Три материала/6 новых synthetic photo+document:
  потеря настоящего PUT ACK и результата committed import, повтор/concurrent
  replay без второго PUT/новых receipts, changed payload conflict. Direct
  anonymous GET/HEAD/Range403; API byte-exact200/HEAD/206, inline/attachment,
  no-store/nosniff, list без raw key/URL. Guest/unpaid/sessionVersion/block404,
  moderator без paid row имеет service access; чужой rollback conflict,
  own rollback идемпотентен/disabled без public fallback, replay409.
  Финальные6 targets удалены с metadata/ETag/IfMatch guards и HEAD404, policy
  unchanged. SDK/процессы/ключи в памяти закрыты; own tmpfs fixtures396788e6…/60852,
  c941dc70…/61368,b3324ccb…/61908 удалены после exact ownership/storage/port checks;
  чужие2 stopped containers сохранены. Рабочая/candidate БД, старые files,
  frontend/design/flags/push/deploy не трогались; runtime-дефекта не выявлено.
  Промежуточно: PATH не содержал Docker — guard отказал до DDL; test projection
  id→assetId исправлен. Первый native3 pass/1 test-query fail; параллельный
  повтор1 pass/3 fail после незавершённого импорта, точный SDK отказ не записан.
  Его pending не публиковался, все own targets стали404; safe SDK diagnostics
  добавлены без изменения timeout/retry/security. Изолированный финал выше PASS;
  стабильность внешней сети/target-load этим не доказана.
  Full Node22:2544 pass/1578 opt-in skips/200 suites pass/92 skipped/33.91s/exit0;
  skips не S3 acceptance. Final types/code prettier/diff/docs check pass.
  **Предыдущий блокер17 октября:** два SDK GetBucketPolicy preflight завершились
  TimeoutError без HTTP status; независимый HTTPS HEAD к endpoint подтвердил TCP
  connect≈0.003s, TLS не установлен за5s (`SSL connection timeout`,http000).
  Это не ошибка авторизации/доказательство неверных ключей. Policy не прочитана,
  PUT/DELETE не выполнялись, synthetic objects не создавались, старые keys/данные
  не читались. Нельзя засчитывать LB3 loopback как actual S3 acceptance.
  Own `daryadarcy-fresh-library-s3-20261017` 070f0fa4…71aa5c8/58689:
  fresh initialization42/exit0/releaseApproval=false, без working configuration.
  Контейнер удалён после exact ID/name/label/loopback/tmpfs768MiB/no mounts guards;
  чужие2 stopped containers/images/volumes сохранены. SDK client закрыт,
  предоставленные ранее ключи использовались лишь в памяти, не записаны в файлы.
  Прежний network blocker снят результатом19 октября; новые bucket/ключи/
  ослабление TLS/policy не понадобились. Далее только отдельно разрешённые
  real sources/старые URL/frontend integration и release gates AG5/AG9.

- [x] AG5/LB — независимая локальная репетиция backup/restore с новой0041.
  По «давай дальше пока»17 октября актуализирован existing native backup test:
  synthetic library binding/ready receipt и pending receipt/import intent,
  JSON snapshots/reserved IDs и Unicode filename. Причина повтора — прежний
  native restore был на41 migrations, а после LB появились2 таблицы и enum values.
  Production backup→actual mysqldump8.4→gzip→native mysql restore в другую own
  пустую БД: **7/7 pass,0 skip,4.42s**, обе42-migration schema/history проверены.
  Сравнены hashes содержимого всех таблиц и точный SHOW CREATE TABLE: InnoDB,
  collations/generated fields/indexes/auto increments. Отдельно проверены live
  binding→ready receipt, pending без parent/ETag, committed/pending journals и
  уникальность slot/asset/requestKey после restore. Файл0600/каталог0700,
  partial artifacts отсутствуют; nonempty target отказывает без изменения данных.
  Это metadata/DB restore, не проверка файлов S3/выпуска. Runtime не менялся,
  новых функций/deps нет; existing backup transport test adapter сохранён.
  Root types/prettier/boundaries685/diff exit0, review test/ownership/no-network.
  S3 env в isolated runner отсутствует и явно выключен; flags/mail/payment/
  frontend/design/working DB/старые files/push/deploy не трогались.
  Own `daryadarcy-fresh-backup-library-source-20261017`52e9fed1…9ea11f/64106 и
  `daryadarcy-fresh-backup-library-target-20261017`4f7d5478…21da3e/64107 удалены
  после exact ID/name/label/loopback/tmpfs768MiB/no mounts guards. Temp archive/
  adapter удалены самим тестом; чужие2 stopped containers/images/volumes сохранены.
  LB4 actual S3 остаётся blocked/не PASS. Исторические пустые галочки ниже не
  возобновлять как новые задачи; оставшиеся AG5/AG9 требуют external inputs/решений.

- [x] LB1 — add-only schema, default-off list/read routes и live club/session
  checks; сначала native HTTP RED, затем GREEN. Existing streaming/Range reuse.
  RED404→GREEN; display-order RED→GREEN. Native5 library +21 existing content
  checks=26 pass/2 suites/5.07s, skips0. Fixture SQL0041, не fresh acceptance.
  Unit7/2 suites pass; root types/backend build/boundaries683/docs58/diff exit0.
  No frontend/working/S3 changes. Existing content suite logs missing fixture
  push-consent table, transport credentials отсутствуют; внешних push нет.
  Review: новый parent library требует live binding+asset match; old UUID read
  тоже закрыт при disabled binding/flag, list source-free/keyset bounded.
- [x] LB2 — keyed migration manifest/intent до копирования, exact byte import,
  atomic binding revision CAS, recovery без дублей и rollback закрытой версии.
  Pure manifest RED→3 GREEN; type-contract RED→GREEN обнаружил/устранил accidental
  library usage widening в editor receipts: check:api86/32048 bytes unchanged,
  frontend не менялся. Native importer RED4→GREEN; MyISAM preflight RED→GREEN.
  Финальный focused run:4 pure/type +5 read +8 import/rehearsal +21 existing
  private-content =38 pass/4 suites/8.52s/skip0. Native JWT/Nest/MySQL/SDK wire,
  не actual S3. Root types/backend bundle exit0. Dry-run limits и функции — SPEC.
  Review: live admin epoch/role/block, full unique keys+InnoDB, short SQL locks,
  conditional PUT без overwrite, durable UUID/hash, same-material atomic CAS,
  retained private versions/guarded rollback, нет HTTP upload/URL fetch/новых deps.
- [x] LB3 —6 synthetic files/own tmpfs backend_test/loopback storage: потеря
  ответов, restart/retry, откат, права и public controls. Никаких real S3/working
  DB/старых files/frontend/design/push/deploy. Проверки и коммиты записывать здесь.
  - Полная synthetic репетиция:2 TXT placeholders (recipes/peterburg) и4 real
    lossless WebP (holly/sock/star/apple); dry-run без DB/SDK effects, bytes/hash
    через stable Nest GET совпали. Это не проверка состава настоящей папки Петербурга.
    Отдельные Node processes: lost PUT ACK→pending→restart/recovery; SQL commit
    при намеренно потерянном результате child→restart/replay без нового SDK call.
    Итог6 enabled bindings/6 receipts/3 committed ops/6 binary PUTs. Параллельные
    попытки сходятся к одной операции/двум assets; conditional PUT503 допускает
    same-key retry, не объявляется ложным success. SQL fault второго binding
    откатывает весь batch, rollback сохраняет stable URL/bytes/private revision.
    Pending UUID/alias закрыты, epoch revoke до recovery отказывает без storage.
    Synthetic public-control bytes/metadata неизменны, запросов к ним нет;
    это fixture, не доказательство anonymous ACL/cache purge реальных URLs.
  - Отдельная действительно пустая own БД: fresh42 canonical migrations,
    native schema/HTTP/preflight acceptance **9/9 pass,3.59s**, без fixture DDL.
    История legacy0017–0019/рабочая БД не исправлялись и не читались.
  - Финальный общий unit/regression run **2508 pass/1570 opt-in skips,
    197 passed suites/91 skipped,74.73s/exit0**. SQL/S3/browser skips не PASS;
    native scoped34 + pure/type4 выше проверены отдельно, fresh9 отдельно.
    Root types/backend bundle/boundaries685/docs58/check:api86/diff exit0.
    Скиллы TDD/incremental/API/security/review помогли разделить schema/read,
    pure manifest и durable importer; найденные order/engine/type defects
    получили RED/GREEN, новых зависимостей/продуктовых функций нет.
  - Own containers `daryadarcy-library-rehearsal-20261017` 0bfc0249…5f31a8/52251
    и `daryadarcy-fresh-library-20261017` 2dba76ad…fb6d50/55614 удалены после
    exact64 ID/name/codex.owner/127.0.0.1-only/tmpfs768MiB/no mounts guards.
    Synthetic DB data ephemeral; тесты воссоздают их. Loopback HTTP/SDK закрыты,
    чужие2 stopped containers/images/volumes сохранены. Git frontend diff пуст.
  - Коммиты: df3efdc(read/schema),ce32fb7(manifest),9fc1d2d(editor boundary),
    168ae6f(importer/rehearsal). Текущий разрешённый LB scope закрыт локально;
    реальные sources/перенос, storage enforcement/старые public URLs, frontend
    integration и rollout — отдельные решения, не запускать автоматически.

### Сверка всего первого этапа — 17 октября

- [x] AG9-TZ — повторно сопоставить сохранённое ТЗ§2.1/4.1–4.16 с current
  frontend/backend и последними результатами. Матрица/команды/границы:
  [существующий аудит](../docs/audits/frontend-stage-one-scope-2026-10-03.md).
  Native HTTP/JWT/own fixture SQL:305/12 suites/17.81s +44/3 suites/3.28s;
  client25 suites/372 pass, включая5 actual Chromium component checks с
  контролируемыми API replies. Все exit0/skip0; суммарно721, не полный
  production E2E. Client elapsed915.06s/import912.98s не performance evidence.
  Нового runtime дефекта не выявлено; приложения/дизайн/контракты не менялись.
  Собственный `daryadarcy-tz-audit-20261016` c3acd2a5…e149a23/52310 удалён
  после exact ID/name/label/loopback/tmpfs768MiB/no persistent mounts проверки;
  чужие containers2 сохранены. S3/working DB/SMTP outside loopback/provider
  payments/flags/push/deploy не трогались. Docs check58/exit0, diff check/exit0;
  review: доказательства разделены на native/component/исторические, новых
  функций/dependencies/runtime changes нет, весь этап не объявлен закрытым.
- [ ] Полная приёмка этапа — **не закрыта**. Новые закрытые файлы проверены
  ранее в FE/CF/VU; старые club Yandex URLs/встроенные assets не подключены к
  закрытому read API и требуют отдельного решения, не массового переноса. Далее
  внешние AG5/AG9: fresh target/release/backup/flags, mail/payment/VK, реальные
  даты/assets/contact, physical devices/target load/pilot. Это не новые функции.
- По прямому решению пользователя второй S3 principal **отложен/не проверен**;
  не запрашивать новую учётку как блокер. Ранние строки «не предоставлен» ниже
  сохраняют историю и не отменяют это уточнение. Mobile по-прежнему отложен.

### Проверенный остаток на 16 октября

- [x] AG9-VU5 — по новому прямому разрешению пользователя возобновить только
  локальную браузерную проверку видео. Оба existing редактора: потеря upload/
  create ответа и document reload с File/key/status-first/no duplicate; смена
  аккаунта во время upload/status и возврат исходного владельца; actual API/SQL/S3,
  live read/revoke/explicit removal. Own fresh41 loopback/tmpfs backend_test,
  новые synthetic video/poster, existing isolated Next/Chromium/fault proxy.
  Дизайн/working DB/старые S3/рабочие flags/push/deploy исключены; mobile отложен.
  Файлы среза: отдельный opt-in native browser test/existing proxy helper/tests;
  runtime только после подтверждённого RED.
  - **Завершено16 октября:** финальный единый native browser прогон **6/6 pass,
    0 skip/0 fail,99.09s**. Оба existing редактора→Chromium/File/native IndexedDB
    document reload→Next rewrite/fault proxy→Nest/JWT→own fresh41 tmpfs SQL→Timeweb
    S3. Lost upload/create ACK сохраняет original bytes/key/status-first, один
    post/create intent/receipt, без дополнительных PUT/public fallback. Late upload/
    status после account switch не меняет чужой editor/journal; возврат владельца
    восстанавливает исходный File/key. Проверены private video+poster GET/HEAD/
    Range206/no-store, playback, unpaid expiry404 до S3 и explicit UI removal:
    video и poster после удаления404, без новых PUT. SQL:6 posts/6 create intents/
    6 upload receipts/3 posters/4 media после двух удалений; pageErrors0.
  - `a7e46c2` подтверждён native GREEN после прежнего RED. Новых runtime/design
    изменений в этом продолжении нет. Test-only playback criterion исправлен после
    диагностики: single-frame MP4 duration1/currentTime1/ended=true/error=null
    мог завершиться до settling play() promise. Допускается только AbortError при
    доказанном полном воспроизведении из0; decode/network ошибки по-прежнему FAIL.
    Промежуточный matrix4pass/2fail103.23s и quick2pass/1fail51.55s не засчитаны
    как готовность. В первом был также transient pending S3 receipt; ready/200
    assertions и SDK timeouts не ослаблялись, в финале все6 raw uploads200/ready.
  - Проверки: full Vitest **2504 pass/1557 opt-in skips,exit0,67.90s** (счётчики
    как сообщает runner, skips не приёмка); proxy7/7/132ms. Root/frontend/E2E types,
    full frontend lint, prettier и681 boundaries exit0. Production webpack29/29,
    compile11.5s/types4.5s, clean env/API target127.0.0.1:1; frontend env files
    только .env.example. Five-axis review: helper faults only real completed HTTP
    responses, fresh/ownership/policy/ETag guards, no dependencies/roles/CSS/flags.
  - Все9 новых video/poster объектов финального прогона удалены после own metadata/
    hash/ETag guards, HEAD404; policy hash прежний0484dfa2…1715e8. Предыдущие новые
    тестовые keys также очищены (2/9/3), старые objects не читались/не менялись.
    Own resume0ad0d1fd…, matrixb0b66db7…, quickfc31e963…, finalaaa572fd… БД удалены
    только после exact ID/name/owner/loopback/tmpfs/no-volume recheck. Existing
    базы/образы/volumes/чужие контейнеры не затронуты. API/Next/browser/proxy закрыты,
    temp stand directories0; parent S3 client закрыт, credentials refs очищены.
  - По отдельному разрешению пользователя удалён только неиспользуемый Codex
    updater cache: Installation/ifrLW4633 и Installation/fyukwdqGB внутри
    /Users/edem/Library/Caches/com.openai.codex/org.sparkle-project.Sparkle.
    Before delete: explicit targets/realpath/uid501/private mode/dev+inode/age>
    48h/archive markers/no open files/no active updater. Logical3.85GiB reclaimed,
    free1.2→4.5GiB. Установленные приложения/чаты/настройки сохранены; кэш можно
    загрузить заново. Это не разрешение чистить прочие caches или проектные данные.
    Mobile/real devices/VK real links/working rollout по-прежнему отдельно.
  - Далее только внешние AG5/AG9 gates из handoff; новых программных задач нет.
    Нижние записи этого пункта — история до финального GREEN, не текущие blockers.
  - Native RED: full editor/lost upload ACK —1 fail/5 filtered skips,25.22s.
    Реальные Chromium/File/IndexedDB/Next/Nest/fresh41 SQL/Timeweb: receipt ready,
    исходные bytes/key в journal, post0, но кнопки «Проверить сохранение» нет.
    Причина — notice учитывал privateUploads/privatePhotos, но не privateVideos.
    Добавлена только existing recovery branch для видео, без CSS/layout/нового
    replay API. SSR regression RED1/2 guard pass→GREEN3/3; affected video/proxy/
    notice28/28; расширенный recovery/transport/selection/notice/proxy набор58/58,
    6 suites515ms. Root/frontend/E2E types/full frontend lint exit0 после fix.
    Final prettier5files/docs58/diff exit0. Five-axis review: UI использует тот же
    onRecover/status-first coordinator, unknown update по-прежнему без replay;
    нет новых запросов/ролей/CSS/dependencies/секретов в diff. Native matrix/helper
    сохранены как незавершённые рабочие изменения, не подтверждённая приёмка.
  - Native GREEN после исправления НЕ запускался: свободное место упало с2.5GiB
    до1.0GiB; удалён только own regenerable apps/frontend/.next/cache (~368MiB),
    осталось1.4GiB при минимуме2GiB. Docker build cache0B. Образы/volumes/чужие
    контейнеры не тронуты. Production build/full suite в этом срезе не повторены.
    Browser matrix пока WIP6 случаев, explicit editor removal ещё не добавлен;
    skips/SSR не считать сквозным GREEN или готовностью обоих редакторов.
  - Cleanup RED:1 own video object удалён после metadata/hash/ETag guards,
    HEAD404, policy прежняя, posts0/pageErrors0. Own RED DB f718703c… удалена после
    ID/name/owner/loopback/tmpfs/no-volume guards. Второй own fresh41 DB925a606a…
    был подготовлен, но disk gate остановил запуск до fixtures/API/S3 writes;
    users/uploads/content_files0, удалён после тех же guards. Временные Next/API/
    browser/proxy закрыты. Parent S3 client закрыт, credentials bindings очищены;
    секреты не сохранены. Остаток: >=2GiB free (лучше ещё2–3GiB запаса), новая
    own DB и native full lost ACK→оба редактора/account switch/read/revoke/removal.
  - Повтор16 октября по прямому разрешению очистить только наши temp/cache:
    освобождено ещё62.93MiB. Удалены own regenerable `apps/frontend/.next`
    (41.95MiB) и пять каталогов только generated JSON/log reports в `/private/tmp`:
    `daryadarcy-video-vu1.09vZkI`, `daryadarcy-frontend-verify-2Ylry8`,
    `daryadarcy-private-editors-X7ePea`, `daryadarcy-merge-check.fCpphO`,
    `daryadarcy-r6-export.WsYnXU`. Исторические paths этих raw reports ниже больше
    не доступны; проверенные сводки сохранены в плане. Сборка/отчёты создаются
    заново штатными командами, точные удалённые raw файлы не сохранены.
    До удаления: explicit target list, realpath/parent/uid501/no symlink/no
    group/world write/dev+inode recheck, Next BUILD_ID/no tracked/no open files,
    temp содержит только JSON/log. Исходники/текущий WIP native test сохранены.
    Итоговый disk gate:1.338GiB free <2GiB. Browser/API/SQL/S3 запусков и новых
    mutations0; GREEN не засчитан. Docker build cache0B; images6/volumes12/чужие
    containers3 сохранены. Наш headless1208 нужен для следующего прогона;1234/
    WebKit2336 связаны с другим проектом, не удалены. Больших подтверждённых наших
    кэшей больше нет. Нужен внешний вход: освободить ещё хотя бы1GiB, лучше2–3GiB
    запаса, или указать конкретные дополнительные разрешённые targets. Не снижать
    preflight; после места — новая own fresh41 DB и незавершённая browser matrix.

- [x] AG9 — актуализировать существующий пакет передачи после VU (`0e8da4b`),
  сверить активные статусы с принятыми FE/CF/VU результатами. Local integration
  больше не числится невыполненной; browser/mobile отложены. Для fresh-only пути
  не требовать историю старой БД; working rollout/provider/mail/целевой load/pilot,
  второй валидный S3 principal и решение по старым URL остаются внешними gates.
  Исторические результаты не повторялись и не пересчитаны в новую приёмку.
  Проверка: `pnpm check:docs` —58 документов/exit0; `git diff --check` —exit0.
  Review сверил итоговый diff с FE/CF/VU evidence; изменены только3 существующих
  документа. Runtime suites/build без изменения кода не повторялись. Runtime/
  design/DB/S3/push/deploy не меняются.
  Следующий AG-ID: AG5/AG9 только после соответствующего внешнего входа/решения;
  независимого незавершённого программного пункта при текущих ограничениях нет.

- [x] VU — принятый16 октября private raw video contract в SPEC-private-files.md;
  локальная реализация/API/SQL/S3, НЕ rollout или browser/device acceptance.
  - [x] VU1: additive video receipt migration,80MiB binary admin endpoint,
    actor-scoped status/recovery, signature/MIME/SDK wire RED/GREEN.
    RED16 endpoint404 → GREEN16; дополнительный metadata ambiguity RED1→GREEN21,
    включая session revocation во время streaming body. Affected **110/110**,
    5 suites8.57s: private video21 + прежние audio/document/raw/parser/migration
    regressions. Реальные Nest/JWT/SQL/AWS SDK и loopback wire, НЕ Timeweb ACL.
    Fresh40 migration/ORM/HTTP **9/9**,3.54s, отдельная пустая own tmpfs БД;
    старые0017–0019/history не изменялись. Full **2444 pass/1537 opt-in skips/0 fail**,
    JSON27.55s. Root/frontend/E2E types, backend583.9kb, API86/31732bytes,
    boundaries678/docs58/diff pass. Server path default-off через новый
    PRIVATE_POST_VIDEO_UPLOAD_ENABLED вместе с existing media upload flag;
    Content prefix policy read-only, same actor/key namespace/hash/ETag/no overwrite.
    Five-axis review: legacy upload и32MiB audio/doc unchanged, unknown storage
    outcome остаётся pending, safe errors/no secrets, no new dependencies.
    Клиент/poster/explicit removal ещё НЕ готовы; UI runtime не менялся.
  - [x] VU2: canonical association/live delivery/explicit removal и private poster;
    legacy videos[]/VK/старые URL сохраняются.
    - [x] VU2a: native RED5→GREEN26, затем legacy removal/no-storage regression
      RED500→GREEN400. Сохранение videos[] больше не удаляет canonical private
      video неявно; explicit removedMediaIds проверяет same-post ready receipt,
      не удаляет legacy video этим путём. Reserved app/S3 URL нельзя вставить как
      новое legacy video без asset receipt. Existing VK/old IDs/order сохраняются.
      Create replay даёт1 post/media; draft/club unpaid/expiry закрыты до S3;
      paid GET/HEAD/Range206 точные bytes/MIME/no-store; explicit removal закрывает
      read и late rebind409. Финальные affected **64/64**,7.29s, включая previous
      audio/document removal/retention; ранее reconciliation52/52 и affected89/89.
      Full2444 pass/1543 opt-in skips/0 fail,25.76s; root types и backend585.5kb/
      diff pass. Loopback wire, не actual S3/browser.
      Docker build-cache prune342.6MB; before/after image6/volume12/container4
      identities unchanged. Свободно2.5GiB; чужие образы/БД не удалялись.
    - [x] VU2b: явная связь с private postPhoto постером, live read/retirement.
      RED4 ignored mapping→GREEN4; video category RED1→GREEN, additional replace/
      exact retry/reject retired poster coverage —5/5. Nullable post_media.posterUrl
      и additive0040, optional privateVideoPosters[{videoAssetId,posterAssetId}].
      Gallery+poster reference set связывается/retire атомарно, без public upload,
      basename guessing или правки старых rows. Club guest denied до S3, staff
      HEAD200, public GET image/webp/no-store; unrelated edit сохраняетposter,
      removal закрываетread, replacement сохраняетgallery и не воскрешаетretired.
      Native affected **178 pass/7 opt-in skips/0 fail**,8 suites32.03s; actual
      HTTP/JWT/SQL/SDK/loopback object wire, НЕ provider/browser acceptance.
      Full2444 pass/1548 opt-in skips/0 fail,36.90s. Initial7 full failures были
      positional SQL fixture без нового nullable поля; добавлен literal NULL,
      runtime не ослаблен. Root/frontend/E2E types, API86/32048bytes, backend588.6kb,
      boundaries678/docs58/diff pass. Five-axis review: actor/post/asset locks,
      same create hash includes mapping, privatePhoto usage/owner проверяется
      внутри save tx, no role/CSS/quota/working flag changes/dependencies.
      Fresh41/ORM/native HTTP **9/9** на отдельной пустой own tmpfs DB.
      Own fixture1b55c09e… и fresha3c342a9… удалены после exact ownership/loopback/
      tmpfs/no-volume guards; SDK wire objects были только в памяти fixture.
      Actual S3/working DB/старые файлы не затрагивались. Далее VU3.
  - [x] VU3: durable File/key до network, status-first recovery и оба existing
    редактора без изменения дизайна; unit/type/build проверки.
    - [x] VU3a: typed video receipt/80MiB policy и existing save coordinator:
      private raw transport boundary, original File/key checkpoint before dispatch,
      status-first ready/pending/notRecorded, no public fallback/local URL write,
      private poster mapping и frozen create/existing unknown-update guards.
      RED13 meaningful failures (1 existing storage guard already passed)→GREEN14;
      additional poster/create ACK/update/removal coverage —18 video cases,
      affected **72/72** with existing attachments/photos. Late upload/status
      responses after actor change ignored, pending/invalid receipt blocks publish.
      Full **2462 pass/1548 opt-in skips/0 fail**,72.80s(maxWorkers2); root/frontend/
      E2E types/full lint pass. Production webpack29/29, compile9.6s/types3.0s,
      clean env/API target127.0.0.1:1/no frontend .env* inputs except example.
      API/checkpoint synthetic, File bytes настоящие Node; это НЕ IndexedDB/reload/
      UI/API/S3 acceptance. Runtime редакторов ещё legacy video; флаги не включены.
      Docker build cache fully pruned:342.6MB+2.721GB logical, builder du0B;
      images6/volumes12/foreign containers3 preserved. Host free3.6GiB then3.2GiB.
    - [x] VU3b: pack/restore video+poster ArrayBuffer в existing owner journal,
      alias/revision/validation guards; browser/mobile остаются отложенными.
      RED4 missing video codec →3 GREEN/1 corrupt receipt RED→4 GREEN;
      stale editor/upload alias RED1→GREEN7 total. Exact bytes/name/type/mtime/
      keys и editor/coordinator aliases restored, old records without video read,
      corrupt receipt/owner switch before/after I/O/stale revision refused.
      Journal write validates video ownership/aliases before bytes/network, not
      only on later load. Same version2 optional fields, no new DB/store/migration.
      Real Node File/ArrayBuffer/structuredClone and transaction transport double
      refusing Blob/File; НЕ native IndexedDB transaction scheduling/reload.
      Affected35/35; full **2469 pass/1548 opt-in skips/0 fail**,41.30s.
      Root/frontend/E2E types/full lint pass; isolated production29/29,
      compile5.0s/types3.9s. User-deferred browser/mobile НЕ запускались.
    - [x] VU3c: private binary HTTP transport + оба existing editors, без CSS/layout.
      Raw File/key/credentials/no-store, no public URL/retry; transport RED8→GREEN12.
      Original File и optional private poster выбираются локально; full сохраняет
      прежний автопостер/preview, quick прежний выбор без автопостера. Selection
      RED7→GREEN8 (1 existing invalid-source rejection already passed), включая
      late poster success/error после account switch. UI snapshot/restore/save
      используют VU3b до dispatch; account-keyed editor bodies сбрасывают весь
      File/coordinator state при смене actor. Canonical video removal добавляет
      explicit removedMediaIds; legacy/VK reconciliation unchanged. Preview URLs
      отзываются при remove/close/unmount; File aliases остаются до следующего save
      selection, чтобы idle recovered journal не терял attempted intent (8 storage
      checks total). Affected **161/161**, full **2490 pass/1548 opt-in skips/0 fail**,
      JSON49.50s. Root/frontend/E2E types/full lint/API86/32048bytes/boundaries681
      pass; clean-env production29/29, compile3.9s/types4.6s. Five-axis review:
      bytes only via accepted private endpoint, no public fallback or secret files,
      shared coordinator/journal reused, optional poster failure retains original,
      no new dependencies/styles/layout/working flags. File/fetch/codec/storage
      boundaries synthetic, НЕ native UI/IndexedDB/S3 acceptance; browser/mobile
      по-прежнему отложены. VU3d и VU4 ещё не закрыты.
    - [x] VU3d: existing media consumers берут explicit poster, не крадут gallery.
      RED6→GREEN9 pure/actual React SSR checks: canonical private video с optional
      poster сохраняет весь photos[], без poster не заимствует первую фотографию;
      legacy thumb/fallback прежние. Feed card/club/detail/shared player получают
      nullable posterUrl, каждый player использует свой poster, не соседний.
      CSS/layout/components прежние. Full **2499 pass/1548 opt-in skips/0 fail**,
      JSON47.30s; types/root+frontend+E2E/full lint/boundaries681/diff pass,
      isolated production29/29, compile5.5s/types2.1s. SSR не доказывает browser
      playback/codec/hydration; browser/mobile отложены. Five-axis review: только
      metadata selection, no access/storage/URL migration or new dependencies.
  - [x] VU4: own disposable API/SQL/S3 acceptance; browser/mobile отложены.
    **3/3 native pass**,35.77s (tests34.86s): actual frontend binary transport/
    save coordinator → native HTTP/JWT → own fresh41 SQL → Timeweb S3.
    Upload ACK потерян после реального200, API перезапущен; status-first берёт
    прежний video asset без repeat PUT, optional poster получает1 PUT. Lost post
    ACK → второй API restart → frozen create replay оставляет1 post/1 creation
    intent/1 video link, sum2 PUT. Original bytes/MIME/HEAD length/Range206 и
    private,no-store для video/WebP poster; anonymous direct S3 GET/HEAD403.
    Draft/guest/expired paid/blocked/revoked session закрывают video+poster до S3;
    explicit removal убирает link, retire poster, read404 и late rebind409.
    Actual delayed upload/status responses после A→B не принимаются coordinator,
    B statusnotRecorded, A ready; посты/привязки не появляются. Fetch обёрнут
    только для loopback session cookie/задержки уже настоящего ответа; public
    upload запрещён. FileReader заменён реальным File.arrayBuffer, journal
    transaction double — это НЕ browser reload/IndexedDB scheduling/playback.
    Read-only preflight подтвердил прежний policy SHA2560484dfa2…1715e8,
    unversioned bucket. Первичная curl проба timeout5s/HTTP000, последующая clean
    IPv4 HTTPS200 и signed preflight прошли; TLS/preflight не обходились.
    Final SQL:41 migrations/1 post/1 create intent/3 ready videos/1 ready poster,
    retired poster1, media after explicit removal0, duplicate assets0.
    Все4 own synthetic objects удалены с filename/UUID/metadata/hash/size/MIME/
    ETag guards и HEAD404; policy unchanged. Own DB f52cb431dd32…ec605,
    daryadarcy-fresh-video-api-20261016-vu4, loopback61534/tmpfs768MiB/no mounts
    удалена только после S3 cleanup и повторных exact ID/name/owner/port/mount
    guards. API children/temp compiled dirs убраны; foreign containers preserved.
    Credentials только в памяти isolated runner/children, не файлы/Git/CLI args.
    Final clean-env full **2499 pass/1551 opt-in skips/0 fail**, JSON45.53s;
    новые3 provider cases пропущены в обычном full и отдельно реально пройдены
    выше, skip не засчитан как acceptance. Root tsc/API86/boundaries681/docs58/
    Prettier/diff pass. Frontend types/lint/production29/29 из VU3d остаются
    актуальны: runtime после них не менялся. Five-axis review: default-off в
    existing isolated process helper, explicit fresh/container/policy/versioning
    gates before mutations, own ledger cleanup only, no new dependencies/schema.
    Рабочая DB/старые S3/дизайн/policy writes/рабочие flags/push/deploy исключены.
  Docker16 октября перезапущен по прямому разрешению, _ping=OK, free3.5GiB.
  Чужие контейнеры сохранены (diplom-postgres остановлен перезапуском), вручную
  не запускались. Образы/volumes не удалялись; зависший старый cache prune
  не был выполнен, удаление кэша этим перезапуском не утверждается.

- [x] LF1 — по прямому поручению16 октября: вернуть в existing Библиотеку карточки
  опубликованных club-статей. Public list содержит только id/title/coverUrl/access,
  без sections/вложений/черновиков; article detail/live access не менять. Сначала
  RED native HTTP/SQL, затем минимальное исправление и affected/full проверки.
  RED7/7: guest/paid/unpaid/moderator/admin/blocked/revoked видели только public
  карточку. Удалён только access=public filter, explicit four-field projection
  сохранён; frontend уже отображает club badge/CTA и проверяет hasClubAccess.
  Native **94/94 pass**,2 suites,4.14s: public+club cards без sections/лишних полей,
  published-only и repository order, прежние locked detail/paid expiry/blocked/
  revoked/staff правила, article CRUD/teaser regressions. Own backend_test на
  loopback51831/tmpfs/no volumes; existing fixture DDL, НЕ fresh migration/rollout
  acceptance. Own articles после cleanup0; exact DBaddf9c12… удалена после повторных
  ID/name/owner/loopback/tmpfs/mount guards, чужие контейнеры сохранены.
  Full **2444 pass/1516 opt-in skips/0 fail**, JSON report76.47s, exit0; root/
  frontend/E2E types, backend build578.5kb/API86/31712bytes/boundaries676/Prettier/
  diff pass. Generated contract не менялся. Existing native browser expectation
  актуализирован: club card+lock CTA visible, draft/body guards retained; browser
  НЕ запускался по поручению. Five-axis review: роли/body policy/schema/CSS/старые
  файлы/S3/working flags не менялись, новых endpoint/зависимостей нет. Frontend
  source прежний, его production build/lint без причины не повторялись.
  Дизайн/working DB/старые файлы/S3/push/deploy исключены; browser/device отложены.

- [x] CF-F3: внутренняя интеграция закрытых фото комментариев в existing форму,
  продолжение accepted CF4/CF client remainder. Новые файлы только private API,
  postId и actor-scoped keys неизменны, прежние two-photo/48h/access limits.
  - [x] CF-F3a: typed comment upload/status и coordinator с checkpoint до network,
    frozen addComment payload/key, lost upload/write ACK replay без дублей;
    ownership/receipt/storage failure guards, RED/GREEN unit.10 meaningful RED
    failures→11 GREEN, затем additional acceptance до15/15. Общий CF transport
    расширен только typed commentPhoto adapter, post/article endpoints прежние.
    Frozen post/reply/text/photos/key, status-first upload recovery, pending без
    публикации, same-key exact replay after lost add ACK, late upload/status/add
    reply не принимается после cancel/account change. Отказ checkpoint блокирует
    upload/write, включая повтор после неудачной локальной freeze-записи;
    повторный asset/неверный usage/storage URL отвергаются, two-photo order intact.
    FileReader boundary заменён actual File.arrayBuffer в Node fixture; API и
    checkpoint synthetic. Это НЕ durable/browser/SQL/S3 приёмка и ещё НЕ UI wiring.
    Affected55 pass до дополнительных4 кейсов; fresh full **2441 pass/1497 opt-in
    skips**,190 suites,39.72s. Root/frontend/E2E types, full frontend lint,
    production webpack29/29 (compile7.3s), API86/boundaries674 проходят.
    Build clean env/target127.0.0.1:1; отсутствие frontend .env* проверено по
    метаданным до запуска, credentials не читались/не наследовались. Review:
    existing server contract unchanged, bounded2 photos, no public fallback,
    legacy ClubComments/UI и backend/DB/S3/flags untouched. Далее CF-F3b.
  - [x] CF-F3b: durable owner/post-scoped File bytes/keys и revision CAS,
    reload/native IndexedDB проверки; без нового server API/schema.
    Native Chromium File/IndexedDB RED4→GREEN4 + concurrent-claim acceptance:
    **5/5 pass**,850ms; вместе с coordinator15 —20 pass/1.29s. Настоящий document
    reload сохраняет bytes/name/type/lastModified/file+create keys/post/reply/text.
    Atomic revision CAS отклоняет stale checkpoint/clear, simultaneous prepares
    возвращают одну исходную операцию. Подмена bytes при прежних name/size/mtime,
    thaw write→upload, смена actor/post и receipt regression запрещены. Записи
    ArrayBuffer, без tokens/S3 keys; owner guards before/after awaits/transactions.
    HTTP document fixture и API synthetic; НЕ UI/API/SQL/S3 приёмка. Root/frontend/
    E2E types pass; full lint/boundaries675/diff pass. App build/full2441 из CF-F3a
    не повторять: новый journal ещё не импортируется приложением; native fixture
    реально bundlит и выполняет его. Далее CF-F3c, форма пока legacy public path.
  - [x] CF-F3c: подключить existing форму без CSS/layout изменений: local blob,
    remove/revoke/session/unmount, explicit recovery/replay; legacy text-only и
    edit/delete/like не переделывать. Browser lost ACK/reload/account switch.
    Local selection без public upload, explicit restore/replay/discard с прежним
    payload/key; canonical read под task/owner guard до clear. Keyed thread на
    actor/post изолирует всю compose/session state; уход скрывает/revokes blobs,
    возврат использует локальные bytes. Storage error fail-closed, никаких public
    fallbacks. RED missing blob1→GREEN; final **5/5 Chromium/Next pass**,17.29s:
    lost upload+write ACK/reload, account switch during upload/status/canonical
    read, remove/revoke/no removed-file upload. API synthetic; File/IndexedDB/
    session/browser настоящие. Initial3/4 pass: единственный test expectation
    ошибочно ожидал отсутствия undefined полей, fixture JSON даёт null; исправлен
    только expectation, legacy text-only wire не менялся. Existing comments/
    moderation spec **21/21 pass**,36.1s; прежние два public-upload expectations
    обновлены на deferred private flow/frozen discard без частичной публикации.
    Full **2441 pass/1507 opt-in skips**,0 fail; JSON unit report26.60s.
    Root/frontend/E2E types/full lint pass; production isolated build compile11.9s,
    TypeScript4.9s/static29/29 exit0, no .env/working credentials, target127.0.0.1:1.
    React/security review: no CSS/assets/role/quota changes, existing text/edit/
    like/delete server paths preserved, late read cannot clear another owner.
    Disk снова1.8GiB: только own generated .next/cache360MiB удалён после
    realpath/uid/no-symlink/BUILD_ID guards; regenerated on build, остальные
    output/source/images/containers/volumes сохранены. Free2.1GiB. Далее CF-F3d.
  - [x] CF-F3d: scoped native API/SQL/S3 acceptance — **3/3 pass**,10 намеренно
    filtered post/article skips,50.89s, exit0. Actual Chromium→Next→Nest→own
    fresh39 MySQL→Timeweb S3: lost upload+addComment ACK/reload/exact replay,
    account switch during upload/status, owner-only journal/receipt restoration.
    В каждом сценарии ровно1 photo PUT/asset/comment/create intent; непривязанное фото
    до binding недоступно, paid member получает GET/HEAD/Range206/no-store,
    paid expiry закрывает следующий GET/HEAD/Range до S3. Public upload calls0.
    Первый запуск3 fail до upload из-за admin-only test fault allowlist;
    добавлены только3 explicit club routes, loopback transport RED3→GREEN5.
    Второй запуск3 fail: S3 upload10s timeout, SQL3 pending/comments0, no false
    success. Cleanup также timeout: own DB397fcb6a… временно сохранена как ledger.
    После HTTPS/TLS восстановления все3 exact keys HEAD404 (объекты отсутствовали),
    policy unchanged; exact own DB удалена после повторных ownership guards.
    Финальный успешный прогон на новой own DB6603b54f…/loopback63232/tmpfs/no
    volumes. Все3 новых S3 objects удалены после actor/prefix/asset/hash/MIME/size/
    ETag guards и HEAD404; policy hash0484dfa2… прежний, versioning off. Own DB,
    API/Next/browser/proxy закрыты, чужие контейнеры сохранены. Secrets только
    no-echo stdin/process memory, без файлов/логов/Git. Root tsc и full Vitest
    **2444 pass/1510 opt-in skips/0 fail**, JSON report67.79s. Runtime не менялся
    после CF-F3c: его frontend/E2E types/lint/production29/29 не повторялись.
    Five-axis review: test-only explicit faults и real upstream replies, SQL/S3
    ownership guards не ослаблены, no mocks-as-native. Boundaries676/docs58/
    focused Prettier/diff exit0. Без rollout/device claims.
    Далее CF-F1b4/AG9: устройства и отдельно разрешённый release/working flags,
    второй валидный S3 principal; новых независимых runtime задач не выявлено.

- [x] CF-F2 (16 октября, прямое поручение): закрытые фото/PNG/карусели и
  PDF/DOCX/TXT в существующем редакторе статей. Баннер публичный, старые URL
  сохраняются. Срезы: typed upload/status + block references; durable file bytes
  и stable keys до S3 с existing article journal; wiring existing editor и blob
  preview; lost ACK/reload/retry/account switch проверки. Unknown update не
  повторять автоматически; frozen create key/payload сохранять. Дизайн/CSS,
  working DB/старые S3/flags/push/deploy исключены. Проверки RED/GREEN + browser,
  types/lint/build/boundaries/docs; native provider acceptance отмечать отдельно.
  - [x] CF-F2a: общий existing CF upload/status transport для post/article,
    typed articlePhoto/articleDocument, строгий receipt и local-content binding.
    RED5→GREEN10 unit; вместе с existing post34/article19 —63 pass. Фото допускают
    server re-encode size, документы требуют exact bytes length/normalized MIME.
    Ready не загружается повторно, pending/notRecorded сохраняют прежний key,
    checkpoint до network, late receipt/corrupt usage/URL запрещены. Root/frontend
    types и focused ESLint проходят. Пока это не editor/API/S3 acceptance.
  - [x] CF-F2b: existing article journal хранит File как ArrayBuffer/metadata,
    стабильные file/create keys и phase/revision. Read/write owner guard и atomic
    revision CAS между вкладками, freeze resolved URLs перед article write; legacy
    v1 записи сохранены. Native Chromium/IndexedDB RED2→GREEN3, legacy parsing19
    pass; API/SQL/S3 этим storage fixture не проверяются.
  - [x] CF-F2c: existing editor wired to CF upload/status for photo/PNG/carousel
    and link-block PDF/DOCX/TXT chooser. Public cover path unchanged; no CSS,
    visual assets or layout changes. Local blob preview until binding, stable
    file intent before network, frozen create replay and unknown update guard
    survive reload. Account-switch receipts ignored; original owner restores.
    Native Chromium/Next + real File/IndexedDB but synthetic API: **5/5 pass**,
    suite26.19s. Includes removed block blob lifecycle RED1→GREEN and no removed
    file upload; create/edit/reload/lost ACK/live upload+status account switch.
    Updated existing transparent article PNG e2e expectation to deferred CF
    upload; subsequent legacy17/17 pass recorded in CF-F2d below.
  - [x] CF-F2d: actual editor→Nest→fresh39 SQL→Timeweb S3 acceptance and final
    regression/build. Added two opt-in `article:` cases to existing private-photo
    editor native suite; **no native article success claimed**. Attempts:
    first stopped waiting for remaining uploads (5s assertion), cleaned3 own
    objects/HEAD404; second ERR_NETWORK_IO_SUSPENDED before writes/objects0;
    third SDK requestTimeout10s during upload+cleanup, own DB retained, then exact
    guarded cleanup deleted2/third pending object HEAD404, policy hash unchanged,
    DB2f09c366…/60423 removed. Last attempt actual wall time~990.99s exceeded
    180s test timeout during sleep; no file intents/articles. API/Next/browser
    closed; own DB89e065ea…/62122 removed after repeated metadata guards+SQL0.
    All owned containers removed; foreign4 preserved. Old S3/working DB/flags
    untouched, no policy writes. No credentials saved (only no-echo stdin/memory).
    **Historical environment checkpoint16 October:** user connected charger; pmset AC/34%,
    charging, previous sleep blocker cleared. New native attempt stopped at disk
    preflight (<1GiB free vs required2GiB), BEFORE API/S3 writes; own fresh39 DB
    a530f4dd…/55006 had files0/articles0 and was removed after exact identity,
    owner/loopback/tmpfs/no-mount guards. Foreign containers preserved. Do not
    lower preflight or raise timeouts. Own known .next cache315MiB is insufficient
    to reach2GiB; no foreign files/cache deleted. User asked to free2–3GiB.
    Fresh full Vitest: **2426 pass/1497 opt-in skipped**,189 passed suites,
    42.93s (maxWorkers4). Root/frontend/e2e types, full frontend lint, API86/
    31712bytes and boundaries673 pass. At that checkpoint build/native/browser
    regressions were still OPEN; resolved by the verified continuation below.
    **Verified continuation16 October:** user authorized Docker build-cache-only
    cleanup. `docker builder prune --force` reclaimed5.495GB; images9/6.816GB,
    existing containers3 and volumes12/1.636GB unchanged. Host free space4.1GiB
    immediately, then5.8GiB; no image/volume/system prune. The earlier authorized
    removal of stopped own tmpfs owner39fdda943241 is separate (see F5).
    Actual Chromium→Next rewrite→Nest→fresh39 MySQL→Timeweb S3: **2 native pass/
    8 filtered post skips**, suite67.44s/command68.47s. Mixed photo/PNG/carousel/TXT
    lost upload/create ACK+reload: no repeat PUT/asset/article, one creation intent
    and teaser. Edit adds one photo, retains four bindings, lost update/reload
    never repeats write; explicit local discard after canonical list read.
    Actual WebP alpha/TXT bytes, GET/HEAD/Range206/no-store, expired access404
    before S3 and anonymous direct S3 HEAD403 verified. These2 cases do NOT add
    native article account-switch/PDF/DOCX/device evidence: session races are
    covered by the earlier5 synthetic-API browser cases, not mislabelled native.
    All5 new own objects deleted with exact ledger/metadata/ETag guards+HEAD404;
    policy0484dfa2… unchanged/versioning off. Own DB22c144b0…/62677/tmpfs/no mounts
    removed after repeated exact owner/storage guards. Existing3 containers,
    working DB/flags/policy/old S3 files preserved. Credentials stdin/memory only.
    Existing article-creation-recovery/media-upload specs: **17/17 pass**,29.8s,
    actual Next/File/IndexedDB with synthetic API and external-deny proxy.
    Temporary launcher first failed CJS/ESM import BEFORE tests; corrected only
    launcher import, no product workaround. Post-photo shared transport regression:
    **12/12 pass**,43.36s (synthetic API, real Next/File/IndexedDB).
    Production webpack build in own copy: compile7.8s, TypeScript2.6s, static29/29,
    exit0. No .env/working credentials; API target127.0.0.1:1. Own build/browser/
    API/proxy temp resources removed. No production source changes were required
    in this continuation; full2426/types/lint/API/boundaries above stay applicable.
    Local CF-F2 integration complete, NOT rollout/physical-device acceptance.
    Design/working DB/old files unchanged; no push/deploy or working flag enable.

- [ ] CF-F1 (16 октября): новые закрытые фото постов без изменения дизайна.
  - [x] CF-F1a: typed receipt/upload/status в общем save coordinator. File +
    стабильный key включаются в checkpoint до отправки; отсутствие checkpoint
    запрещает запись. После lost ACK — explicit status-first recovery; create
    replay использует frozen payload/key. Старые URL/порядок фото сохраняются,
    удалённое восстановленное фото не возвращается. Pending/невалидный receipt
    не допускают публикацию; no public fallback; late upload/status receipt
    после потери operation ownership не принимается. Серверный WebP size НЕ
    сравнивается с исходным File.size (CF выполняет re-encode).
    RED19/20 до реализации, затем guards RED2→GREEN и recovery checkpoint
    RED1→GREEN; итог **34/34 unit pass**. Это mock API/checkpoint + structuredClone, НЕ native
    IndexedDB/browser/API/SQL/S3 приёмка. TSX/оформление редакторов не менялись.
    Affected regression146/6 suites pass (0.25s), root/frontend/e2e tsc,
    targeted ESLint, boundaries668/API86/docs58/diff — exit0.
    Общий Vitest:2414 pass/1 fail/1463 skipped,39.28s; единственный fail —
    ENOSPC при mkdtemp в file-signature.test.ts, не дефект CF. Его отдельный
    повтор8/8 pass,0.72s. Ни skipped, ни отдельный повтор не считать единым
    зелёным прогоном. Секреты/DB/S3 не читались.
  - [x] CF-F1b: durable IndexedDB File/alias validation и локальные превью в
    обоих существующих редакторах, затем browser→API acceptance. Storage/UI и
    настоящий browser→API/S3 закрыты срезами ниже; rollout/device не заявлены.
    Ранее место при проверках упало с1.5GiB до~187MiB; Next build/native стенд не
    запускались (минимум2GiB). Доступных больших кэшей этой задачи не найдено:
    .next/cache отсутствует, node_modules/.vite24KiB; старые reports сохранены.
    Тот disk blocker снят16 октября (7.4GiB при старте). Рабочие flags/DB/S3,
    старые файлы и оформление не менять; no push/deploy.
    - [x] CF-F1b1: File bytes/metadata упакованы в ArrayBuffer, identity alias
      между editor и save snapshot сохраняется при записи/чтении. Восстановление
      проверяет ключи, MIME/size, локальные references, receipt и принадлежность
      одной и той же File-записи upload intent. Native Chromium File/IndexedDB:
      RED2→GREEN,4/4 pass; reload bytes/name/type/lastModified, подмена receipt,
      смена аккаунта read/write и same-key подмена File. HTTP document fixture
      синтетический; API/SQL/S3 не вызывались, не считать сквозной приёмкой.
      Affected48 pass, root tsc exit0. Место восстановилось до7.4GiB без нашей
      очистки; прежний disk blocker больше не мешает следующему срезу.
    - [x] CF-F1b2: оба существующих редактора используют подготовленный File и
      local-photo key; новые фото не отправляются публично при выборе. Сохранение
      использует CF upload/status и общую атомарную запись поста. Blob preview
      принадлежит editor/account scope; revoke при удалении/замене/закрытии и
      уходе/смене аккаунта. До binding закрытый GET не вызывается, старые URL
      сохраняются; PhotoEditor/preview получают blob URL, не local-photo marker.
      RED missing preview→GREEN; remove URL RED2→GREEN. Actual Chromium/Next UI
      и File/IndexedDB + synthetic API: **12/12 pass**,46.84s. Create/edit обоих
      редакторов, lost upload/create response+reload, ready без второго upload,
      notRecorded с прежними bytes/key, frozen create replay, unsent draft reload,
      live account switch during upload/status, close/remove/revoke, WebP alpha.
      Реальные API/SQL/S3 в этих12 тестах НЕ использовались.
      Existing3 browser specs:19 pass/1 selector failure,55.2s. Два сохранённых
      экрана VK давали duplicate text locator; добавлен visible filter без
      изменения runtime доступа, этот тест отдельно1/1 pass,3.0s. Не выдавать
      19+1 за новый единый20/20 прогон. Внешняя сеть для этих проверок закрыта
      own deny proxy; legacy URL/старые S3 не читались. Own Next/browser/proxy
      завершены, временных Next directories0; служебные config/last-run metadata
      остались в /private/tmp/daryadarcy-cf-legacy.p3S8CY/ (8KiB, без реальных
      данных/секретов; старый failure trace очищен Playwright при повторе).
      Full Vitest:2416 pass/1479 opt-in skips (37.38s, maxWorkers4); skips не pass.
      Root tsc/frontend+e2e types/full lint/production build/API86/boundaries669
      проходят. Build без .env/рабочих credentials, target127.0.0.1:1. Стилей,
      visual assets/раскладки/backend/DB/S3/рабочих flags не меняли; no push/deploy.
    - [x] CF-F1b3: сквозная проверка новых фото обоих редакторов с actual
      API/SQL+S3 на собственном одноразовом backend_test и только новых synthetic
      objects.16 октября: **8/8 native pass**, suite87.07s, actual Chromium→Next
      rewrite→Nest→fresh39 MySQL→Timeweb S3. По4 сценария full/quick: lost upload
      и create ACK+document reload; edit/lost update без auto replay; live account
      switch during upload/status. SQL один asset/intent/post, no repeat PUT,
      parent binding; full append/quick replace сохраняют точный набор своих фото.
      Unbound preview только blob (без private GET), revoke blob при account switch,
      чужой status=notRecorded; исходный владелец восстанавливает прежний файл.
      Реальные WebP bytes/alpha/EXIF stripping, HEAD/single Range206/no-store/nosniff;
      unbound/expired/guest GET/HEAD/Range404 до S3, anonymous S3 HEAD403.
      Итог own SQL:6 posts/6 creation intents/8 receipts. Все8 новых objects удалены
      с ledger/metadata/ETag guards и HEAD404; policy0484dfa2… unchanged/versioning off.
      Own container1aa52335…/63081/tmpfs/no mounts удалён после повторной проверки
      exact ID/name/owner/port/storage; API/Next/browser/proxy закрыты, temp dirs0.
      Чужие4 containers не трогались (diplom уже был Up, остальные Exited).
      Продуктовых дефектов в этих8 сценариях не выявлено, runtime/дизайн менять
      не потребовалось. Добавлен tests/private-photo-editors.s3.mysql.test.ts;
      acceptance existing working path, без искусственного RED. Secrets только
      no-echo stdin/process memory; no secret files/Git/logs. Working DB/flags,
      старые S3/policy/ACL не менялись; no push/deploy.
      Root tsc, focused Prettier, API86/31712bytes, boundaries669/docs58/diff
      проходят; five-axis self-review выполнен. Full Vitest/frontend build не
      повторялись: runtime/схема/контракт/пакеты не менялись с прошлого GREEN.
    - [ ] CF-F1b4: отдельная browser/device matrix и разрешённый rollout. CF
      целиком не объявлять принятым: local post/article/comment client integration
      и native acceptance закрыты (CF-F1b3/CF-F2d/CF-F3d), физические устройства,
      второй S3 principal и рабочее включение не приняты; старые files не менять.

- [x] FE5: после переключения сети пользователем S3 HEAD200/TLS handshake~1.4сек,
  policy hash0484dfa2… и versioning off прошли штатный preflight. Настоящие
  Chromium→Next rewrite→Nest→fresh39 MySQL→Timeweb S3: **quick4/4 pass**,60.76s,
  `-t 'quick:'`; full4 в этом прогоне skipped намеренно, НЕ засчитаны заново.
  Вместе с ранее подтверждёнными full4/4 — **все8 разных сценариев FE5** за два
  прогона. Оставшиеся quick edit и switch-during-upload/status закрыты:
  существующие synthetic связи сохранены, lost ACK/reload/status-first replay
  не создаёт дублей, unknown update не повторяется; другой аккаунт не получает
  чужой intent/черновик/late receipt, исходный владелец восстанавливает прежний
  файл. Actual GET bytes/HEAD/single Range206, paid access expiry/guest404 до
  S3 вызова и anonymous S3 HEAD403 также прошли в quick create setup.
  SQL итог:3 posts/5 media/3 creation intents/5 ready uploads, duplicate links0.
  Все5 новых объектов этого прогона удалены с metadata/ETag guards и HEAD404;
  policy hash unchanged. Own container99ceca6c…/59348/tmpfs/no mounts удалён
  после повторной проверки exact ID/name/label/port/storage; API/Next/browser
  закрыты, временных editor directories0, чужие4 containers сохранены.
  Runtime frontend/backend/дизайн/старые S3/рабочая DB/flags не менялись;
  исправлений продукта для прохождения не потребовалось. Рабочий rollout,
  production build/device/browser matrix этим dev-Chromium прогоном не заявлены.
  Секреты только stdin/memory, без secret files/Git/logs; no push/deploy.

- FE5, после явного разрешения перезапустить Docker: штатный restart отказал
  по deadline; проверенные Docker UI/backend получили SIGTERM, после выхода
  дочерних процессов оставшийся stale supervisor5461 завершён, приложение
  запущено заново. Unix `_ping=OK`, own MySQL health и fresh39/pending0 подтверждены.
  Ничего не удалялось из Docker images/volumes/чужих containers. Три ранее
  работавших контейнера после restart остались Exited255 (owner/geotermo/diplom),
  вручную не запускались; прежний fintablo Exited128 также сохранён.
  Новый own container5038558c…/62543/tmpfs/no mounts использован только для
  fresh initialization: users/posts/uploads0. `-t 'quick:'` остановился в beforeAll
  на S3 GetBucketPolicy/requestTimeout10s, до запуска API/Next/browser и mutations.
  Read-only диагностика: DNS217.78.234.145, TCP443 connect~3ms, TLS ClientHello
  без ServerHello/HTTP; curl default/HTTP1.1/TLS1.2 — SSL timeout, HTTP000.
  Проверка сертификата не отключалась; timeweb.cloud/example.com HEAD200.
  Это сетевой блокер ДО авторизации, не доказательство неверных ключей или
  дефекта редактора. S3 objects/policy writes0, новый pass не засчитан; остаток3
  quick сценария. Нужен доступ к s3.twcstorage.ru через другую сеть/VPN; вопрос
  отправлен пользователю, ключи повторно не запрашивались. Own container удалён
  после повторной сверки exact ID/name/label/port/tmpfs/no mounts; чужие4 сохранены.
  Следующий запуск — новая own fresh39 БД и четыре quick теста (create как setup).

- FE5, продолжение по разрешению очистки: удалены только регенерируемые артефакты
  проекта: `apps/frontend/.next/cache` (455MiB), `next-cache` (581MiB) из own
  `/private/tmp/daryadarcy-frontend-cache-20261014.1Z8BCc`, установленные нами
  неактивные Playwright `chromium-1208` (330MiB) и `webkit-2248` (276MiB).
  Realpath/no-symlink/uid/generated markers проверены; browser registry содержит
  только текущий repo, lsof подтвердил отсутствие открытых файлов этих браузеров.
  Headless Chromium1208, общий старый ffmpeg1011, исходники, отчёты/скриншоты,
  чужие temp/cache/containers/volumes сохранены. Кэши восстанавливаются штатной
  сборкой/скачиванием, рабочие данные не удалялись. Free636MiB→2.2GiB.
  Предыдущий блокер ДО теста: Docker Desktop открыт, `desktop start --timeout20`
  подтверждает already running, но engine info/ps и unix-socket `_ping` (5s)
  не отвечают; Desktop status/UI также timeout. Тогда перезапуск не выполнялся
  без разрешения, т.к. затронет другие проекты; теперь разрешён и выполнен выше.
  Новые DB/API/S3 writes не запускались, результат по-прежнему5/8, остаток3 quick
  сценария не засчитан. После восстановления engine — новая own fresh39 БД и
  `-t 'quick:'` (create нужен как setup для edit), без повтора уже пройденных full4.

- FE5, предыдущий неполный checkpoint (закрыт итогом выше): разрешена проверка
  обоих редакторов с настоящими API/Timeweb
  S3 и own одноразовой БД. Preflight policy hash0484dfa2… совпал, versioning off,
  read-only; credentials только stdin/memory. Own loopback58158/tmpfs MySQL,
  fresh39 без pending, старые DB/objects/flags не тронуты. Новый opt-in
  `tests/private-editors.s3.mysql.test.ts`: настоящий Chromium→Next rewrite→Nest→
  MySQL/S3; только HTTP ACK теряется/задерживается после upstream commit.
  Transport helper RED→GREEN2, commit278b975. Native подтверждены **5/8**:
  full4/4 (create/upload ACK loss+reload, edit+existing synthetic links, live account switch
  during upload/status), quick create/upload ACK loss+reload1/4. SQL: один пост,
  одна запись intent, одна связь/file, без повторных PUT; GET bytes/HEAD/single
  Range206, direct S3 anonymous403, expired paid access/guest404 до S3 вызова.
  Unknown update не повторяется автоматически; после SQL сверки удалён лишь
  локальный draft. В успешных частях создано и точно удалено9 own synthetic S3
  objects (2+7), metadata/ETag guards + HEAD404; policy hash не изменён.
  **Тогда не завершено:** quick edit+две account-switch проверки. Full-suite run
  5 pass/1 fail/bail,59.4s; quick edit прерван timeout холодной /club. Адресные
  cold /feed повторы до uploads также не прошли. Наблюдались Next HTTP500 и
  затем реальный ENOSPC при служебной проверке; свободно116MiB, после cleanup
  own Next273MiB. Не объявлять эти сбои доказанным дефектом приложения или
  полной native приёмкой. Сначала освободить **минимум2GiB**; новый preflight
  проверяет место ДО подключения к API/S3. Не чистить чужие файлы автоматически.
  Стенд теперь переносит необходимые public assets (read-only symlink), не
  только privacy.html; подавлена лишь onboarding preference тестового браузера.
  API child доверяет точному own browser origin, рабочие CORS/flags не менялись.
  Итог: root tsc, targeted60 pass/8 opt-in skip, boundaries667/docs58/diff exit0.
  Low-space preflight отдельно подтвердил ожидаемый отказ без DB/S3 credentials,
  beforeAll/0 writes; это не native pass. Own контейнер a2518615… удалён после
  повторной сверки name/owner/loopback58158/tmpfs/no mounts, чужие3 сохранены;
  временные API/Next/browser закрыты. Последний free271MiB. Review: fixture-only
  изменения, credentials не попадают в Next/Git/logs; новые DB/S3 objects только
  синтетические. Рабочие frontend/backend runtime и дизайн прежние.
  После освобождения места создать новую own fresh39 БД с именем/label
  `daryadarcy-fresh-editors-*`, передать её URI в BACKEND_TEST_DATABASE_URL и
  DATABASE_URL, exact64-char ID в PRIVATE_EDITORS_DATABASE_CONTAINER_ID, test JWT
  в JWT_SECRET, прежний разрешённый S3 доступ только через stdin/memory.
  `PRIVATE_EDITORS_S3_ACCEPTANCE=true CI=true pnpm exec vitest run
  tests/private-editors.s3.mysql.test.ts --maxWorkers=1 --reporter=dot`.
  Запускать весь файл: edit проверяет именно пост, ранее созданный UI того же mode.
  Working flags не включать; fresh migration preflight и own cleanup обязательны.

- [x] FE4: по прямому поручению подключены новые закрытые audio/document к обоим
  существующим post editors без дизайна. Domain slice ece9991: stable per-file
  intent/status/replay и privateAssetIds, RED9→GREEN18 + legacy regressions110.
  Durable IndexedDB aliases/File bytes, adapters и existing recovery notice;
  status-first replay, no public fallback, upload ready не публикует пост.
  Chromium66 pass, WebKit65 pass/1 existing legacy Blob skip; все14 новых private
  cases проходят в обоих. Reload/lost upload+post ACK/same key+bytes/old media/
  live account switch+late upload/status/cross-tab/storage failure проверены.
  Дополнительные RED filename/MIME и recovery checkpoint→GREEN, DOC не выбирается
  для нового private path; existing DOC/URL не трогались. Full2380 pass/0 fail,
  1455 skipped/5 pending,263 files/45.8s; frontend/E2E/root types, lint/build,
  API86/boundaries667/docs58/diff exit0. Review: alias identity до/после IndexedDB,
  unknown legacy upload остаётся manual-only, 409/status errors не создают ключ,
  late receipt не применяется к новому owner, старые связи не заменяются.
  API browser fixtures подставные; File/IndexedDB/session/abort настоящие. Native
  SQL/S3/rollout этим frontend срезом не заявлены. Working flags/DB/S3/old files,
  SCSS/layout/assets/backend прежние; no push/deploy. Own Playwright server закрыт.
  JSON Vitest/Chromium: /tmp/daryadarcy-private-editors-X7ePea/; WORK_PLAN — команды.

- [x] FE0: пользователь разрешил внутренние frontend исправления без дизайна.
  Fetch origin/staging81e8563: clean ab348be,49 ahead/0 behind; frontend совпадал
  byte-for-byte, merge --ff-only Already up to date. Ничего не перезаписывалось.
- [x] FE1: воспроизведены stale API contract и missing document в viewport fixture.
  Штатная генерация current86 procedures, private uploads/status/export и поля
  отражены без backend runtime imports; exact procedure fixture актуализирована
  для4 CF методов, обнаруженных full run. Viewport runtime прежний, tests4:
  clamp/layout shrink/fallback/SSR. Affected102 checks/5 suites, contract1, API-check,
  frontend+E2E types, lint/build/boundaries664 проходят. Общий GREEN пока не заявлен:
  в работе отдельный media fix и WebKit PNG scenario, см. FE2/FE3.
- [x] FE2: потоковое ограничение URL→Blob для медиа. RED2 consumer tests:
  oversized attachment/video body целиком читался при false Content-Length.
  Исправление сохраняет32/80MiB, abort/error/empty stream и MIME; native loopback
  HTTP и actual Chromium/WebKit stream APIs проверены (4+4 browser checks).
  Третий consumer photo URI отдельно RED→GREEN. Всего10 bounded checks, вместе
  с media/save regressions105/4 suites/skip0. Frontend/E2E types проходят.
  Лимиты прежние32/80MiB; MIME/bytes/EOF/abort, early cancel/releaseLock и реальное
  закрытие chunked loopback response проверены. Не добавлялись API/flags/deps,
  layout/SCSS/TSX/visual assets прежние. Working S3/DB не вызывались.
- [x] FE3: браузерная media regression. Старый post/42 scenario использовал
  неверный accessible name «Назад» вместо «Вернуться назад»: selector исправлен,
  адресный Chromium повтор прошёл; UI/source header не менялся. WebKit macOS
  возвращает image/png при canvas.toBlob(image/webp); random1100 PNG не помещается
  в4MiB после existing1080 fallback. RED воспроизведён и после уточнения valid
  PNG/WebP+alpha contract (uploads0); GREEN после дополнительного maxEdge960.
  Обычные JPEG/WebP сохраняют первый успешный вариант; alpha/4MiB/MIME/filename
  не подменяются. Никаких SCSS/layout/TSX/visual assets/backend/DB/S3 изменений.
  Итог: **20 Chromium +20 macOS WebKit browser checks, skip0**,21.3/24.4sec;
  frontend build/types/E2E/lint/root tsc проходят. Full Vitest **2360 pass,
  0 fail/1455 skipped/5 pending,262 files,39.1sec**; opt-in не засчитан за native
  backend/S3/provider acceptance. Первоначальный full fail — stale exact API
  fixture, а не runtime regression; fixture теперь соответствует CF routes.
  Исходные JSON: /tmp/daryadarcy-frontend-verify-2Ylry8/{vitest-final,chromium-final,
  webkit-final}.json; воспроизводимые tests/commands и границы — начало WORK_PLAN.
  Playwright установил Chromium1208/WebKit2248; его initial install автоматически
  очистил unused cache1234/2336 (восстанавливается download), пользователь уведомлён;
  далее GC отключён. Own Playwright server8081 завершён, loopback HTTP server закрыт.
  Дизайн/working flags/old media/API semantics не менялись; no push/deploy.
  Финальные API86/boundaries665/docs58/diff exit0; повторный fetch после transient
  SSL ошибки подтвердил staging81e8563, без ослабления TLS/merge/перезаписи.

- [x] AG9-L4: разрешены только count-индексы и повтор local load. RED2 ALL→ref
  tests + unchanged exact-count test; A/B30 calls/phase, одинаковый result hash:
  median30.24→4.83мс, invisible30.36мс, visible-repeat6.10мс. Candidate nonunique
  likes(postId)/comments(postId,createdAt), additive0038 + ORM, commit6680f21.
  Fresh39/native:31 relevant checks/6 suites/skip0, tsc/build/boundaries664/docs58/
  diff exit0; старые SQL/journal неизменны, existing preflight не обойдён.
  Full5/10/25RPS repeat9900/9900, errors/dropped0, recovery/counts/parity/denials
  PASS.25RPS p95 club45.13→28.14мс, feed36.86→30.65мс, saved30.53→13.06мс;
  comments30.84→32.17мс, worst write10.45→14.09мс — не все методы ускорились.
  Два главных count-page digest examined rows -96.6–97.6%; comments ALL/filesort
  →ref/index, posts/search ALL/filesort остались. DB CPU max47.91→18.62% core;
  API peak RSS386.2→438.5MiB, end198.6MiB — leak/capacity не сертифицированы.
  Native INNODB_METRICS deadlocks/timeouts0, all187 SQL digests SUM_ERRORS0,
  outbox/media/open trx/external TCP0, cumulative row waits7→7. Full evidence:
  docs/audits/content-launch.md + tooling/data/backend-load/2026-10-15-indexed.json,
  исходный baseline JSON сохранён. API/caffeinate завершены, три own synthetic
  tmpfs containers удалены после exact ID/owner/loopback/mounts checks; чужой
  local-owner39fdda943241 и другие стенды не тронуты. Frontend/working DB/S3/API/
  квоты/пул без изменений; без push/deploy. Working0038 rollout не выполнялся.

- [x] AG9-L0: по поручению предложен минимальный local API/DB load scenario в
  начале очереди tasks/plan.md: current38 fresh SQL/own tmpfs, synthetic dataset,
  real login отдельно от mixed HTTP read/toggle,5/10/25RPS, per-method latency/
  correctness/recovery/resource criteria. Числа предложены, не взяты из ТЗ и не
  согласованы как production SLA. Existing production load-probe не запускать.
  Этот срез только документация; Docker/нагрузка/код/frontend/DB/S3 не менялись.
  Проверка docs58/diff exit0; review сопоставил реальные routes/pool/login quota,
  отделил ожидаемые access denials от ошибок и local baseline от рабочей приёмки.
- [x] AG9-L1: пользователь принял критерии и разрешил локальную нагрузку.
  Новый own labelled loopback/tmpfs MySQL8.4/backend_test,2CPU/1GiB, fresh38,
  отдельный compiled Nest process,60 synthetic users/10000 posts/20000 comments.
  Guards/latency/dropped arrivals: RED3 absent functions→GREEN3, CLI refusal
  проверен отдельно без Docker/SQL/секретов. Real login10 и baseline завершились;
  это не финальная нагрузочная приёмка. Runtime/квоты/пул/фронт/working DB/S3 прежние.
- [x] AG9-L2/L3: baseline→5RPS/2мин→10RPS/3мин→25RPS/5мин→60сек idle→recovery.
  **9900/9900 load requests, errors/dropped0; native run exit0/PASS.** Read/write
  worst p95:5RPS71.97/20.79мс,10RPS71.69/15.99мс,25RPS45.13/10.45мс;
  25RPS read p99<=46.38мс, max in-flight4, scheduling lag p95<=2.44мс.
  10 real login p95=84.97мс; дополнительно30 warmup/600 baseline-recovery requests.
  Exact SQL counts/reaction parity/unique pairs; denied unpaid/blocked/expired,
  outbox/media/open transactions0. INNODB_METRICS deadlocks/timeouts и all-digest
  SQL errors отдельно проверены0; отсутствие SHOW STATUS строки не считалось0.
  API RSS321.9→291.1MiB/peak386.2; MySQL max780.5MiB/47.91% одного core из2,
  pool+observer<=11 connections, current row waits0, cumulative7→7 после login.
  Списки/counts и comments full scans/filesort — подтверждённые первые риски роста,
  но criteria не нарушены; runtime/индексы/пул не менялись. Подробности/команда:
  docs/audits/content-launch.md, JSON tooling/data/backend-load/2026-10-15.json.
  Own00e12d4b9c76/loopback55817/tmpfs/no volumes удалён после exact inspection;
  local-owner39fdda943241/другие контейнеры сохранены, API/temp/caffeinate завершены.
  Фронт/working DB/S3/старые files/flags/remote неизменны. Local-only результат,
  не доказательство production capacity,50 concurrent login или devices.
  Финально4 harness tests/2 suites/skip0, tsc/boundaries664/docs58/diff exit0;
  review: failed/dropped requests не скрываются, latency до полного body check,
  SQL-counter absence не считается success, generated evidence без credentials.

- [x] CF0: пользователь принял показанный контракт новых фото постов/комментариев
  и файлов статей. Зафиксирован в SPEC-private-files.md, без рабочего rollout.
- [x] CF1: photo pipeline и отдельный private content storage guard, RED/GREEN.
  RED: preparePhoto отсутствует, content scope не сохраняет объект. GREEN:
  21 checks (photo + SDK-wire), 37 existing native AG4 checks/skip0; tsc/docs58
  exit0. Проверены EXIF/alpha, отдельный policy guard и lost PUT ACK без второго
  объекта. Это loopback SDK wire, не actual Timeweb ACL acceptance. Рабочий S3
  не вызывался. Существующая public photo pipeline сохранена.
- [x] CF2: durable ledger/upload/status и migration0036. Native7 + transport4
  checks pass/skip0 на own tmpfs MySQL + HTTP/JWT/SDK wire, не Timeweb. RED:
  отсутствующие новые procedures. GREEN: lost ACK/pending/status/retry, concurrent
  upload, changed payload, owner isolation, default-off/role/epoch/deletion,
  photo byte validation/alpha. TXT сохраняет canonical charset=utf-8.
- [x] CF3: atomic post/article binding, live GET/HEAD/Range access и removal.
  CF3a post photos: native9 pass/skip0, после RED foreign binding и missing SQL
  association. Current parent, draft/public/club, owner/usage/raw URL guards,
  create key/replay, HEAD/bytes/no-store/inline и detach/no resurrection проверены.
  CF3b article images/carousel/documents: native11 pass; article regression38
  checks. Один compiled ESM run завершился ETIMEDOUT при длительных паузах
  host/import; адресный повтор без изменений/увеличения timeout —1 pass.
  Подтверждён sleep/wake macOS. Повтор с caffeinate без изменения timeout:
  49 native checks/2 suites/skip0,8.18s, exit0. Working S3 не проверялся.
- [x] CF4: comment binding и права чтения/удаление, без изменения ролей/сроков.
  RED: missing routes, затем дубли comment rows/foreign parent и missing no-store
  на ingress denial; review RED выявил обход ledger при photos=[] в retry.
  GREEN: **98 checks/7 suites/skip0,6.07s**, tsc exit0.
  Native SQL/HTTP/JWT + loopback SDK: upload ACK loss, настоящий downstream HTTP
  drop после upstream commit, same-key/concurrent replay, changed payload,
  list реальных committed rows, другой аккаунт/чужой asset, истечение paid access,
  blocked/epoch/role revoke, delete/no resurrection, прежние 48h/2-photo rules.
  Ledger0037 для новых private-photo comments; legacy toggle/comment semantics
  не расширены. Нет внешнего S3/browser acceptance; фронт не изменён.
- [x] CF5: retirement/export, regression и передача фронтендеру; flags off.
  RED: новые export kinds отвергались; retirement оставлял comment ledger и
  actor/filename у новых receipts. Дополнительно native entrypoint через retirement
  воспроизвёл cyclic initialization: upload schema получал undefined key validator.
  Validator перенесён в dependency-light owning module, без изменения key contract.
  GREEN: **234 checks/12 suites/skip0,15.78s**, native SQL/HTTP/JWT + loopback SDK,
  включая old private upload/article/comment/retirement worker regressions.
  Проверены pagination/owner isolation/no capabilities в export, atomic retirement
  при upload flag off, rollback на partial0037, unbound retirement без S3 effects,
  сохранение bound read evidence, expired recovery409 без нового comment и без
  потери live photo. Отдельно current fresh38: **12 checks/2 suites/skip0,3.10s**,
  все SQL реально применены на новой пустой own loopback/tmpfs DB, current ORM/API.
  Первый запуск fresh suite не стартовал из-за неподдерживаемого reporter=basic;
  исправлена только команда, повтор с dot прошёл. Это не сбой миграций.
  tsc/build/boundaries664/docs58/diff exit0; check:api остаётся expected RED (frontend не
  регенерировался). Previous broad checkpoint101 pass/5 opt-in worker skips не
  засчитан за полную приёмку; финальный прогон включает эти5 checks.
  SPEC и начало existing backend handoff описывают CF API и клиентские guards.
  Review: current actor/parent before storage, one-intent SQL uniqueness, no
  resurrection, bounded metadata export/retirement; новые deps и роли не менялись.
  Оба own synthetic tmpfs контейнера удалены после exact ID/name/owner/ports/mounts
  inspection; existing local-owner стенд39fdda943241 сохранён. Рабочие данные и
  S3 objects не удалялись. Временный собственный caffeinate остановлен.
- [x] CF-S3 storage gate15 октября, по отдельному прямому разрешению: preflight
  current policy/ACL/empty prefix/versioning и signed IAM GetUser; identity
  fingerprint886adafddaec совпал с existing private attachment allowlist.
  Добавлен только DaryadarcyPrivateContentV1 на content/private-v1/*; три прежних
  statement и ACL сохранены. Hash до1f66d0c775b9, после0484dfa2cc01 (полные в SPEC).
  Реальный SDK/Timeweb: TXT10/WebP88 bytes, signed HEAD/GET200/Range206 exact,
  anonymous GET/HEAD/Range403 для обоих; own public-control до/после200 exact.
  Три собственных файла удалены после owner/hash/MIME/size/ETag guards, HEAD404;
  prefix пуст, rule/readback/ACL проверены. Другой валидный S3 principal не
  проверен. SQL/API/browser этим probe не засчитываются. Локальная подготовка
  sharp в signed host сначала отказала (Team IDs); отдельный Node подготовил
  тот же WebP, dependencies/защита/приложение не менялись. JS kernel завершён.
  Docs58/diff exit0; runtime не менялся, успешные прежние SQL/build suites без
  новой причины не повторялись. Review ограничил claim storage-only результатом.
- [x] CF-API15 октября, по прямому разрешению: настоящий Nest HTTP/JWT + SQL38
  fresh migrations + Timeweb S3, без fixture DDL. Новый opt-in
  tests/private-content-files.s3.mysql.test.ts: **4 pass/skip0,35.11s,exit0**.
  Документ/фото поста/фото статьи/фото комментария: upload/status/binding/read,
  настоящие потерянные HTTP ответы после upstream200/commit, новые процессы API,
  same-key/concurrent replay с прежним assetId/material id и без второго PUT;
  changed payload и photos=[]409, foreign binding/account isolation, current list.
  GET/HEAD/Range exact, WebP alpha/no EXIF/inline, document attachment, no-store/
  nosniff, anonymous storage403. Draft/hidden/detached/deleted, paid expiry,
  block/role/session revoke закрывают следующий read до S3; новая сессия допустима.
  Default-off проверен только в own API children; рабочий флаг не включался.
  Четыре own S3 objects удалены после ledger filename UUID/asset/hash/MIME/size/
  ETag guards, signed HEAD404; policy hash0484dfa2cc01 неизменен, policy writes0.
  Предварительный doc-срез1 pass/8.66s после исправления неверного test expectation:
  у unpublished article нет teaser; после publish ровно один. Runtime не менялся.
  Один запуск стенда стартовал до окончания DB readiness: connection closed,
  cases не выполнялись. После реального readiness и SHOW TABLES=[] штатный
  fresh-only initializer применил38 SQL; финальный прогон выше без skip/fail.
  Типовая ошибка generic SDK helper устранена в тесте, не ослаблением tsc.
  Дополнительно pure regression30/4 suites/skip0,1.32s; tsc/boundaries664/docs58/
  diff exit0. Review: проверяется реальный результат/bytes/SQL, SDK наблюдение
  call-through без подмены ответов; production и frontend source не менялись.
  Все три own tmpfs контейнера срезов удалены после exact ownership inspection;
  existing owner39fdda943241 сохранён, временные API/JS kernel/caffeinate завершены.
- [ ] CF остаток: browser/device acceptance и отдельно разрешённый rollout.
  Frontend/generated types и scoped native acceptance закрыты CF-F1/F2/F3 выше.
  Независимый второй валидный S3 principal не предоставлен/не проверен.
  Рабочая DB/старые objects/рабочие flags не менялись; push/deploy нет.
  Не переделывать готовый runtime без дефекта и
  не повторять успешные native/probe checks без drift/изменений/новой причины.

- [x] По следующему поручению подготовлены F-TEST-1/F-API-1 в начале existing
  backend handoff: точная причина viewport fixture, минимальный DOM stub и
  layout/fallback/SSR cases; regeneration на merged backend33b8bbe82/79 и
  критерии check:api/affected/full tests. Frontend/tests/types не исправлялись.
  Проверена активная очередь: независимого незавершённого backend runtime среза
  нет; совместная private-media/native/rollout остаётся незавершённой, не GREEN.
  Никаких новых функций, рабочих данных, push/deploy или внешней отправки.

- [x] По прямому разрешению пользователя локально объединены parent ad54e16 и
  свежий staging81e8563 на feature/stage-one-completion-2026-10-10; без конфликтов,
  ручных правок frontend, push/deploy/DB/S3. Frontend tree точно равен81e8563;
  apps/backend и packages/database точно равны ad54e16. Зависимости не менялись.
  `pnpm check` (root + frontend/E2E types), lint, backend/frontend builds,
  boundaries656, docs58, staged diff check — exit0.
  Полный Vitest без external/SQL credentials: **2339 pass, 1 fail, 1427 skipped,
  5 pending**, 255 файлов/3772 tests,51.26s, exit1. Единственный fail:
  __tests__/web-viewport.test.ts — document is not defined (viewport.ts:73).
  Адресный повтор:1 pass/1 fail. Test/viewport/config/setup одинаковы в обоих
  parents: это существующий пробел Node fixture (window задан, document нет),
  не новый merge conflict; исправление фронта/его тестов не разрешено.
  check:api exit1 — сохранён known contract82 vs frontend79, без regeneration.
  JSON evidence: /tmp/daryadarcy-merge-check.fCpphO/vitest.json. Не общий GREEN;
  SQL/browser/provider/mobile acceptance этим merge не выполнены.

- [x] AG9: актуализировать existing backend handoff после frontend34f1a8d/
  staging81e8563. Fetch15 октября: snapshot не менялся с прошлой сверки;
  club access/articles/NORMAL/VK уже подключены, не делать заново.
  Остаток клиента — новые private upload/status/association; контракт82/79 и
  два post input mismatch записаны с датой предыдущей read-only проверки.
  Новый UI для recoveryExport не назначен. Только docs, без runtime/front changes.
  Документация56/diff exit0; review сопоставил текст с current handlers и staging
  исходниками. SQL/browser/build не повторялись: code не изменён, новых claims нет.
- [x] Локальная private-media интеграция и согласованная native acceptance:
  FE5/CF-F1b3/CF-F2d/CF-F3d/VU4 завершены выше. Видео UI/browser reload не засчитаны
  по VU4 transport/coordinator проверкам: browser/mobile отложены.
  Remote staging/сервер этим результатом не обновлены; push/rollout не разрешены.
  Пакет передачи: начало docs/development/backend-handoff-2026-10-05.md.
  Без новых входов не повторять готовые тесты/не придумывать backend функции.

Правила, основания и критерии: начало [плана](plan.md), раздел «Действующий план
агента». Это единственная текущая очередь. Работать по одному доступному AG-пункту;
фронтенд не менять. Незачёркнутые пункты истории ниже не являются дополнительным
поручением. Новый список создан для продолжения, а не для повторной реализации.

**AG4 завершён локально 14 октября:** upload/recovery/association и actual S3
acceptance после MIME guard повторно пройдена на HEAD e3044af:2 pass/skip0,
21.22 s, exit0. Timeweb timeout снят; flags off. AG5/AG9 ждут history/retention, frontend integration
и разрешённой внешней приёмки/rollout. Следующий локальный срез после последующего
«да все делаем дальше» — **AG5-R6**, локальная часть завершена ниже. Рабочая очистка
не включена; rollout/history/backup/restore остаются внешними gate.
AG6 принят и реализован
локально 14 октября; AG8 также принят/реализован локально. Внешняя приёмка/включение
не разрешены этими результатами.
Доступная локальная подготовка сохранена. Внешние действия/фронт не выполнялись.
Последующее решение пользователя14 октября: подготовить **отдельную пустую БД**
локально, существующую не трогать, без frontend/deploy. Теперь доступен AG5-F:
- [x] F1 — fresh-only manifest всех36 SQL, старый journal/preflight без изменений.
  RED absent fresh profile→GREEN21 policy/history checks/skip0; typecheck exit0.
  Известные0017–0019 включены только в отдельный generated profile с новыми
  fresh-only ordering IDs; прежние SQL bytes/hashes и зарегистрированные when
  сохранены. Unknown orphan/missing SQL отказывают; старая история не подделывается.
- [x] F2 — own-container/empty-target guarded local initializer, no reset/retry repair.
  `db:fresh:local` требует FRESH-only URL/ID, matching owner/name/loopback port,
  tmpfs без volumes; production/nonlocal/unowned/nonempty/repeat отказывают.
  Все36 SQL применены настоящим Drizzle; никаких env-файлов/seed/default admin.
- [x] F3 — full SQL install/history/current schema/native API acceptance и runbook.
  Финальная новая пустая MySQL8.4: native9 + policy/history21 = **30 pass,
  4 suites, skip0, 3.02s**. Все текущие ORM tables/columns читаются без fixture DDL;
  native HTTP feed/articles=200/empty, guest admin=401, users=0.
  Runbook описывает partial-DDL отказ и отдельный fresh history profile;
  стандартный db:push на эту историю не разрешён. Это не release approval.
- [x] F4 — по последующему поручению пользователя локальная backup/restore
  репетиция: existing backend backup + настоящий mysqldump8.4, gzip в own temp,
  восстановление native mysql в другой пустой own tmpfs backend_test.
  **6 native pass/skip0, 2.55s**: все tables/rows и точные SHOW CREATE TABLE
  совпали; migration history36, Unicode/JSON/NULL и уникальность email/requestKey
  сохранены. Повторный restore отказывает без изменений. Администратор не создан.
  Тестовый transport adapter переносит вызов mysqldump в контейнер (на host нет
  клиента); SQL/production gzip/file completion не подменяются. S3 выключен.
  Это локальная rehearsal, не подтверждение production/media/off-site backup.
  tsc/docs56/diff exit0; review correctness/security/architecture/performance:
  runtime code unchanged, test harness only, no credentials from working env.
  Synthetic архив удалён test cleanup; оба собственных контейнера удалены после
  exact ID/name/owner/loopback/tmpfs/mount inspection; чужие контейнеры сохранены.
- [x] F5 — отдельное согласование тестового owner14 октября: own new fresh36
  tmpfs backend_test, один owner existing admin/scrypt, random192-bit пароль
  в private600 файле вне Git (directory700, user ownership verified).
  Native loopback HTTP8 checks pass: wrong401, login200/cookie flags, me/admin,
  guest401/owner200, public response без hash, logout clearing, users1/outbox0.
  Owner test API retained `http://127.0.0.1:53530`, own database50130,
  container `daryadarcy-fresh-owner-20261014` / ID
  `39fdda9432419407613a02cc313a531c22e065dacbdac54b191b5f841129011b`;
  app exec session67647. Private stand-info/credentials в
  `/Users/edem/.daryadarcy-local-owner.u7zmU7/` (содержимое не читать/не печатать).
  Frontend/working DB/S3/auth code/roles/CORS/proxy/quotas не менялись, писем нет.
  Не удалить активный стенд как чужой leftover; перед teardown exact owner guards.
  Это не production owner/deploy; tmpfs account пропадёт при остановке контейнера.
  Уточнение16 октября: после прямого разрешения очистить неиспользуемые контейнеры
  удалён остановленный39fdda943241 (exact ID/name/owner verified, tmpfs, mounts0).
  Его tmpfs данные уже утрачены при остановке; старый адрес/API выше — история,
  не активный стенд. Образ mysql и закрытый локальный credentials directory не
  трогали/не читали; при необходимости стенд создаётся заново штатной процедурой.
Старый history gate ниже относится к upgrade существующей среды, не к fresh-only
установке. Общая внешняя приёмка/backup/выкладка остаются отдельными условиями.

После checkpoint b525130 проверена активная очередь: AG1–AG4/AG6–AG8 и локальные
AG5-R1–R6 закрыты. Общая release-процедура дополнена0035 и порядком R6 flags/drain/
rollback. Следующие AG5/AG9 требуют внешнего пакета истории/schema snapshot,
backup/restore подтверждения и общей frontend/release приёмки. Без этих входов
новую runtime работу не придумывать; остановиться с точным остатком. Фронт,
рабочая БД и S3 последним поручением исключены; successful native suites не
повторять без изменений. Это не закрытие всего ТЗ/рабочего выпуска.
Составление плана само по себе не запускает реализацию. Следующее поручение
«работай по плану» запускает AG1 либо уже следующий доступный незавершённый пункт.

- [x] Составить ограниченный план агента с критериями, скиллами и границами:
  текущая документационная задача 13 октября. Реализация AG1–AG9 этим не выполнена.
- [x] **AG1 — пакет контрактов для фронтендера.** Статус: готово локально.
  Обновлён existing backend handoff: служебный доступ, ключ/статус статьи,
  email/files flags, ошибки и критерии совместимости. Runtime/фронт не менялись.
  Remote staging повторно проверен: 62b24a6; версия сервера не установлена.
  Проверка: docs55/diff exit0; check:api exit1 — ожидаемый stale contract,
  не скрыт и не объявлен зелёным. Native suites неизменны, не повторялись.
  Commit 793dd57; внешняя отправка не выполнялась.
- [x] **AG2 — native S3/private attachment acceptance.** Статус: ограниченная
  native acceptance пройдена 14 октября; первоначальный storage gate дал отказ:
  anonymous GET/HEAD=200 для нового private объекта.
  Пользователь предоставил рабочий Timeweb bucket `daryadarcy-s3` и прямо разрешил
  synthetic проверку. Signed PUT/HEAD/GET/Range прошли; private denial не прошёл
  (probe exit1). Read-only policy содержит unconditional anonymous GetObject Allow
  на все объекты. Только свой десятибайтовый fixture удалён после owner/ETag/size
  проверки, signed HEAD после удаления=404. Старые объекты и policy/ACL не менялись.
  Нужен отдельный закрытый bucket или отдельно согласованная policy нового prefix;
  proxy/SQL/browser acceptance ещё не выполнена. Ключи не сохранялись; пользователь
  отказался от их замены, автоматическая ротация не разрешена.
  14 октября после уточнения стоимости пользователь отказался от создания нового
  платного bucket. Не создавать его и не заменять это разрешением на изменение
  policy существующего bucket. Решение по новому private prefix не принято;
  AG2/AG4 остаются заблокированными, а не завершёнными. AG3 принят.
  Последующее поручение — только исследование закрытого prefix без нового bucket.
  Read-only policy/ACL + ListObjectsV2 MaxKeys1 подтвердили пустоту
  `feed/audio/private-v1/`, `feed/documents/private-v1/`; proposal в SPEC-private-files.
  Предложен точечный Deny для неразрешённого principal, не anonymous-only guard;
  точное username/условие Timeweb и policy diff ещё требуют проверки/согласования.
  PUT/DELETE/policy/ACL writes, runtime/фронт/рабочая БД не выполнялись.
  После показа proposal пользователь разрешил продолжение: bounded policy trial
  двух новых prefixes с identity/hash/enforcement guards, затем native acceptance;
  старые statements/объекты/права не менять, AG4 только после прохождения AG2.
  Последующий trial: Owner.ID не совпал с caller username, первая проба откачена;
  signed IAM GetUser подтвердил service identity. Установлено одно scoped правило
  `DaryadarcyPrivateAttachmentsV1`; original statements сохранены. Valid signed
  nonmatching-allowlist=403, правильный SDK GET/HEAD=200/Range206 exact bytes,
  anonymous GET/HEAD403; public-control200. Второй S3 аккаунт не проверялся.
  Native API/SQL/Timeweb/Chromium и unchanged Next rewrite: 23 pass, skips0,
  9.08 s, exit0. Denial без S3; draft/hidden/deleted/detached/removed, подписка,
  block/role/session revocation, bytes/HEAD/Range/416/503 пройдены. Не UI/player/device
  приёмка. Три own S3 fixtures удалены с ownership guards/HEAD404; scoped policy
  остаётся. Собственная tmpfs БД удалена после exact owner/id/loopback/mount checks;
  чужие контейнеры/volumes не затронуты. TypeScript/docs56/diff exit0, review пяти осей.
  Фронт/working DB/runtime flags/старые ресурсы не менялись; новый bucket не создан.
- [x] **AG3 — минимальное продолжение закрытой выдачи.** Контракт принят
  пользователем 14 октября: новые audio/document, существующие администраторы,
  server assetId/receipt/transactional association, локальный File preview без
  draft read, восстановление upload ACK тем же ключом без дублей. Автоочистка
  выключена, retention отдельно; фото/статьи/shared/public/old вне среза.
  Зафиксировано в SPEC-private-files. Это согласование, не реализация/приёмка:
  runtime/API/schema/ACL/фронт/рабочая БД не менялись; на момент согласования
  actual S3 отсутствовал (последующая AG2 acceptance описана выше).
  Проверка документации: docs55/diff exit0; runtime tests не повторялись.
- [x] **AG4 — реализация расширения файлов по принятому AG3.** Статус: backend
  реализован/проверен локально 14 октября, actual S3 synthetic acceptance пройдена.
  Upload/receipt/transactional association готов; frontend/working rollout отдельно.
  Старые файлы/рабочие URL/ACL/фронт не менять. До принятия AG3 не начинать.
  Прямое поручение реализации 14 октября; bounded wire в SPEC-private-files:
  - [x] AG4a — private upload/immutable receipt/status, unknown outcome recovery.
    Первый backend-срез 14 октября: 0032/default-off, durable intent до S3,
    ACL private/IfNoneMatch/no fallback/policy guard, canonical server metadata.
    RED routes404 → GREEN 10 native HTTP/SQL/SDK-wire; concurrency/lost PUT ACK,
    namespace drift/status и schema uniqueness refusal проверены. В объединённом
    focused прогоне 32 pass/3 files, skips0. tsc/build/boundaries/diff exit0;
    это не actual Timeweb acceptance. Привязка/чтение — AG4b, actual S3 — AG4c.
  - [x] AG4b — actor-owned transactional post association/replay/removal denial.
    RED: stripped privateAssetIds/foreign save и URL bypass, missing charset;
    GREEN: 18 native HTTP/SQL/SDK-wire сценариев; ready/pending/foreign/rebind,
    create replay/update/removal и SQL-trigger rollback. Новые post_media возвращают
    только API URL; pinned receipt ETag проверяется перед чтением. Старый URL input
    не принимает только новые private-v1 prefixes, старые files/URLs не менялись.
    Combined affected suites 126 pass/4 files, skips0, 75.95 s. tsc/build/boundaries
    проверены; frontend/provider S3 acceptance не подменены wire результатом.
  - [x] AG4c — actual S3 synthetic upload/read/denial/restart и handoff/review.
    Actual2 pass/skip0,6.24 s до последнего MIME guard: два fresh compiled Node процесса, потеря native HTTP
    upload/post ACK и restart не создают второй PUT/asset/post/media. Document/WAV,
    anonymous403, cookie/paid/guest/expiry, feed/removal, Range206 exact bytes.
    Own objects удалены с guards/HEAD404, policy unchanged. Wire guards20 pass
    (ready без ETag отказывает503; FLAC/read mismatch RED200→GREEN400 до SQL/S3),
    final affected84 pass/4 files/skip0; tsc/build/boundaries/docs/diff/five-axis review.
    Первые повторы после guard дважды отказали на GetBucketPolicy timeout до объектов;
    public endpoint TLS timeout тоже. По новому поручению повтор на HEAD e3044af
    прошёл:2 pass/skip0,21.22 s,exit0, native API/SQL/Timeweb и fresh process restart.
    Own S3 objects удалены после guards/HEAD404, полная policy unchanged.
    Own backend_test892be65d1156/loopback58418/tmpfs/no volumes удалён после exact
    owner/id/port/mount guards; foreign containers сохранены. Front/старые objects/
    working DB/runtime flags не трогались. Код не менялся; прежнюю full regression
    без причины не повторяли. S3 timeout блокер снят, остались внешние AG5/AG9 входы.
    Final full3418 pass/1 fail/179 skip,206.53 s после MIME guard: unchanged frontend viewport/document
    undefined не исправлялся. Backend inventory/save compatibility исправлены;
    bulk-video focused/final GREEN, runtime не менялся. Proof в SPEC-private-files;
    existing handoff обновлён. Own loopback33383/tmpfs backend_test752bd9b9dffe удалён
    после exact owner/id/port/mount checks; чужие контейнеры сохранены.
    Read-only check:api exit1 — frontend generated stale, не изменён.
    0032 в manifest, offline preflight только
    untracked0017–0019/DB not checked. Front/старые files/working DB/flags/deploy
    не менялись. Срезы31b5a2d/ffcdbb3/9c68ccc/b52b469/b9cae24,
    Native restart/S3 harness314bf2c; документационный checkpoint отдельно.
- [ ] **AG5 — подготовка миграций/email/статей к выпуску.** Актуально после D4:
  локальные R1–R6/fresh42/backup-restore выполнены, candidate/switch/admin и
  выпуск проверены; старая0017–0019 history не блокирует выбранный fresh путь.
  Незакрыты отдельно разрешаемые рабочие private flags, внешняя почта и перенос
  реальных материалов. Email binding исключён пользователем19 октября; retention
  не является обязательной функцией запуска. Нового доступного локального
  backend среза не выявлено. Не повторять завершённую подготовку/импорт БД.
  Следующая запись сохраняет историю14 октября, не текущий блокер: процедура
  подготовлена в existing runbook; ждёт истории/retention решения и репетиции
  применимого snapshot. 0017–0019, 0027/0028/0029, guards и порядок включения,
  совместимый rollback/реальный restore описаны; рабочая БД не проверена/не изменена.
  Offline preflight exit1: ровно untracked 0017/0018/0019, databaseChecked=false,
  releaseApproval=false; manifest 0029 зарегистрирован. Docs55/diff exit0.
  Процедура сохранена 24e7b31; migrations/working connection не выполнялись.
  14 октября подготовлен проект четырёх рекомендаций хранения в existing runbook:
  окно30 суток/compact marker/owned orphan cleanup/scrub-export-backup. Статус:
  После объяснения30 суток и ответа «да все делаем дальше» агент явно обозначил
  трактовку как принятие всех четырёх рекомендаций; локальная реализация начинается
  default-off. Bound read evidence сохраняется; billing/working rollout отдельно.
  - [x] AG5-R1 — private upload/status/unbound binding expiry, без удаления.
    Acceptance:30 суток409, pending/ready не дают новый PUT/bind; flag off прежний
    replay, живой bound read сохраняется. RED/GREEN native SQL/HTTP + policy boundary
    units; tsc/build/boundaries/docs. Files: private uploads/association/policy/tests.
    RED200→409 для upload/status и unbound bind; cutoff mutation `>` вместо`>=`
    пойман unit тестом. GREEN31 pass/2 suites/skip0,3.75 s; tsc exit0.
    Default-off CONTENT_RECOVERY_RETENTION_ENABLED; rows/objects не удаляются.
    Backend build529.1kb/boundaries633/docs56/diff/review passed; frontend не менялся.
  - [x] AG5-R2 — keyed post create expiry. ПослеR1;409/no duplicate/delete,
    flag off legacy replay. Native post suite + types/build; owning creator.
    RED replay200→409;38 native pass/skip0,2.24 s, tsc/build/diff verified.
    Без новой status процедуры; уведомление не повторяется, материал не удаляется.
  - [x] AG5-R3 — keyed article create/status expiry. ПослеR1;409/no duplicate,
    flag off legacy replay. Native article suite + types/build; owning writes/status.
    RED create/status200→409, GREEN27 native pass/skip0,3.82 s; tsc/build529.3kb.
    Live/deleted articles и teaser не удаляются/не воскрешаются.96 total focused
    cases в4 files поR1–R3; общий regression checkpoint отдельно.
    R1–R3 full наaf058ba:3434 pass/1 unchanged frontend viewport fail/179 skip,
    3614 cases,194.65 s,exit1. Frontend не исправлялся/не скрыт; код остальных
    backend suites не менялся. Новые policy/runtime tests пройдены явно на own DB.
  - [x] AG5-R4 — compact markers/read evidence. ПослеR1–R3; additive schema,
    replay после compact отказывает, bound bytes доступны; native SQL/read + review.
    R4a:0033 marker schema/полный compositePK(kind,requestKey)/ASCII_BIN,
    owner и expiry scan indexes. RED absent table→2 native SQL GREEN,0 skip,
    254 ms. Compaction ещё не реализована; worker не включён.
    R4b: spent-marker guards для post/article/private upload/status и unbound bind.
    RED: duplicate create/false notRecorded/unbound bind200 → GREEN102 cases,
    5 suites/skip0,7.02 s, own SQL/HTTP/SDK wire; bound bytes/edit сохранены.
    Article status — nonblocking repeatable-read snapshot, writer — ledger→marker
    locks; регрессия ожидания незавершённой записи исправлена. Schema missing
    legacy допускается только flag off; partial PK/owner mismatch fail closed.
    R4c: post/article compaction атомарно marker+delete details,
    bounded1–100 на ledger, два default-off флага, без API/scheduler wiring.
    4 native SQL +6 policy tests/skip0 прошли; private lifecycle0034,
    filename scrub/marker без потери bound read/cleanup evidence. Live bytes/edit
    пройдены; подробная процедура/flags/cursor в existing runbook.
    Preflight зарегистрировал0033, отказывает только на прежних0017–0019,
    databaseChecked=false/releaseApproval=false. Никакой working DDL.
  - [x] AG5-R5 — bounded orphan cleanup. ПослеR4; loopback SDK/SQL, ownership,
    detach clock, cleanup↔upload/bind/lost DELETE ACK/restart, no old/bound objects.
    Explicit local call,1–100/keyset cursor, flags default off, API/jobs не подключены.
    Never-bound30d; detached clock от first observation, не guessed upload date.
    Exact private-v1 key/metadata/size/MIME/ETag/namespace guards, conditionalDELETE,
    HEAD404; marker committed before storage, receipt retained при unknown outcome.
    Storage/DB guards запрещают non-loopback/production targets. Native affected:
    116 pass/6 suites/skip0,8.25 s; lost ACK и fresh compiled process recovery,
    pending PUT reconciliation, late bind lock race, SQL rollback counters verified.
    Это loopback wire, не actual Timeweb cleanup acceptance; рабочая очистка off.
    Full checkpoint:3454 pass/1 прежний frontend viewport fail/179 skip,
    3634 total,195.13 s,exit1. Все affected native cases прошли; full GREEN
    не заявлен, frontend/его tests не менялись.0034 только own tmpfs fixture;
    migration31 pass, offline preflight прежний gate0017–0019.
  - [x] AG5-R6 — final scrub/export, **локальная часть**. ПослеR4/R5; existing account timing unchanged,
    own records only, no resurrection/no secrets. Backup/real restore/history внешние.
    R6a: final account retirement атомарно отзывает sessionVersion. RED: stale
    authenticated private actor проходил SQL write fence после scrub; GREEN19
    real SQL/native maintenance cases,skip0,2.06s, включая paid/grace/renewal,
    rollback/два workers и однократный epoch increment. Roles/timing не менялись.
    R6b: 9 stale-context native RPC/SQL случаев RED→GREEN: keyed/legacy create,
    edit/delete post/article и confirm post после final retirement дают UNAUTHORIZED
    без изменения материалов/журналов. Actor PK/epoch/role/block fence держится
    первым до commit. Activity upsert мог заново создать old openId после scrub;
    заменён existing-only epoch/identity update с SKIP LOCKED. Два native SDK/SQL
    RED→GREEN сценария подтверждают no resurrection и nonblocking busy activity.
    Affected checkpoint:179 pass/7 suites/skip0,8.84s, включая HTTP lost ACK,
    compiled-process replay и uncommitted article status; tsc/build/boundaries exit0.
    R6c локально: final transaction удаляет post/article journals и markers автора,
    private receipts NULL-owner/empty filename/rotated key сохраняют bound/orphan
    evidence.0035 только own tmpfs fixture; flag retirement off. RED retained owner
    links→GREEN; affected112 pass/7 suites/skip0,17.05s; tsc/build exit0.
    Native rollback/partial schema/flag-off/neighbor/bound receipt/retired compaction
    проверены. Runtime DDL/S3 нет; read check без обращения к storage.
    R6d: собственный protected `profileExtras.recoveryExport`, strict kind/keyset
    limit1–100/default25, current epoch/block snapshot, default-off export flag.
    Только request fingerprint/createdAt/status; нет content/filename/material IDs,
    assetId/claimToken/hash/ETag/storage URLs. Marker terminal независимо от flag;
    nonblocking RR сохраняет pagination через compaction. Guest/revoked/blocked
    HTTP401, malformed400, disabled404, partial schema503 sanitized.
    Финальное review: full primary keys/InnoDB/private unique evidence обязательны;
    RED dropped PK позволял scrub→GREEN fail-closed rollback.101 receipts обработаны
    bounded batches без пропусков/возврата owner links. Native SDK/HTTP/SQL и unit:
    **288 pass/14 suites/skip0,16.00s**, tsc/build/boundaries/docs/diff exit0.
    Full checkpoint перед последним uniqueness guard:3498 pass/1 unchanged frontend
    viewport failure/174 skip/3673 total,197.06s,exit1. Report
    `/tmp/daryadarcy-r6-export.WsYnXU/full-final.json`; финальный guard проверен
    affected checkpoint выше. Full GREEN не заявлен. Backend publication tests
    обновлены к user→material lock order, missing post/one notification checks
    сохранены; API inventory добавлен, generated frontend contract не менялся.
    `check:api` expected stale exit1; offline preflight прежние0017–0019,0035
    зарегистрирована, databaseChecked=false/releaseApproval=false. S3/working DB
    не затронуты. Режимы off; это НЕ production enablement/полное стирание backup.
    All-admin writers не заявлены; AG5/AG9/backup/restore/history gates прежние.
- [x] **AG6 — точные остатки обычной оплаты/отмены.** Статус: готово локально
  14 октября по принятому контракту. Authenticated normal create/status,
  ledger 0030 и default-off flag; guest/TEST/settlement/отмена прежние.
  Native RED: отсутствующие routes, terminal states, schema/evidence guards.
  GREEN: 26 SQL/HTTP сценариев, включая replay/concurrency, lost ACK,
  два compiled процесса, rollback, config drift и session revocation fence.
  200 existing billing tests; inventory/history/preflight unit tests зелёные.
  Финальный объединённый прогон: 244 pass в 14 файлах, skip=0.
  TypeScript/backend build/boundaries/docs/diff проверены; review пяти осей.
  Handoff обновлён. check:api stale, frontend/рабочая БД/provider не затронуты.
  Offline preflight: только старые untracked 0017–0019, databaseChecked=false,
  releaseApproval=false; 0030 зарегистрирован. Working rollout/retention/client/
  реальные provider payment остаются AG5/AG9. Это не external payment acceptance.
  Код/schema/tests: локальный commit fa8d70f. Остальная доступная очередь требует
  внешних входов/решений AG2/AG3/AG5/AG8/AG9; не выполнять вместо них лишнее.
- [x] **AG7 — точные остатки публикаций/пользовательских API.** Статус: ограниченный
  аудит готов локально. Owning services/существующие native suites сопоставлены
  в handoff; storage/клиент/devices остаются внешними границами. Нового подтверждённого
  backend-дефекта в выбранных путях не установлено; код/тесты не менялись и GREEN
  без причины не повторялись. Это не сквозная приёмка всего C/S.
  Проверка документации: docs55/diff exit0, source/test coverage review.
- [x] **AG8 — необходимый объём VK.** Статус: принят и реализован локально 14 октября.
  [Контракт](../SPEC-vk-catalog-access.md): mixed catalog, additive reads/admin write,
  0031/nullable YouTube ID, source-free cards, default-off VK_CATALOG_ENABLED.
  Native RED/GREEN: 88 backend checks в 11 файлах (21 VK SQL/HTTP + live Node worker
  с настоящим API/SQL); worker native 42 pass, skip=0, real VK не проверялся.
  TypeScript/build/boundaries проверены; API types stale оставлены фронтендеру.
  Offline preflight: только untracked 0017–0019, 0031 зарегистрирован, без DB approval.
  Worker guards сохранены 3978691; source/transaction/auth/wire review выполнен.
  Backend/schema/native tests сохранены 70a5110; одноразовый SQL стенд после
  проверок удаляется с проверкой owner label/id/loopback/tmpfs, без чужих volumes.
  Остаток AG9: реальные embed/device/frontend, working migration/history и edge
  routes. Старый nginx yt-thumb public proxy не сертифицирован как закрытый.
  Фронт/рабочая БД/настройки VK/старые ролики не изменены; flags не включались.
- [ ] **AG9 — пакет выпуска и сквозная приёмка.** Актуальная локальная сверка
  после D4 (19 октября): branch/status/log и завершённые AG1–AG8/fresh/LB4/
  RELEASE-D3/D4 evidence проверены; восстановлены действующие статусы AG5 и
  fresh candidate. Нового подтверждённого backend-дефекта или доступной локальной
  задачи нет. Остаток: обычная Prodamus790/recurring/cancel и реальная почта
  (включая выбор password/setup-link), рабочие flags/старые материалы по отдельному
  разрешению, реальные VK/сезоны/контакты, target-load/devices/pilot. Второй S3
  principal отложен и не является обязательным блокером. Frontend/design,
  generated types, сервер, рабочая DB/S3 и runtime не менялись; no push/deploy.
  Проверка этого среза — docs/diff и review статусов; runtime tests не повторять
  на неизменном коде. Следующий AG-ID остаётся AG5/AG9, нужны указанные внешние
  условия/решения, а не новые функции. История прежнего состояния: локальная матрица ТЗ,
  owners/условия/версии и порядок приёмки подготовлены в runbook. Общий candidate,
  целевой schema/restore/rollout и реальные provider/mail/devices/target-load/pilot
  остаются непринятыми. Local frontend integration/API/S3/load уже проверены FE/CF/
  VU/AG9-L; второй S3 principal и старые public URL остаются отдельными границами.
  Для выбранного fresh-only пути старая migration history не нужна.
  Автоматические внешние действия запрещены.
  Проверка: docs55/diff exit0; новая runtime/native/provider приёмка не заявлена.

### AG9 — локальная цепочка регистрации/подписки, 14 октября 2026

По отдельному разрешению пользователя поднята собственная одноразовая MySQL 8.4:
backend_test, loopback 33381, tmpfs, без volumes; чужие контейнеры не затронуты.
Новый registration-subscription-flow.mysql.test проверяет один аккаунт через
настоящие HTTP/cookie/JWT/SQL/Nodemailer и loopback SMTP: register/retry → setup
link once → login → normal checkout/replay → signed webhook/replay → access →
вторая покупка/продление → pending cancellation → confirmed cancellation → expiry.
Проверены отказ неверной подписи, отсутствие доступа от pending, неизменность
пароля/сессии/роли после оплаты, сохранение оплаченного срока при отмене.
Provider cancellation — строгий double; checkout URL не посещается, внешний HTTP
в новом тесте запрещён. Фабрика API не запускает scheduled workers и не читает env
файлы; команда запускает тесты с чистым окружением и явной test-only БД.

Результат: новый сценарий 1 pass; существующие registration/registration-retry/
normal-checkout-recovery/nest-billing-webhook/billing-settlement/identity —
94 pass/6 files, skips0. TypeScript exit0. Runtime-дефекта не найдено: production
код не менялся, добавлена воспроизводимая интеграционная проверка. Это API-цепочка,
не browser/provider/external email acceptance и не репетиция рабочей истории БД.
Фронт/рабочая БД/настройки/реальные платежи и письма не затронуты.
После проверки owner label/id/loopback/tmpfs свой контейнер остановлен и удалён
через --rm, синтетические данные в памяти уничтожены; foreign diplom-postgres
не затронут. SMTP/API/SQL соединения закрыты harness. Docs56/format/diff exit0.

Продолжение 14 октября: тот же native flow расширен восстановлением пароля после
двух оплаченных заказов. До proof старый пароль/сессия работают; после proof
старый пароль отклонён, старый cookie не читает recovery status (401) и не имеет
club access. Ссылка однократная, завершение reset не выдаёт сессию. Новый вход
возвращает прежний оплаченный срок, paid rows не изменены, sessionVersion +1;
отмена/истечение после reset также проходят. 1 расширенный flow pass (1.83 s),
без пропусков; production код не менялся. Это local API/SQL/SMTP, не browser или
external provider. Свой tmpfs стенд loopback 33382, test-only окружение; фронт и
рабочая БД не затронуты. Предыдущие 94 неизменных проверки не повторялись.
TypeScript/docs56/diff exit0. Свой контейнер после повторной проверки label/ID/
loopback/tmpfs остановлен; --rm removal подтверждён, SMTP/API/SQL закрыты.

14 октября, оплаченный аккаунт/блокировка: native flow расширен реальными
moderation.blockUser/unblockUser и club post fixture. Старая cookie/Bearer →401
для club.list; savedPosts/interactions/checkout/status также закрыты, auth.me
возвращает user:null, login401. feed.getById возвращает штатное отсутствие поста
(200/undefined), без club body. Блокировка увеличивает sessionVersion, пишет
audit и ставит cancellation в очередь, но не меняет paid rows/срок. Signed
receipt replay при блокировке422 без новых receipts/периодов; после unblock
старый cookie остаётся revoked, только новый login восстанавливает доступ с тем
же сроком. Runtime-дефектов нет: исправлено лишь неверное ожидание login403 в
тесте (политика generic401 сохранена). 24 pass/2 native suites/skips0 (3.01 s),
после усиления hidden-post assertion focused1 pass (2.05 s); TypeScript exit0.
Own loopback33383/tmpfs/backend_test, clean env, SMTP loopback, HTTP egress guard;
фронт/рабочая БД/provider/внешние письма не затронуты. Это selected API acceptance,
не закрытие всех media/working release gates.
Review/format/docs56/diff exit0; свой контейнер удалён после owner/ID/tmpfs
проверки, отсутствие подтверждено. API/SMTP/SQL закрыты; foreign container прежний.

14 октября, SMTP refusal/retry: own native flow теперь начинает с реального
RCPT550 loopback SMTP. sentAt/discardedAt null, delivery_failed/attempts1/backoff;
три concurrent register retries возвращают прежний202 «Запрос принят», без
session/sent claims, и сохраняют account/name/role/password/sessionVersion,
тот же token и mail/backoff. После восстановления SMTP тот же outbox ID принят
(attempts2/sentAt), одна копия письма; setup once → login → остальной paid flow
проходит. 17 pass/2 suites/skips0 (4.24 s), TypeScript exit0. Runtime дефектов нет,
production/frontend/рабочая БД неизменны; only own backend_test/tmpfs/loopback33384
и SMTP, clean env, запрет внешнего HTTP. Это не приёмка внешнего почтового ящика.
После проверки owner label/ID/binding/tmpfs контейнер остановлен и удалён --rm;
SMTP/API/SQL закрыты, synthetic data уничтожены, чужие данные/volumes не затронуты.

### Зафиксированные ограничения

- Локальный candidate `0e8da4b`; последний проверенный staging `81e8563`.
  Новый fetch не выполнялся; версия сервера не установлена. Ветки не переключать/
  сливать автоматически; старые SHA в датированных разделах — история.
- Документ фронтендера: пункты 1–4 реализованы локально; пункт 5 частично.
- AR1/AR2/CF frontend recovery подключены локально; generated contract86 процедур.
  Доказательства article key/retry/reload в CF-F2; не назначать повторно без дефекта.
  Новые video UI/reload/playback и общая device matrix остаются отложенными.
- Email и private-files остаются default-off. Старые public-read URL сохраняются.
- A6/AR native доказательства есть в истории: старые пустые галочки не означают,
  что надо заново писать реализацию или без причины повторять успешные проверки.
- ТЗ/переписка сверены по сохранённым источникам; первичный PDF/полный экспорт
  не доступны. Новую трактовку не выдавать за прямое требование договора.
- Жалобы/browser/mobile отложены. Разрешённая внутренняя frontend-интеграция
  выполнена без дизайна; старые файлы, рабочие данные, push/deploy и внешние
  действия исключены. Полный перечень ограничений — в плане.

### Формат записи после среза

`AG-ID — статус; результат; commit; проверка/exit/pass/skip; предел доказательства;
блокер (если есть); следующий AG-ID.` Обновлять соответствующий пункт выше,
не размножать очереди. Если всё доступное завершено, сообщить зависимости и остановиться.

## История: не текущая очередь

Записи ниже сохранены без потери прежних результатов. Их старые поручения,
предложения и будущие шаги подчинены активному плану выше.

## VK API access — 13 октября 2026

- [x] Native current post-media VK gates:8 new HTTP/JWT/own SQL cases, final
  content/video persistence53 pass2 suites2.21s, root types pass. No external VK.
  Existing gates pass; no production/auth/frontend/schema changes claimed.
- [ ] Standalone video classification contract: approve additive public/club
  (old rows public), live canonical access in list/detail, no club anonymous
  stream/worker bypass; owner setting/source identity need agreed contract.
  Existing mandatory youtubeId/public-only catalog is not a club video model.

## Article-create-recovery — 13 октября 2026

- [x] Подготовить proposed серверный контракт:
  [SPEC-article-create-recovery](../SPEC-article-create-recovery.md), без кода/фронта.
- [x] Human approval optional UUID key, numeric replay, read-only status,
  отдельный ledger без TTL; затем schema review и малые RED/GREEN срезы.
- [x] Approval for local backend inferred from direct «я спать а ты делай дальше»
  after contract proposal; no working rollout/ frontend authority added.
- [x] AR1: additive 0029/actor-scoped keyed atomic article/teaser creation;
  native replay/conflict/delete/concurrent/rollback verification.
- [x] AR2: read-only status + native lost-response/restart/auth/schema checks;
  frontend artifacts untouched, handoff describes pending client integration.
  Final native/affected123 pass6 suites7.21s; RED3+RED2 before implementation.
  Two independent compiled processes, 12 concurrent calls, actual SQL locks,
  teardown/rollback/error/key/authority cases. Types/build486.3kb/boundaries623/
  docs55/diff pass. check:api intentionally stale until frontend handoff, not green.
  Final default2328 pass/1240 skips (3573),55.84s, types pass. Read-only preflight
  retains exactly0017–0019 manifest blockers; no DB inspected/migrated.
  Code e8ba8fd; own harnesses/pools closed, exact ownership/mount/loopback checks
  before stop/--rm of disposable DB; only unrecoverable synthetic data removed.
  Working resources/front/push/deploy untouched.
- [ ] AR rollout: reviewed history/schema0029 + retention/account deletion/export;
  frontend-generated types/key persistence/reload acceptance by frontend developer.
- [ ] Native HTTP/SQL concurrency/lost reply/restart/conflict/rollback/delete/
  current authority acceptance. Browser reload не считать закрытым без клиента.

## Текущее поручение — 13 октября 2026

Подтверждён пользователем список «Задачи_бэкендеру_2026-10-12.md», начать с3.
Local feature branch, без push/deploy/рабочей БД/автоматического включения.

- [x] M2a local read-only post_media proxy: native HTTP/JWT/SQL RED/GREEN,
  default-off/no provider on denied, stream/HEAD/single range/abort/revocation;
  types/build/boundaries/docs/review/local commit. Не frontend/upload/old URL switch.
  Native48; final content/deletion affected99 pass/3 suites (3.39 s), default2327
  pass/1208 skips (3540, 55.37 s) before three extra opt-in cases; production
  unchanged afterwards. Types/build479.9kb/boundaries622/API73 pass; flag off.
- [ ] M2b actual private S3/browser rewrite acceptance: после M2a и test-only
  локального S3 endpoint/bucket/connection, без working bucket credentials.
- [x] M2a hardening: own10s header deadline/connection5s; data-flow idle30s,
  progressing40s stream remains complete, timer/listener/upstream cleanup;
  JSON416/503 no longer inherits file MIME/disposition. RED1/RED1/RED9;
  full102 pass/4 suites (85.94 s), final100 pass/2 already checked long-case filters
  (14.50 s), types/build480.5kb/boundaries622/API73/format pass. Only new route.
  Final default2328 pass/1213 skips (3546), 58.16 s; docs54/diff pass. Own fixture
  resources closed and verified disposable container removed; no working writes.
- [ ] M2c upload→associate→proxy URL + old object rollout: отдельный review,
  schema/public/shared map/backup/rollback approval; пока не реализовывать.

- [x] Пункт3 локально: ID/наличие/публикация/доступ проверяются перед like/save
  внутри транзакции; actor/post locks, общий club policy и та же SQL-сессия.
  RED2 → native30; final affected HTTP/JWT/SQL103 pass (8.44 s), default2308
  pass/1140 opt-in skips (3453), exit0, 50.50 s; types/build/boundaries618 pass.
  Invalid/missing/hidden/draft/scheduled/expired клуб denied без записей;
  public без оплаты/staff доступ/concurrent20/21 toggles сохранены. Старые строки
  недоступных реакций автоматически не удаляются. Evidence — начало plan.md.
  Final types/build/docs54/focused format/diff pass; own scoped fixtures/Nest/
  pools/verified labelled loopback/tmpfs cleaned; no working data/resources.
- [x] Пункт2 локально: public feed/both comment read доступен авторизованным
  без оплаты; club проверяет прежнюю policy в сервисе, guest/blocked denied,
  hidden/draft/scheduled/missing не выдают обсуждение. Сроки добавления прежние.
  Native RED2 → GREEN32 → final affected HTTP/JWT/SQL110 pass (7.65 s);
  default2308 pass/1147 opt-in skips (3460), 55.82 s; types/build/boundaries618/
  focused format/diff pass. Own fixtures/pools/verified disposable DB cleaned.
  API response прежний; native browser/staging/provider этим не закрыты.
- [x] Пункт1 локально: additive hasClubAccess + прежний subscribed/paid/owner
  контракт; moderator без оплаты открывает club/profile, видит служебный доступ,
  не получает owner rights/paid marker/expiry/cancel/renewal controls.
  Native API/parser/browser RED1 каждый; focused59, native81, final production
  browser2 (390/1440 px, service→paid fixture→role removal), owner-only read403.
  Default2312 pass/1151 skips, 52.50 s; types/builds/lint/API73/boundaries618 pass.
  Дизайн сохранён; own synthetic resources cleaned, no provider payments/rollout.
- [x] Пункт4 локально, backend-only: WorkerJobs binding delivery/maintenance
  в прежнем cadence30s; default-off до flag=true и schema presence/index guard.
  RED1 → native10, final affected78 pass/7 suites (7.12 s), default2317 pass/
  1163 opt-in skips (3485), 53.88 s; types/build/boundaries619/format pass.
  Реальные own SQL/loopback SMTP retry-delay/expiry/purge и partial schema refusal;
  ошибки не прекращают другие branches, single-flight/stop сохранены.
  Frontend не менялся; A7 preflight/rollout/external inbox acceptance не закрыты.
- [x] Фронт, follow-up13 октября: cancellation controller не принимает service
  content access за paid subscription. Browser RED1 → GREEN2, 26 existing
  cancellation UI cases pass; default2312/1153 skips, 53.40 s, types/build/lint/
  boundaries618/focused format/diff pass. Controlled API, не provider/SQL приёмка;
  design/backend/API unchanged, own browser/HTTP/frontend resources closed.
- [ ] Пункт5: actual isolated S3/private delivery, прежние storage/rollout gates.
  Backend-only review13 октября: public-read/direct persisted URLs обходят app
  content checks; working bucket anonymous access не проверен. Safe key fix:
  RED4/RED6 → storage14 actual SDK PUT/loopback exact-byte GET; focused70 pass.
  Encoding сохраняет exact key, unsafe empty/dot/backslash/control rejected до
  effects. ACL/auth/frontend/old URLs не менялись; пункт5 остаётся незавершённым.
  Default2327 pass/1163 skips (3495), 52.81 s; types/build/boundaries619/docs54/
  focused test format/diff pass. Own HTTP fixture closed, no working storage.

Автоматизация остаётся удалённой; это возобновление работы по прямому поручению,
не подтверждение готовности первого этапа и не реальная платёжная приёмка.
**Уточнение 13 октября 2026:** пользователь отменил привязку email старым
телефонным аккаунтам: приложением ещё никто не пользовался. Фронтенд этого
сценария удалён. A1–A7 и записи о привязке ниже — история, не активная очередь
фронтендера. Сервер и миграции оставлены бэкендеру; обычный вход/регистрация,
пароль и повтор письма доступа не отменены.

## Активная очередь по ТЗ и фронту — 10 октября 2026

Приоритет и критерии — в начале [плана](plan.md). Пользователь разрешил
продолжать работу по нему самостоятельно. Исторические пункты ниже сохраняются;
их старые статусы выкладки не отменяют свежий release 2e3339c/2210be5.

## Изменение приоритета по поручению пользователя — 12 октября 2026

Жалобы отложены: следующие report account-switch/retry acceptance из C3bj
не выполнять сейчас. Уже сохранённые результаты и исторические записи остаются.
Ближайший крупный блок — M1/M2 (закрытые файлы), затем C2 (полный путь публикации).

- [ ] M1b: локальная object-to-content карта по всем post/article/comment
  references, включая shared public/private, external и unassociated objects.
  Сначала код и synthetic fixtures, без чтения рабочих объектов/секретов.
  Проверка: SQL/JSON fixtures не классифицируют доступ только по prefix или URL.
- [ ] M1c: actual public/private GET/HEAD/range в собственном изолированном
  хранилище; guest/paid/expired/blocked и API/direct URL. Не выдавать local
  acceptance за ACL/policy рабочего bucket. Зависимость: классификация M1b.
- [ ] M2: после M1b/M1c — reviewed closed-delivery contract и первый вертикальный
  срез; не менять ACL глобально/не переносить старые объекты без проверенной
  карты, backup/rollback и отдельной процедуры. Публичные cover/avatar сохранить.
- [ ] C2: если storage-проверка внешне заблокирована, следующий независимый
  крупный блок — native create→attachments→publish/read→edit/delete с сохранением
  frontend design и черновика при сбоях. External uploads отдельно gated.

A7/Q1 migration history/rollout, внешние оплаты/VK и физические устройства
остаются отдельными зависимостями. Автоматических push/deploy/рабочей БД нет.

Autonomous handoff (12 октября МСК): current bounded queue reached review/
external boundary after HEAD3b14446. Recurring continuation removed; chat open,
stage one not declared complete. Resume M1c with selected local S3 endpoint/
dedicated test bucket/test-only connection, or C2n after reviewed recovery/schema
decision. No new reproducible defect in read-only video/attachment transaction
checks; no unchanged tests repeated. Other external/rollout/device gates remain,
complaints deferred and unchecked tasks preserved. Verification checkpoints
remain M1b10 default2308/M1b11 native35, not new handoff test runs.

M1b11 (12 октября МСК): full native article35 pass, exit0, 2.81 s, types pass
on own labelled loopback/tmpfs SQL. Updated stale raw-SQL expected drop after
M1b9 (diagnostic1 fail, not production RED); new HTTP create/real parent omitted
from selected snapshot keeps media/comment unknown paths and guest cover/locked
body, SQL associations/teaser unchanged. Fields-complete is not rows-complete.
Test-only, no production fix; unchanged default/CLI/build/browser not repeated.
S3 details/C2n review/working rollout remain pending.
Fresh types/docs54/format/diff pass; own scoped fixtures/Nest/pool/verified
labelled loopback/tmpfs container cleaned; no working data/foreign resources.

M1b10 (12 октября МСК): RED1 unknown rich-text block link inherited public post
class; now retained as unknown candidate with issue, same public photo doesn't
remove uncertainty. Supported blocks/access unchanged. Focused library/CLI31
pass, exit0, 2.79 s; types/docs54/format/diff pass; default workers2 2308 pass/
1133 opt-in skips (3446), exit0, 51.84 s. Offline-only, no
SQL/S3/working data/resources/renderer change or production disclosure claim.
S3 details/C2n review/rollout remain pending.

M1b9 (12 октября МСК): RED1 lost known URL fields of unsupported article blocks,
same cover made object public-only. Keeps url/urls/photos as unknown candidates
and unknown-shape issue; valid no-cover candidates retained/malformed diagnostic/
source values redacted. Final focused30 pass, exit0, 1.80 s; types pass. Offline
collector-only, not renderer/SQL/S3/full inventory. Default workers2 2307 pass/
1133 opt-in skips (3445), exit0, 53.42 s; types/docs54/format/diff pass.
S3 details/C2n review/rollout dependencies unchanged.

M1b8 (12 октября МСК): RED1 reproduced lost attachment/comment references when
parent missing from snapshot, incorrectly unassociated declared object. Keeps
paths/parent issues as unknown; unknown dominates public/shared aliases without
ACL/deletion decision. Final library/native CLI28 pass, exit0, 2.36 s; types pass,
offline JSON enum change documented. No SQL/S3/working data/providers/resources.
Default workers2 2305 pass/1133 opt-in skips (3443), exit0, 49.51 s;
types/docs54/format/diff pass. C2n review and S3/rollout dependencies unchanged.

C2o (12 октября МСК): native HTTP article create + UI cancelled/committed title
edit/reload keeps cover and six literal block kinds/order/URLs/captions/label/
body; club/published unchanged, same ID/one teaser, one create/one update and
no cancelled write. Final focused1 pass/114 filtered skips (115), exit0, 3.59 s;
test-only characterization/no RED/fix. External asset requests blocked, metadata
association is not S3 upload/delivery/render acceptance. Independent C2 work;
C2n review and local S3 details remain pending, unchanged suites not rerun.
Fresh types/docs54/format/diff pass; own scoped fixtures/Next and verified
labelled loopback/tmpfs backend_test cleaned; no working data/providers/secrets.

C2n (12 октября МСК): source-only audit confirms article create has no durable
request identity; component uncertainSave does not survive reload. Not a native
duplicate-write reproduction. Proposed article-create-recovery needs reviewed
separate request-ledger/schema and owner-bound client recovery contract before
implementation (spec-driven-development gate). Post ledger is only precedent;
do not silently reuse it or deduplicate by title/time. Replay after deletion,
changed payload, current auth and concurrent/late commit need explicit acceptance.
No migration/API/client/working data changes. C2l/m evidence unchanged; S3 and
rollout gates remain, next independent agreed work can continue while reviewed.

C2m (12 октября МСК): delayed real canonical list200 then lost return after
SPA editor unmount or cross-tab logout/member login. No stale alert/reset/
private row/duplicate; new unsent editor retained, honest list retry reads one
actual SQL draft. New focused2 pass/112 filtered skips (114), exit0, 8.98 s;
test-only characterization, not production RED/fix. Diagnostic expected auto
success for lost read/Next announcer alert corrected without timeout changes.
C2l checkpoints retained, no unchanged build/default/full repeats. Durable
article recovery and late commits remain open; M1c/M2 await local S3 details.
Fresh types/docs54/format/diff pass; own fixtures/verified labelled tmpfs
container/Next cleaned; no working data/storage/providers/secrets/deploy.

C2l (12 октября МСК): pending native canonical read after lost committed article
create; SPA view switch/new unsent editor and cross-tab logout/member password
login keep stale response fenced. New editor retained/no stale alerts/member
read403/no private row rendered; one POST/one unchanged SQL row/no unsent row.
Integrated14 pass/98 filtered skips (112), exit0, 59.27 s; final stronger native
ID/title proof focused2 pass/110 skips, exit0, 9.07 s; types pass. Test-only
characterization; diagnostic route403 interception/old-tab logout redirect
expectation corrected, no production RED/fix or timeout changes. No design/
roles/API/deps/working data/providers/storage. Durable recovery/late commits
remain open, M1c/M2 await user's selected S3 details; see C2l plan evidence.
Final types/docs54/format/diff pass; scoped SQL fixtures and own verified
labelled loopback/tmpfs container/Next cleaned, no foreign resources removed.

C2k (12 октября МСК): actual native canonical list200 after lost committed
create/update; only returned IDs corrupted to0, explicit nonempty/positive-ID
proof before injection. Invalid identities retain editor/unknown guard, repeat
Save still one POST/one unchanged row; subsequent unmodified read closes editor
and same-tab canonical list accurate. Final focused2 pass/108 filtered skips
(110), exit0, 8.98 s; types/format/diff pass. Test-only negative transport-fault
characterization, no production fix/RED or native malformed-server claim.
Own labelled loopback/tmpfs/Next cleaned, scoped fixture rows/no working data/
storage/providers/secrets. Unchanged build/default/full110/integrated12 not
repeated; C2j checkpoint retained. Next pending-read account/navigation fences;
durable recovery/late commits and M1c/M2/rollout remain open, await own S3 details.

C2j (12 октября МСК): user requested same-tab cancel after lost article reply.
Native RED2 fail/108 filtered skips (110), exit1, 14.19 s: Cancel cleared form/
unknown state without reading canonical list. Cancel now requires validated fresh
read + owner fence before reset; failed read preserves title/unknown guard and
retry notice. Same-tab list shows actual committed row, repeated Save still one
POST, old update ID/body/club/draft preserved. Focused2 native pass (8.84 s),
stronger notice assertions then final integrated C2/public library12 pass/98
skips (110), exit0, 21.12 s; types/frontend lint/webpack30 pages/boundaries618/
format/diff pass. Default workers2 2302 pass/1128 opt-in skips (3435), exit0,
53.81 s. Reviewed existing session fence/validated read, no effects/new API/
roles/deps/styles. Own tmpfs/Next cleaned; no working data/providers/storage.
Reload/navigation/durable article recovery/late ambiguous commits remain open;
no backend article-idempotency claim. M1c/M2 await own S3 details/review.

C2i (12 октября МСК): native committed article create/update200 then lost return
transport. Title retained, unknown alert/no success claim; repeated Save stays
guarded, only one POST/one SQL draft/old update ID/club access/body retained.
Canonical separate tab sees one row, no retry. Initial focused2 pass/108 filtered
skips (110), exit0, 4.20 s; literal update-body guard added, final integrated
C2/public library12 pass/98 filtered skips (110), exit0, 17.78 s; types/format/
diff pass. Test-only characterization, no production bug/fix/RED claim. Own
labelled loopback/tmpfs/Next cleaned, scoped synthetic article/teaser rows, no
upload/download/storage/provider calls. Unchanged build/default/full110 not
repeated, C2h checkpoint retained. Next unknown cancel → same-tab fresh canonical
list; reload/navigation/durable article recovery and M1c/M2/rollout still open.
Await user's selected local S3 endpoint/test bucket/connection details.

C2h (12 октября МСК): native committed create with ACK held exposed enabled
Cancel/reset before acknowledgement. RED1 fail/107 filtered skips (108), exit1,
8.12 s → Cancel disabled only for save operation (uploads/design/access unchanged).
Fresh webpack build30 pages, types/frontend lint/boundaries618/format/diff pass;
focused1 native pass (3.33 s), integrated C2 + public library10 pass/98 filtered
skips (108), exit0, 15.80 s. Default workers2 2302 pass/1126 opt-in skips (3433),
exit0, 55.36 s. One SQL draft/title retained until ACK/canonical closure. Initial
inline build wrapper worker --e failure corrected via wrapper execArgv, no app
config workaround; no .env read (owned empty build-env dir). Reviewed derived
button state/no effects/roles/API/deps. Impeccable launcher denied; incumbent
context fallback, no PRODUCT/DESIGN artifacts/redesign. Own tmpfs/Next cleaned.
Next actual lost reply/cancel/canonical-read recovery; refresh/navigation/durable
article recovery and M1c/M2/provider/rollout still open. Await own S3 details.

C2g (12 октября МСК): native article editor draft create/reload/cancel edit →
publish same ID/public canonical body via guest HTTP → cancel delete keeps row/
club teaser → confirmed delete removes both/reload absent. Existing visibility
semantics preserved, no upload/banner/storage fetch. Shared existing article
schema fixture reused; test-only, no API mock. Diagnostic initial SQL read before
ACK failed (3.70 s); fixed test to wait for form closure, no production fix/timeout
bump claim. Focused1 pass/106 filtered skips (107), exit0, 4.67 s; integrated
C2 + public library9 pass/98 filtered skips (107), exit0, 15.00 s; types/format/
diff pass. Own labelled loopback/tmpfs/Next cleaned; scoped synthetic rows only,
no working data/providers/secrets. Unchanged build/default/full107 not repeated.
Next unknown-result article writes/cancel during pending write; code risk not yet
confirmed bug. M1c actual storage/M2 review/rollout wait for selected local S3 data.

C2f (12 октября МСК): native UI/Nest/SQL existing attachment association ACK/
lost-reply acceptance. Own synthetic draft + PDF/audio: cancel removal keeps both
without POST, saved removal deletes only PDF, audio full metadata/ID retained.
Committed update lost reply blocks Save/retains unknown editor; separate canonical
tab reads remaining attachment, one update total, draft/text/id/identity unchanged.
Focused2 pass/104 filtered skips (106), exit0, 6.13 s; integrated C2 browser7
pass/99 filtered skips (106), exit0, 10.49 s; types/format/diff pass. Anchored
filter initially selected 0/106 skips (not GREEN), corrected filter only. Test-only
characterization, no production bug/fix/RED claim. Own labelled loopback/tmpfs/Next
cleaned, scoped SQL rows/no upload/download/external URL fetch/providers/secrets.
Unchanged build/default/native106 not repeated. C2 upload/storage/article UI and
M1c actual object/principal matrix remain open. Next native article editor UI;
await user-selected local S3 endpoint/bucket/test-only connection details.

M1c handoff (12 октября МСК): user selected own ready local S3 stand, not source
build. Await endpoint/dedicated test bucket/test-only connection method requested
in chat; no secrets/env/account read or repeated image pulls/build. Empty running
Docker list doesn't rule out host S3. Actual object/principal matrix still blocked.
Independent C2 read-only audit: native browser draft CRUD/create lost-reply replay/
schedule exists; attachment metadata/preservation SQL exists, but admin browser
existing audio/document remove/save/reload/lost update association case absent.
Next own synthetic draft + two media rows → labels → cancel remove keeps SQL →
save removal of one keeps remaining metadata → reload → lost committed reply/
canonical recovery. No upload/download/storage URL fetch or object-ready claim.
No new production bug/fix/test outcome asserted; docs-only checkpoint.

M1b7 (12 октября МСК): full selected-source stdin envelope + explicit declared
inventory mapping. Missing source/text/richText fields reported; field coverage
not all-row/object coverage. Exact hash aliases only, ambiguous identity rejected;
public/restricted/shared/external/unresolved and unassociated-in-snapshot (never
orphan/delete authorization). Legacy articles CLI/1 MiB/generic errors retained.
RED CLI1 fail/9 pass (1.13 s), object map2 fail/10 pass (1.21 s) → native CLI/
library25 pass (1.57 s), types pass; default workers2 2302 pass/1122 opt-in skips
(3429), exit0, 51.76 s. Reviewed declared identities/linear lookups, no orphan
authority or rollout automation. No working data/env/storage changes or new deps.
M1c runtime blocker: official MinIO pinned release quay401, Docker Hub pull denied,
official archived arm64 binary410. No container created or mock readiness claim.
User asked for official-source isolated build vs own S3 test stand. Actual API/
direct GET/HEAD/range guest/paid/expired/blocked still open, M2 contract review
not bypassed. Working inventory/rollout also remain separately gated.

M1b6 (12 октября МСК): optional selected decoration snapshot: public avatar/
season URLs and published video URLs; unpublished video refs restricted. Shared
club/public decoration collision never silently privatizes avatar/catalog/theme.
Strict URL-only fields/unique identities/row limits; unexpected personal fields
rejected, no actual PII/DB/config read. RED2 fail/11 pass (172 ms) → focused22
pass (881 ms), types pass; default workers2 2299 pass/1122 opt-in skips (3426),
exit0, 48.97 s; docs/format/diff pass. Reviewed selected URLs/IDs, partial scope,
no ACL/API change. JSON/library only; unchanged native34 checkpoint
retained, no fresh SQL/browser/storage/ACL claim. Next complete-input CLI and
explicit owned object inventory/identity/external resolution. M1b/M1c/M2 open,
no working data/providers/permissions/dependencies changed.

M1b5 (12 октября МСК): raw post text URL candidates/richText links + club comment
photos merged with selected article/post/media groups. Comment photos remain
restricted for feed parents too; missing parent/unknown fields/malformed blocks
diagnosed, duplicate comment identities rejected. Plain text candidates explicitly
not rendered links; scope content-references-partial-no-object-inventory.
RED3 fail/4 pass (220 ms) → new sources; compile circular inference resolved by
explicit report type. Found empty photo URL silently omitted: RED1 fail/9 pass
(143 ms) → invalid-url. Final focused19 pass (852 ms), native article34 pass
(2.06 s), types pass; default workers2 2296 pass/1122 opt-in skips (3423),
exit0, 48.16 s; docs/format/diff pass. Reviewed selected fields/IDs, generic
errors, partial scope/redacted merge, no auth/endpoint/ACL changes; own tmpfs
container cleaned. Real SQL writer→auto teaser + synthetic comment shared URL,
rows/associations/identity unchanged. Own labelled loopback/tmpfs only; no working
data/ACL/providers. CLI remains articles-only; next global refs/full-input CLI/
object identity/inventory. M1b/M1c/M2 remain open, no object/browser readiness claim.

M1b4 (12 октября МСК): library-only post photos/post_media reference collector;
same redacted exact-URL helpers as article map. Published feed/both public;
club/draft/scheduled/unpublished restricted. Missing parent in selected snapshot
and malformed photos JSON explicitly diagnosed, never assumed orphan/approved.
Capability RED4 fail (155 ms) → article/post13 pass (849 ms), types exit0.
Default workers2 2290 pass/1122 opt-in skips (3417), exit0, 47.78 s; docs/format/
diff pass. Reviewed shared helpers/unchanged article contract, no new deps.
Strict metadata/unique IDs/row limits, no raw URLs or DB/env/network/ACL changes.
Existing article stdin CLI unchanged; scope photos/media-only. Next text/richText/
comment/global references and cross-source grouping, then object inventory.
M1b/M1c/M2 remain open; no fresh SQL/browser/storage readiness claim.

M1b3 (12 октября МСК): raw SQL selected article fields accepted by collector
without normalized DTOs. Native mysql2 SQL0/1 and JSON arrays preserve shared
public cover/restricted draft/club references and unknown future-block issue;
no signed fixture value in report, repeated SELECT unchanged, guest detail
public/locked behavior unchanged. Focused1 pass/33 filtered skips (34), exit0,
1.34 s; full article34 native pass, exit0, 2.27 s; types pass. Test-only
characterization passed immediately, no production fix/RED claim. Own labelled
loopback/tmpfs backend_test only; no working DB/object/secrets/provider actions.
M1b remains partial; next post/post_media/comment cross-source grouping,
then object resolution/inventory. M1c/M2 remain gated. Unchanged default/build/
browser not repeated; M1b2 checkpoint retained.

M1b2 (12 октября МСК): offline articles-only reference collector, stdin JSON
без DB/env/network/storage, SHA256 exact URL groups public/restricted/shared,
legacy/markdown links и unknown/malformed/query diagnostics. Published cover
не закрывается молча; signed query не печатается и не нормализуется в object.
RED/GREEN stub6 fail→6 pass; object type coercion1 fail→7 pass; null URL array
item1 fail→9 pass. Final focused9 pass (873 ms), types exit0; default workers2
2286 pass/1121 opt-in skips (3412), exit0, 52.23 s. CLI malformed/oversize input
returns generic error/no partial stdout. Reviewed byte/row limits, generic errors,
no ACL writes. M1b still partial: next synthetic SQL selected article rows, then
post/media/comment/global refs and object inventory/resolution. M1c/M2 not ready;
no production change, SQL/browser/object access claim or working data accessed.

M1b1 (12 октября МСК): partial read-only classification, не complete M1b/M2.
Native admin article writer creates cover/section shared URL plus auto club
teaser reference; guest locked article still exposes cover, admin sees sections.
Native SQL/HTTP1 focused pass (1.49 s), article suite33 pass (2.88 s), associations/
identity unchanged. Updated existing media map with exact SQL/JSON/link/legacy/
season paths and public/both/locked-cover exceptions; no prefix-derived ACL.
Types/format/diff pass; no production change, object GET or working-bucket leak
claim. Owned labelled loopback tmpfs cleaned, no secrets/providers/deploy.
Next: synthetic SQL/JSON read-only collector with incomplete/unknown diagnostics,
then M1c isolated storage GET/HEAD/range; M2 contract reviewed before delivery/ACL
changes. Жалобы остаются отложены, прежние A7/Q1/external gates сохранены.

C3bj (12 октября МСК): C3 map showed existing native search/saved/login and
comment edit/delete coverage but no member report submission UI acceptance.
Test-only report ACK/lost native reply cases: actual Nest/SQL report200/ok:true,
one POST/one reporter row, original comment/both users/member access retained;
ACK alone shows success notice, lost committed reply shows unknown-result alert
without success notice. Initial broad locator matched two legitimate alerts
(diagnostic/not production RED); scoped role=alert first fixes selection, not UI.
Integrated comments6 native pass/98 filtered skips (104), exit0 (8.82 s).
Types/format/diff pass; no production bug/change or fresh full104/default claim.
Previous C3bi full102/default2277 checkpoint retained, unchanged builds/lint/API
not repeated. Owned labelled loopback tmpfs/Next cleaned, local-only/no external
messages/providers/working data/secrets. Next: native report ACK held across
account switch, then explicit same-owner retry/idempotency after unknown result.
A7/Q1/storage/atomicity/provider/device gates remain open.

C3bi (12 октября МСК): native loopback slow/fast responses with page fallback
reproduced prior proxy route.fulfill already handled deterministically: RED1
fail/1 pass plus3 unhandled rejections (1.50 s), context-only control passed.
Page unroute before context proxy drain continued outstanding forwarded routes.
Canonical removePageRoutes drains proxy first; drainBrowserRoutes applies both
layers and a final drain. Native suite teardown and club/profile intermediate
route removal use it; no swallowed errors/timeout bumps/application changes.
Final loopback2 pass, exit0 (1.89 s), both actual response bodies/cardinality and
zero fallback GETs asserted. Full102 native browser/API/SQL/loopback SMTP pass,
exit0 (97.73 s), no unhandled errors; types/format/docs54/diff pass. First default:
2275 pass/2 timeout failures/1118 opt-in skips (3400), exit1 (60.79 s), both
unchanged compiled local Prodamus process tests exceeded5 s. No timeout bump;
Full default with bounded workers2:2277 pass/1118 opt-in skips (3400), exit0
(90.14 s), both unchanged process tests included, no timeout changes/skips added.
Own labelled tmpfs/Next cleaned, local commit/no push.
No unchanged app rebuild/lint/API repeat.
Next: current C3 coverage map against frontend WORK_PLAN/code/native tests,
then next independent comments/saved/search scenario. A7/Q1/storage/atomicity/
provider/device gates remain open.

C3bh (12 октября МСК): equivalent profile editor native held POST commits ACK
name while pre-write same-owner GET renders intermediate identity (existing-cache
reconcile proves React receipt; draft remains unchanged), then ACK delivered and
post-write refresh lost/newer. Native RED1 fail/1 pass (8.18 s) for lost refresh:
save-start source discarded confirmed name display. Latest committed user ref
via layout effect is now read at native ACK, after owner fence, not after refresh.
Newer server snapshot still supersedes UI/cache. New206-line ordering helper
reuses exported test fixture type; profile917 helper not grown. Profile9 native
pass/93 filtered skips (102), exit0 (6.29 s); one POST, SQL/cache/identity/access
verified. Webpack/types/lint/format/boundaries618/diff pass. First full102:
101 pass/1 fail and one unhandled rejection (83.69 s), generic native proxy
route.fulfill already handled during existing club held ACK/account switch;
unchanged targeted switch+profile10 pass (7.49 s). No suppression/timeout bump
or harness-fix claim. Repeated unchanged full102 native browser/API/SQL/loopback
SMTP pass, exit0 (83.80 s); fresh default2277 pass/1117 opt-in skips (3399),
exit0 (26.11 s), docs54/diff pass. Own tmpfs/Next cleaned, local commit/no push.
No CSS/markup/API/auth/roles/quota/subscription changes.
Next: reproduce page/context route-drain ordering in isolated loopback fixture,
then return to current C3 coverage map against frontend WORK_PLAN/code/native
tests and select the next independent comments/saved/search scenario; do not
invent more ordering permutations or repeat unchanged successful checks.
A7/Q1/storage/atomicity/provider/device gates remain open.

C3bg (12 октября МСК): held native profile POST commits while a pre-write
auth read renders an intermediate same-owner name, then ACK delivered and next
native refresh reply lost. Save-start callback discarded ACK display (RED1 fail,
7.73 s). Initial fixture locator typo repaired/not production RED. Latest handler
ref fixed loss but replaced a genuinely newer post-write server snapshot (second
native variant RED1 fail/1 pass, 8.39 s); handler is now pinned at native ACK, not
save start or refresh completion, via latest committed layout-effect callback ref.
CLI executable-path typo repaired/not production RED. Integrated club19 native
pass/81 filtered skips (100), exit0 (19.32 s); lost refresh shows ACK name/female,
newer refresh shows native newer name/male, one POST, scoped ACK preferences,
identity/access unchanged. Webpack/types/lint/format/boundaries618/diff pass;
full100 native browser/API/SQL/loopback SMTP pass, exit0 (81.77 s), fresh default
2277 pass/1115 opt-in skips (3397), exit0 (22.87 s), docs54/diff pass. Owned
labelled loopback tmpfs/Next cleaned, local commit/no push. No CSS/markup/API/auth-controller/roles/quota/
subscription/provider changes. Next: equivalent profile-name editor mid-write
same-owner snapshot plus lost post-write refresh; use focused ordering helper,
do not grow profile917 or club802 helper without decomposition. A7/Q1/storage/
atomicity/provider/device gates remain open.

C3bf (12 октября МСК): club setup pre-write native auth/me held after reading
old name/null gender; profile.update200 commits chosen identity, but ordinary
refresh deduplicated against old GET (RED1 fail/97 filtered skips, 8.03 s).
Dialog now reuses canonical owner-bound refreshAfterMutation after ACK/cache
fence, preserving pending-login/closed-owner policy. Integrated club17 native
pass/81 filtered skips (98), exit0 (17.86 s), one POST, fresh native snapshot,
greeting/cache/SQL chosen name/female, identity/paid rows unchanged. Webpack/
types/lint/format/diff pass; full98 native browser/API/SQL/loopback SMTP pass,
exit0 (81.80 s); default2277 pass/1113 opt-in skips (3395), exit0 (26.30 s),
docs54/diff pass. Own labelled tmpfs/Next cleaned, local commit/no push. No CSS/markup,
API/controller/roles/quota/subscription changes or screenshot/provider claims.
Next: same-owner pre-write read delivered while setup POST/ACK is still held,
then post-write refresh lost; inspect captured confirmation callback reference.
This distinct ordering is not declared fixed. A7/Q1/storage/atomicity/provider/
device gates remain open; no working data/secrets/external actions.

C3be (12 октября МСК): native auth/me read held after reading original SQL,
then profile.update200/native commit; save incorrectly deduplicated against that
pre-write read (RED1 fail/96 filtered skips, 7.53 s). Initial missing paid fixture
prevented profile entry and was corrected, not production RED. Additive canonical
refreshAfterMutation(ownerId) supersedes reads only for the still authenticated
owner, never a pending login/closed session. Profile editor uses it after ACK;
no force-refresh escape exposed to screens or full-user optimistic replacement.
Controller32 pass (0.334 s), profile7 native pass/90 filtered skips (7.65 s),
full97 native browser/API/SQL/loopback SMTP pass (90.85 s), one POST, current UI/
cache, identity/paid rows preserved. Webpack/types/lint/format/API73/boundaries618
pass. First concurrent default run: 2276 pass, one compiled local harness timeout
at5 s (35.25 s); isolated unchanged harness1 pass (1.53 s), standalone final
default2277 pass/1112 opt-in skips (3394), exit0 (36.32 s); docs54/diff pass.
Own labelled tmpfs/Next cleaned, local-only/no providers/working data/secrets.
Next: club setup with a pre-write pending auth read (not yet declared fixed);
move further ordering cases to a focused helper before growing profile helper917.
A7/Q1/storage/atomicity/provider/device gates remain open.

C3bd (12 октября МСК): native profile ACK/lost auth refresh→server restores
original name/equal-value native snapshot left ACK name/cache stale, RED1 fail
(7.79 s). Initial executable-path typo repaired/not production RED. Confirmation
and existing-cache reconcile now keyed to confirmed user snapshot reference,
owner/cancelled/absent-cache guards intact, no draft/auth/roles/access changes.
One POST, restored UI/cache and identity/paid rows verified; profile6 pass (10.44 s),
final96 native browser/API/SQL/loopback SMTP pass (83.13 s); default2274 pass/
1111 opt-in skips (27.69 s), webpack/types/lint/format/diff pass. No CSS/markup/
imports/API/boundary change or new screenshot claim. Own tmpfs/Next cleaned,
local commit/no push/providers/working data/secrets. Next: native same-owner auth
read already pending before save; do not bypass login ordering with force refresh
without evidence. A7/Q1/storage/atomicity/provider/device gates remain open.

C3bc (12 октября МСК): native server name=NULL/auth-me:null revived cached setup
greeting, RED1 fail (8.31 s). One-line confirmed-user name selection honours null;
ACK override and later native name/male recovery preserved, one POST, identity/
paid rows unchanged. Integrated club9 pass/86 filtered skips (95), exit0 (11.93 s);
default2274 pass/1110 opt-in skips (28.05 s); webpack/types/lint/format/diff pass.
No CSS/import/API/boundary changes, no new full95 claim (C3bb checkpoint retained).
Own tmpfs/Next cleaned, local commit/no push/working data/providers/secrets.
Next: profile-name editor equal-value auth refresh after ACK; A7/Q1/storage/
atomicity/provider/device gates remain open.

C3bb (12 октября МСК): native RED ACK+SQL save→lost native auth/me return kept
old greeting (8.07 s). Temporary acknowledged name/gender override tied to auth
snapshot reference; next confirmed GET supersedes it even with original values,
no auth/roles/subscription rewrite. Additional RED server gender=NULL masked by
cached gender (7.85 s) fixed; native restore original values/new server name/male
verified with one POST, cache/SQL/credentials/access intact. Focused1 pass (6.13 s),
final95 native browser/API/SQL/loopback SMTP pass (83.57 s); default2274 pass/
1110 opt-in skips (27.44 s), webpack/types/lint/format/API73/618 boundaries/diff
pass. Original 390/1280 club layout/banner inspected/no CSS change. Own tmpfs/
Next cleaned; local commit/no push/providers/working data/secrets. Next: null
server-name fallback and profile-name editor equal-value refresh, native proof;
A7/Q1/external storage/atomicity/provider/device gates remain open.

C3ba (12 октября МСК): test-only paid member setup→synthetic JWT revocation
sessionVersion1→native profile.update401→private dialog gone/guest email gate.
One POST, no name/gender/completion cache or SQL draft, credentials/roles/access
unchanged after intentional revocation. Initial gated-login/duplicate guest-field
locator assumptions corrected from actual DOM, diagnostic logs removed, native
denial/SQL assertions not weakened/no production defect claim. Integrated8 pass/
86 filtered skips (94), exit0 (7.48 s); types/format/diff pass. No production/
build/default changes or whole94 claim. Own tmpfs/Next cleaned, local commit
only/no external effects. Next: save ACK then failed native identity refresh;
photo storage/atomicity/A7/Q1/provider/device gates remain open.

C3az (12 октября МСК): test-only native same-origin remote avatar cache migration:
missing server avatar→one native POST200/exact SQL URL; existing confirmed server
URL retained against different cache/zero POST. Zero uploadAvatar, name/gender/
identity/paid rows unchanged. Initial fresh DB-not-ready suite failure (93 skips)
resolved after ownership/health proof, not production RED. Focused2 pass (3.70 s);
integrated club setup/direct-entry/avatar7 pass/86 filtered skips (93), exit0
(7.09 s); types/format/diff pass. No production/build/default/UI changes or
whole93 claim; C3ay full91 retained. Own tmpfs/Next cleaned, local commit only.
Next: setup auth/refresh failures; external avatar upload/atomicity/A7/Q1/provider/
device gates remain, no new fix/security/provider-readiness claim.

C3ay (12 октября МСК): explicit user request, native RED3 fail: setup closed
before ACK on lost-before-SQL/lost-after-native-commit/held late reply. Focused
dialog owns canonical lock/signal/current-owner fences; direct chosen draft to
native API, scoped completion/name/gender/avatar cache and close only after ACK.
Disabled close/fields/choices while saving, retained draft/error/manual retry,
no automatic resend. Native retry one next POST200/cache+SQL verified; held
member commit→native admin switch→release cannot publish old setup/cache/greeting.
Credentials/roles/paid rows unchanged. Separate test helper; initial missing
PenPals Dialog import repaired/no unrelated UI changes. Focused3 pass (9.25 s),
final91 native browser/API/SQL/loopback SMTP pass (80.76 s); default2274 pass/
1106 opt-in skips (31.17 s), final webpack/types/lint/format/API73/618 boundaries/
diff pass.
390/1280 retained error/retry layout inspected. Own tmpfs/Next cleaned; local
commit only/no push/deploy/working data/providers/secrets. Avatar separate backend
write/external upload atomicity NOT claimed. Next: native avatar-cache migration
without external storage, setup auth/refresh failures; A7/Q1/external gates open.

C3ax (12 октября МСК): native direct /club RED changed SQL name/gender from
stale scoped cache. Required internal includeIdentity=false for mount avatar
migration / true for explicit setup; server name wins in greeting. Native direct
zero POST/unchanged identity; explicit setup one POST200/name+gender committed,
credentials/role/sessionVersion/paid access unchanged. Initial GREEN selector
failures corrected to actual full greeting, no weaker SQL assertions.
Focused2 pass/86 filtered skips (2.71 s); final88 native browser/API/SQL/loopback
SMTP pass, exit0 (77.85 s); default2274 pass/1103 opt-in skips (27.65 s).
Webpack/types/ESLint/format/API73/617 boundaries/diff pass, no CSS/redesign,
local commit/no push/deploy/working DB/providers/secrets. Own labelled tmpfs
and Next cleaned after verification. Next: explicit setup lost reply/late account,
avatar migration proof; premature completion cache/modal close and unset-server
gender greeting fallback not claimed fixed. A7/Q1/external gates remain.

C3aw (12 октября МСК): user-authorized primary feature fast-forward71daa65 →
verified staging48f2f7d, no switch/rebase/overwrite. Native RED stale scoped name
overrode auth/me identity. Profile now uses server name with temporary native ACK
override; existing nonempty cache reconciled under owner/cancellation fence,
no cache/completion marker created merely by viewing. Draft retained on native
server refresh, zero implicit writes; prior lost reply/retry/account isolation
preserved. First full85 pass/1 setup-dialog fail caught completion-marker coupling;
fixed cache side effect, unchanged assertion. Final **86 native browser/API/SQL/
loopback SMTP pass, exit0 (75.39 s)**, own tmpfs/no external sending; default2274
pass/1101 opt-in skips, exit0 (27.72 s). Final webpack/types/ESLint/format/API73/
617 boundaries/diff pass; 390/1280 incumbent screenshots inspected/no redesign.
Local commit only/no new push/deploy/working data. Next: direct club-entry legacy
profile sync with stale cache (not claimed fixed), A7/Q1/external gates remain.

I1 (12 октября МСК): user-authorized staging integration from a4b6bbc + feature
71daa65 in separate detached worktree; both histories/125 source commits retained,
frontend design/editor/saved-club navigation preserved. No primary branch switch.
After disk cleanup: frontend/backend build, types/ESLint/format/617 boundaries/
docs/API73/diff pass; default2274 pass /1100 skips, exit0 (32.29 s).
Test-only linked-cli realpath fix (RED→2 pass), Mac native caret shortcut and
bounded ResizeObserver alignment wait (5 initial failures→10 focused pass).
Fresh integrated UI91 pass/1 flag-off skip, exit0 (1.5 min), mocked API only;
separate native browser/API/SQL/loopback SMTP85 pass, exit0 (80.26 s), own tmpfs.
Docker launched only after explicit request. Binding flag true only in local
validation build, rollout still gated. Ordinary user-authorized staging push,
no force/deploy/working DB/secrets/external payment/mail; A7/Q1/customer gates open.

C3av (12 октября МСК): native profile.update200/SQL commit held → native auth/me
confirms switched admin in the same document → release original response.
No late member name/cache, one POST, member commit retained, admin identity/access
unchanged. Test-only, no new production defect/fix claim. Initial extra reload
cancelled background fixture forwarding (Route already handled); narrow case
omits that unrelated reload, diagnostic logging removed/no ignored errors.
Focused1 pass (2.66 s), integrated profile4 pass /81 filtered skips (85), exit0
(5.43 s), stability1 pass (2.98 s); types/format/607 boundaries/diff/docs pass.
Own labelled tmpfs DB/Next stopped, synthetic data discarded. General mid-proxy
reload/password-login/legacy cache and external/A7/Q1 gates remain; unchanged
default/build not repeated. Skills used for native verification and scoped review.

C3au (12 октября МСК): fixed real optimistic profile-name save defect, native RED
then final 3 pass / 81 filtered skips (84), exit0 (4.12 s). Server success:true
before UI/scoped cache; canonical current-owner lock/signal; retained draft,
honest unconfirmed error/manual retry, no automatic blur retries. Lost-before-SQL
and lost-after-actual-commit verified with native API/SQL; retry/reload and
member→admin→member reload isolation, identity/access unchanged. Configured
webpack build/types/ESLint/format/607 boundaries/diff pass; default2264 pass /
1099 opt-in skips, exit0 (25.19 s). Preserved incumbent mobile/desktop design;
Impeccable launcher unavailable, direct context/hardening fallback. All84 browser
attempt interrupted because default-off build cannot run enabled-only A email
cases; no whole-suite claim. Own labelled tmpfs DB/Next stopped, synthetic data
discarded; working DB/secrets/providers untouched. Legacy cached-name reconcile,
native late-reply account-switch/password-login and external/A7/Q1 gates open.

Q1y (12 октября МСК): Q1w JSON assumption corrected. Native installed CLI export
without --sql and with --sql=false both output synthetic SQL, exit0/no stderr.
Source: exportRaw supports sql/config/dialect/schema only; MySQL handler prints
SQL unconditionally, no JSON branch. No candidate-JSON compatibility claim;
public serializer/API path requires separate justified scope if needed.
Minimal env/disabled dotenv/cache/network guard, no SQL execution/DB/secrets/
dependency/lock/code changes. Docs-only; Q1x upstream blocker still applies.
Next independent agreed work, not repeated compiler probes; A7/external gates open.

S1f (12 октября МСК): HTTP/javascript/HTTPS synthetic-credentials image URLs
rejected by real admin form, retained draft/no success, zero PUT requests and
unchanged native SQL config/audit. No mock API/external request/production fix;
client guard not substitute for server validation/SSRF audit. 3 focused pass /
78 skips, exit0 (3.75 s); integrated S1 22 pass / 59 filtered skips (81), exit0
(10.27 s), types/format/606 boundaries/diff pass. Helper907 lines: split before
further growth. Own validated tmpfs DB --rm/Next stopped; S1a–f local cases
verified, customer dates/media/physical sleep/device/target rollout/A7/Q1/provider
acceptance still open; working data/design/roles/subscriptions unchanged.

S1e (12 октября МСК): actual PUT200/SQL revision32 held after commit; synthetic
session revoked, native auth/me200/user:null closes form → /login before release.
Original native response fulfill completes without suppression; private form
stays absent/no late success, exactly one PUT/audit and unchanged committed SQL.
Barrier/finally drain, no sleeps/mock API/auth/production changes. 1 focused pass /
77 skips, exit0 (3.34 s); integrated S1 19 pass / 59 filtered skips (78), exit0
(9.15 s), types/format/606 boundaries/diff pass. Own validated tmpfs DB --rm/Next
stopped. S1d late-native gap closed for this ordering only; customer/device/A7/
Q1/provider gates remain, no changes to working data/design/roles/subscriptions.

S1d (12 октября МСК): actual server-revoked synthetic admin JWT: Save PUT and
Inspect GET return native 401/no-store, close private form → /login, no success,
unchanged SQL config/audit/role/version/block state after requests. Version0→1
only in disposable fixture, no production auth/role changes or mock API.
2 focused pass / 75 filtered skips, exit0 (3.53 s); integrated S1 18 pass /
59 filtered skips (77), exit0 (8.84 s), types/format/606 boundaries/diff pass.
Own validated tmpfs DB --rm/Next stopped; late-success native race not claimed,
customer media/device/A7/Q1/provider gates remain open.

S1c (12 октября МСК): uncommitted PUT + failed GET inspection transport aborts
retain draft and block Save, SQL revision/audit unchanged. Actual explicit GET
confirms unchanged revision31, preserves draft and permits only manual native
PUT; revision32/author/config/one audit checked. No automatic retry/mock API or
production fix. 1 focused pass / 74 filtered skips, exit0 (3.20 s); integrated
S1 16 pass / 59 filtered skips (75), exit0 (7.63 s), types/format/606 boundaries/
diff pass. Own validated tmpfs DB --rm/Next stopped; working data/design/roles/
subscriptions/provider/mail untouched. Customer/device/A7/Q1 gates remain.

S1b (12 октября МСК): native SQL-configured Club fallback for missing spring,
unavailable summer background/banner and missing autumn assets. Real local WebP
decode + correct src + positive banner dimensions; actual API 200/revision/season,
unchanged SQL config/access. Synthetic external URLs blocked before network,
both failures observed; no mock API/image bytes/provider transaction.
3 focused pass / 71 filtered skips, exit 0 (4.35 s); integrated S1 15 pass /
59 filtered skips (74), exit 0 (6.46 s). Types/format/606 boundaries/diff pass.
No production defect/fix/design changes. Own tmpfs DB validated before --rm,
Next stopped; customer media/dates/physical sleep/device/A7/Q1/provider gates open.

S1a (12 октября МСК): native season-admin invalid dates/save/reload, committed
PUT reply loss + explicit confirmation/no second write, two-admin 409 + preserved
draft and explicit confirmed replacement. Eight real HTTP/SQL reads around four
Moscow midnight boundaries, Date-only control with real timers/finally restore.
Subscribed native pageshow updates winter→summer from changed SQL revision,
access/config unchanged by read. Synthetic access/event/dates/form URLs only,
not provider transaction, physical sleep or customer-media acceptance.
12 focused pass / 59 filtered skips (71), exit 0 (6.16 s); launch-settings SQL +
frontend-seasons 62 pass, exit 0 (1.52 s). Types/TS format/606 boundaries/54 docs/
diff pass.
No production defect/fix in these cases; no design/role/subscription changes.
Own loopback tmpfs DB validated before --rm; Next stopped, working data untouched.
Customer date/media/fallback/device and A7/Q1/provider gates remain open.

S2d: S2c race reproduced in C1, traced to server interception removal while
two callbacks are active (not duplicate client fulfill). Native two-request
loopback Chromium characterization RED; track handler promises and drain BEFORE
unrouteAll. Mutation removing drain repeats exact failure; restored GREEN.
Errors rethrow, no ignoreErrors/private API/dependency/production changes.
Integrated 46 pass / 14 binding filtered skips, exit 0 (55.53 s); five C1
runs each 9 pass / 50 skips, loop exit 0. Default 2264 pass / 1074 opt-in skips,
173 files pass / 57 skip, exit 0 (24.10 s). Types/TS-format/606 boundaries/diff
pass; prior broad Markdown formatting warning remains, no whole-journal rewrite.
Own DB/Next stopped/--rm; working data/provider/mail untouched. Next S1 native
season-admin browser; customer media/device/provider/A7/Q1 gates remain open.

S2c: integrated C1/C2/C3/S2 at f37a8b0: 45 cases pass / 14 filtered skips,
but unhandled context route.fulfill «Route is already handled!», exit 1
(54.81 s); NOT green. Runner last-active attribution: C1 moderator dismiss,
root cause unproven. One failure-only in-memory lifecycle trace repeat:
45 pass / 14 skips, exit 0 (54.46 s), no recurrence/trace; not a fix.
Temporary instrumentation removed, suite diff empty; no production changes.
Next: bounded attributable C1 route lifecycle diagnosis, no suppression or
speculative teardown fix; independent S1 native season-admin browser remains.
Own tmpfs DB/Next stopped, --rm label inventory empty; working data untouched.
Full acceptance and A7/Q1/provider/device gates remain open.

S2b: both native digital pages drop cached manager mailto/fallback after real
revision 18 config read loses reply; order button disabled + honest scoped error.
Actual «Повторить» restores replacement recipient, preserving subject/body,
config/payment IDs unchanged. 2 pass / 57 filtered skips (59), exit 0 (3.02 s),
types/format/docs/diff. Initial broad alert count failure traced to Next route
announcer, not stale contact; exact manager-error selector, diagnostic removed.
Test-only, no production RED/fix; lifecycle pageshow synthetic, no OS mail.
Own tmpfs DB/Next stopped/--rm; real contact/device/A7/Q1/provider gates unchanged.

S2a: both digital product pages use actual launch-config HTTP/SQL recipient,
revision 17/email-client/online-payment false. Literal product title/link and
mailto subject/body + honest manual-send/fallback contact verified; mailto never
clicked, no email/payment sent. SQL config/payment IDs unchanged; owned singleton
guard and qualified cleanup. 2 native pass / 57 filtered skips (59), exit 0
(2.74 s), types/format/docs/diff. Initial rerun strict-selector failure diagnosed:
live root + hidden Next S:0 copy; scoped unique #root, no force-click/suppression.
No production RED/fix or physical mail-client/customer-contact acceptance.
Own tmpfs DB/Next stopped/--rm; S2/device/A7/Q1/provider gates remain.

C3at: native next-page lost-reply/retry extends to guest feed, retaining first
12 cards, honest error instead of terminal footer, actual manual retry returns
3 remaining IDs/cursor=null, no duplicates/private rows/SQL changes. Shared
feed+club retry: 2 pass / 55 filtered skips (57), exit 0 (7.74 s), types/format/
docs/diff. No new RED/production fix; broad C3as/default/build not repeated.
Own tmpfs DB/Next stopped/--rm, working DB/provider/device/A7/Q1 gates unchanged.

C3as: club next-page lost reply after actual Nest/SQL read: scoped transport
fault reads terminal 3 real IDs, then aborts; UI shows honest next-page error,
retains first 12, manual «Повторить» restores cursor 12→null without duplicates.
SQL posts/tags/access unchanged; no API response mocks/new production fix.
1 focused pass / 55 filtered skips (5.45 s); fresh integrated C1/C2/C3:
42 pass / 14 binding filtered skips (56), exit 0 (53.64 s), types/format/docs/diff.
Historical C1 transport error not reproduced/not claimed fixed. Own tmpfs DB/
Next stopped/--rm; external/provider/device/A7/Q1 gates unchanged.

C3ar: native club rubric with zero matches on first page automatically reads
cursor 12 after actual «Эксклюзив» click; letter/podcast/эксклюзив all rendered,
opposite-target/draft excluded. Exhausted «Подборки» shows honest empty state;
toggle back restores content. SQL posts/tags/access snapshots unchanged.
3 focused pagination pass / 52 filtered skips (55), exit 0 (4.46 s);
stronger alias assertions: 1 pass / 54 filtered skips, exit 0 (2.60 s).
Types/format/docs/diff; coverage only, no production RED/fix claim.
Own tmpfs DB/Next stopped/--rm; working DB/provider/device/A7/Q1 gates unchanged.

C3aq: existing native pagination browser case covers guest feed + paid-member
club, 12+3/cursor 12→null, unique exact eligible IDs, excluded opposite-target/
draft neighbors, terminal UI + unchanged SQL posts/access. Actual club setup
dialog closed through UI; local access row only, no provider checkout/payment.
2 focused pass / 52 filtered skips (54), exit 0 (3.62 s), types/format/docs/diff.
Test-only coverage, no new RED/fix/whole-suite claim; C3ap checkpoint retained.
Own tmpfs DB/Next stopped/--rm; working DB/external/device/A7/Q1 gates unchanged.

C3ap: tied pagination regression covers guest feed and authenticated club,
exact stable ID order/cursors/completeness. Club with tie-break temporarily
removed: native HTTP/SQL RED 35 received / 32 unique; restored fix → 42 native
content tests pass, exit 0 (2.13 s). Integrated native browser C1/C2/C3:
39 pass / 14 binding filtered skips (53), exit 0 (51.97 s), types/format/docs/diff.
Production unchanged relative to C3ao; no default/build rerun without changes.
Own tmpfs DB/Next stopped/--rm; no working DB/provider payments/external mail/
push/deploy. Concurrent offsets/device/media/A7/Q1/provider gates remain;
historical C1 transport failure not reproduced, not claimed fixed.

C3ao: real HTTP/MySQL RED: 35 tied rows → 35 received but 32 unique IDs.
Minimal postListOrder id ASC tie-break → 41 native SQL/HTTP GREEN (1.72 s),
fresh default 2264 pass/1066 skips, 173 passed/56 skipped files (18.96 s),
types/format/docs/diff. C3an browser 1 pass/52 filtered skips (1.82 s);
fixture visible-collection barrier + joined waiter fixes streamed hidden
selector failure, not old C1 transport. Sort/date/cursor/roles/subscriptions
unchanged; concurrent offset writes/devices/media/A7/Q1/provider gates open.
Own tmpfs DB/Next stopped/--rm; local fix only, no working DB/push/deploy.

C3an: native guest feed pagination 12+3/cursor 12→null, unique public IDs,
club/draft excluded, terminal footer/card + unchanged SQL snapshot.
1 browser pass / 52 filtered skips, exit 0 (2.27 s), types/format/docs/diff.
Deterministic sortOrder fixture replaces wrong initial DESC-id assumption;
ties/concurrent offsets/physical gesture not proved, no production change/RED.
Own tmpfs DB/Next stopped/--rm, no payment rows/external mail/working DB/deploy;
A7/provider/media/device/Q1 gates unchanged.

C3am: native profile→Club link/active tab→close setup→Комьюнити/pressed→postal
«скоро» without matching CTA→history Back/profile/result; scoped quiz и прежние
SQL identity/payment assertions сохранены. Hidden moodboards/support buttons
visibility проверены без отправки mail. 1 pass / 51 filtered skips, exit 0
(5.37 s), types/format/docs/diff. Initial wrong tab/modal preconditions
исправлены через UI, no force-click/production fix/new RED. Own tmpfs DB/Next
остановлены, synthetic DB --rm; devices/mailto/media/A7/provider gates прежние.

Q1x: integrated default после новых Q1v/w suites: 2264 pass / 1064 skips,
173 passed/56 skipped files, exit 0 (18.49 s). Review/docs/diff; production/
graph/build unchanged, native browser/types не повторены без изменений.
Fresh public registry: stable Drizzle 0.31.11 всё ещё зависит от deprecated
esm-loader ^2.5.5; latest loader 2.6.5/core-utils 3.3.2 требуют legacy esbuild
~0.18.20. Stable bump alone не снимает finding; no install/override/patch или
security-fix claim. Exact upstream-chain blocker записан в плане; следующий
независимый C3 diagnostic/navigation срез, не ещё одни повторные transforms.
A7/P/V/media/device/manual gates прежние; no working DB/secrets/payments/deploy.

Q1w: actual offline Drizzle export --sql, typed synthetic MySQL config/schema,
exact DDL/header/stderr/exit + unchanged fixture-directory. Baseline CLI compiler
0.25.12 vs child-only root 0.28.2 candidate; 2 new pass, Q1u/v/w 6 focused pass
(564 ms), types/format/docs/diff. Minimal env/explicit disabled dotenv/network
connect guard; SQL only generated, never executed, no working DB.
Initial expectation missing standard header corrected, not production RED.
No graph/lockfile/security fix or full migration compatibility claim;
JSON/other legacy modes/reviewed upgrade/Q1/A7/external gates remain.

Q1v: native esm-loader typed config/enum + tsconfig alias/.mjs→.mts + dynamic
import: baseline/candidate isolated worker, actual hooks, 2 new pass;
Q1u+Q1v 4 focused pass/exit 0 (357 ms), types/format/docs/diff.
Installed graph unchanged/no security fix/RED. Source review: actual Drizzle
config uses bundled esbuild-register + require, not this ESM loader path.
Next: synthetic offline CLI config/schema export without DB/providers;
JSON/CJS/Drizzle acceptance and reviewed upgrade remain, as do Q1/A7 gates.
No disk cache/working DB/secrets/external mail/payments/push/deploy.

Q1u: core-utils 3.3.2 real sync/async TS/CJS/map characterization:
nested esbuild 0.18.20 vs actual root 0.28.2 в отдельных child adapters —
2 focused pass, types/format/docs/diff. New ordinary suite → fresh default
2260 pass / 1064 skips, 171 passed/56 skipped files, exit 0 (18.56 s).
No dependency/lockfile change, disk cache/SQL/providers; не security fix/RED
или full esm-loader/Drizzle acceptance. Далее module/config loading compatibility
до reviewed chain upgrade; Q1 residual/A7/external gates прежние.

C3al: native quiz Back floor/Q3→Q2/edit/forward/restore preserves selections
и final 21/0/no-blend/result/date/reload; SQL identity прежние. 1 browser pass /
51 filtered skips, types/format/docs/diff. Production unchanged/no new RED,
предыдущий reducer RED не повторён. Own Next/tmpfs DB остановлены/--rm;
devices/media/transport/A7/external gates прежние, без payments/push/deploy.

C3ak: свежая integrated C1/C2/C3 Next/Nest/SQL/loopback SMTP regression
после восьми новых cases — 38 pass / 14 filtered binding skips, exit 0
(46.05 s). Rare transport exception не повторился, fix не заявлен.
Default-off build, no production diff/suppression; A6/A7/media/devices/provider
gates остаются открыты. Own Next/tmpfs DB остановлены/--rm; docs check,
без внешних payments/mail/push/deploy или рабочей БД.

C3aj: literal pure Goblincore/Witchcore/Castlecore/Fairycore/Dark Academia/
Light Academia — 6 native browser journeys pass / 46 filtered skips;
21/0 scores/no blend/canonical title/scoped completedAt/reopen/reload и
SQL identity сохранены. Вместе с прежним Cottagecore покрыты все 7 pure
journeys локально. Types/format/docs/diff; production неизменён/no new RED.
Own Next/tmpfs DB остановлены/--rm; media/gesture/devices/A7/external gates
сохраняются, без payment fixture/рабочей БД/push/deploy.

C3ai: full native guest Light Academia journey/last carousel choices:
21/0 scores, no blend, pressed/CTA, scoped completedAt и result reopen/reload
сохранены; SQL identity прежние. 1 browser pass / 46 filtered skips,
types/format/docs/diff. Initial companion fixture #7 исправлен на #6,
не production RED. Touch/поворот/прочие эстетики/devices/media gates открыты;
собственные Next/tmpfs DB остановлены/--rm, без payments/push/deploy.

C3ah: native login 401 во время held старого auth/me сохраняет подтверждённого
admin/scoped Cottagecore; error виден, форма retry-ready, чужой Goblincore
не восстановлен. Успешный switch также проходит; 2 native focused pass /
44 filtered skips, types/format/docs/diff. SQL identity/payments прежние,
production неизменён; нет нового mutation RED или payment fixture.
Собственные Next/tmpfs DB остановлены/--rm, внешние/A7/transport gates прежние.

C3ag: native Next/Nest/SQL login member 91402 во время held admin auth/me;
старый browser HTTP read реально abort, после barrier старая scoped quiz data
удалена/new сохранена, native cookie identity и reopened Goblincore подтверждены.
17 native C3 pass / 28 filtered skips, types/format/diff checks. Начальные fixture
failures не объявлены production RED; production не менялся. Без новой payment
fixture. Собственные Next/tmpfs backend_test остановлены/--rm; transport callback
errors assertion-visible. Stale delivery/component/media/devices/A7/external
gates остаются открыты; push/deploy/рабочая БД не затронуты.

C3af: unmocked AuthProvider/auth client/cache/native HTTP probe: account 1 →
applySession account 2 очищает seed private query/remount state и abort старого
held HTTP read. Scope-freeze mutation → 1 RED (2|1), снято; 53 focused GREEN,
types/format/docs. Default opt-in skip проверен. Synthetic HTTP endpoint/Probe,
не Nest/SQL/login acceptance; app/transport/media/devices/A7 gates сохранены.

C3ae: свежая полная default регрессия после добавленных cases — 2258 pass /
1055 skips, 170 passed/55 skipped files, exit 0 (17.94 s). Browser opt-in
проверен отдельно в C3ac/ad; skipped SQL/provider/device не выданы за готовность.
Production fix по profile read без воспроизведённой причины не добавлен;
широкие AuthProvider/transport/A7/external/Q1 residual gates остаются открыты.

C3ad: второй component probe использует production storage и native localStorage:
owner сменён в том же JS task до Promise continuation; old key очищен/new key
сохранён, старый итог не показан, новый восстановлен после loading=false.
1 native storage mutation RED снята; 52 focused GREEN/types/format/docs.
Auth/leaf views controlled, origin HTML route-fulfilled — не Next/API/SQL
acceptance. Конкретная microtask граница проверена, широкие gates сохранены.

C3ac: opt-in native React/Chromium QuizScreen probe с controlled auth/storage/
leaf adapters: смена owner между deferred reads не восстанавливает старый итог.
Cancelled guard removal → 1 mutation RED, снято полностью; 51 focused GREEN,
pageerror check/browser GREEN, types/format/docs. In-memory bundle/no network.
Не Next/AuthProvider/Nest/SQL или реальная remote storage acceptance; широкие
owner/read/transport/media/devices/A7 gates сохранены.

C3ab: overlapping native loopback refresh responses — old completion не снимает
marker нового forced refresh; resume не создаёт третий HTTP/getMe. Удаление
refresh finally guard: 1 mutation RED (3 calls вместо 2), снято полностью.
50 focused GREEN/types/format/docs. Controller ordering, не component/browser/
Nest/SQL acceptance; owner/read/transport/media/devices/A7 gates открыты.

C3aa: два late loopback HTTP response cases (old 200/account-1 и 401 после
account-2) сохраняют новый state/scope/private cache; signal aborted. Удаление
refresh version guards дало 2 mutation RED, снято полностью. 49 focused GREEN,
types/format/docs проходят. Synthetic endpoint/adapter намеренно не отменяет
fetch — это controller ordering, не browser/Nest/SQL или remote storage race.
Concurrent component read/owner и transport/media/devices/A7 gates открыты.

C3z3: точный native moderator dismiss 1 pass, весь C1 9 pass/exit 0 с временной
route/lifecycle instrumentation. Старое исключение не воспроизведено; output
усечён, полный подсчёт трассы не заявляется. Instrumentation снята; собственные
Next/loopback tmpfs MySQL остановлены, одноразовая SQL fixture удалена через
`--rm`, рабочие данные не затронуты. Transport gate открыт, suppression нет.

C3z2: native loopback/Chromium probe pending route.fetch + confirm/dismiss +
page/context unrouteAll(wait) прошёл: context teardown дождался fulfill
(explicit barriers, exit 0). Installed routing source изучен; простой dialog/
wait teardown не воспроизвёл старую race. C1 transport gate не закрыт; следующий
шаг — трассировка request/route identity и lifecycle в точном C1 fixture.

- [x] Сверить актуальный staging, разбор ТЗ, frontend WORK_PLAN и исходники;
      записать матрицу 2.1/4.1–4.16, зависимости и границы приёмки.
- [x] A1: expiry/cancel scrub и 30-дневное удаление минимальной истории привязки.
      6 native RED → 14 lifecycle GREEN; вместе с request/confirmation 85 pass.
      Внутренний core, worker пока не включён до A3/A7.
- [x] A2: очистка привязки в транзакции удаления аккаунта.
      Native RED/GREEN; 18 retention/worker/HTTP pass, legacy schema и partial
      schema проверены. Внешние доставки не запускались.
- [x] A3: leased/retrying доставка подтверждения, native MySQL + loopback SMTP.
      18 SQL/SMTP cases; полная регрессия 2986 pass / 30 opt-in skips.
      Core внутренний, регистрация в worker/внешний SMTP ещё не включены.
- [x] A4: admin request/status и явный confirm POST с проверенным HTTP-контрактом.
      A4a: формат receipt/status определён; внутреннее read-only восстановление
      результата — 26 SQL pass (21 RED + lock-removal mutation RED).
      A4b: 16 native HTTP/SQL cases, включая compiled ESM; 8 исходных RED,
      отдельные RED для origin/cache. Полная регрессия: 3028 pass / 30 skips.
      Маршруты закрыты флагом; включение/форма/страница/worker ещё впереди.
- [x] A5: подключить существующую форму администратора и восстановление результата.
      A5a: строгий request/status клиент, captured intent и session cancellation;
      60 client tests, включая loopback HTTP fixture; 649 связанных проверок pass.
      A5b: UI подключён под default-off build flag; stable intent при закрытии/
      смене вкладки, explicit inspect/retry, confirmed canonical refresh.
      11 active + 10 default-disabled + 23 соседних browser pass (mock API), 649 unit pass.
      Типы/lint/active+default build/API/boundaries проходят.
      A5c1: key-only IndexedDB journal, атомарная резервация между вкладками,
      CAS cleanup, owner/abort guards и fail-closed storage; 6 RED → 9 browser GREEN.
      Типы/lint/default build/boundaries проходят.
      A5c2a: journal подключён; durable-before-POST, explicit reload GET,
      cross-tab reservation, отказ storage без POST, GET 404 сохраняет unknown.
      3 RED → 16 active + 10 disabled browser pass; 649 unit; типы/lint/обе сборки.
      A5c2b: explicit terminal reset с повторным GET и CAS; без автоматического
      POST, 3 RED → 21 active browser pass, 649 unit. Rollout всё ещё выключен.
      A5c2c: явный ввод исходной почты для unknown replay с тем же durable key,
      conflict не сбрасывает intent; draft scoped по ключу. 2 RED + review RED →
      24 active browser, 649 unit; native HTTP/SQL ещё не проверен этим UI.
      A5c3a: 2 native browser/API/SQL cases — request/reload и lost reply/replay;
      одна outbox/audit запись, identity сохранена. Browser transport proxy,
      настоящая cookie/Nest/SQL; SMTP и deployment proxy ещё не проверены.
      A5c3b: 8 native browser cases — expiry/fresh draft, proof confirmation/
      canonical refresh и request/status после отзыва admin; SQL/credentials/
      оплаченный срок сохранены. Teardown handlers ожидаются без suppression.
      UI/request/recovery проверен локально; далее A6 и loopback SMTP.
      Неизвестный адрес/неоднозначный HTTP refusal не разрешают автоматический reset.
- [ ] A6: страница подтверждения из fragment, явное действие, существующий вход.
      A6a: strict proof client и memory-only fragment capture; 2 focused RED →
      30 GREEN (включая loopback HTTP), 679 related unit; типы/lint/default build.
      A6b1: default-disabled /email-binding с явным POST/unknown result/обычным входом;
      2 browser RED → 6 active + 1 disabled GREEN (mock API), обе сборки и типы.
      A6b2: исправлены session remount и fragment-only reopen; 3 native RED →
      10 pass/1 reopen RED → 11 native UI/SQL GREEN, 43 browser regressions.
      Credentials/paid expiry/browser cookie сохранены; SMTP и backend GET ещё открыты.
      A6c1: proof из настоящего loopback SMTP MIME → direct frontend → native POST/SQL;
      13 pass, включая диагностический routing blocker: actual email GET 404,
      cross-site document 403. Test-only перевод пути — не целостная приёмка.
      A6c2: actual email GET → read-only configured redirect → frontend → explicit POST;
      4 native RED → 19 HTTP/SQL GREEN; 13 browser/SQL/SMTP pass без смены пути.
      Cross-site webmail 403 сохраняется, узкий navigation exception требует решения.
      A6c3: пользователь разрешил узкий GET document navigation; 2 raw HTTP RED
      → 12 policy GREEN, удаление exception даёт browser RED. Всего 60 focused
      security/native HTTP/SQL/browser/SMTP pass. Реальные Chromium Fetch Metadata
      проверены прямым wire probe; actual SMTP link отдельно через transport proxy.
      GET сохраняет SQL, POST/CORS/iframe/fetch границы не ослаблены; default-off.
      Старый Node fetch probe подменял mode=cors; диагностика исправлена.
      A6/Checkpoint A/A7/deployment остаются открыты.
      A6d: actual loopback SMTP link → explicit native confirm → обычная email
      форма с прежним настоящим scrypt-паролем → тот же user/cookie/club access.
      Старый member JWT действителен, GET/confirm не создаёт recipient session,
      identity/paid expiry сохранены, нет дубля аккаунта/reset token/нового письма.
      Mutation RED (bound-phone login 401) → 20 browser + 19 native sessions GREEN.
      Test-only приёмка через local transport proxy; A7/deployment ещё открыты.
      A6 fixture: recipient/MIME acceptance в отдельном test-only модуле;
      lifecycle/SQL cleanup общий, assertion AST сохранён. 3 до/20 после GREEN;
      основной файл 702 строки. Без production изменений и включения флага.
      Общая active-build регрессия после Moscow timezone fixture: все 27 native
      browser/API/SQL cases GREEN (14 binding + 13 C1/C2), настоящий loopback SMTP.
      Default-off build восстановлен; local proxy — не deployment acceptance.
      A6/Checkpoint A/A7 остаются открыты, сервер/рабочая БД не менялись.
- [ ] A7: фактическая история миграций, репетиция, reviewed включение схемы/формы.
- [ ] Checkpoint A: весь сценарий через настоящее API/SQL/loopback письмо;
      первый email меняется один раз, пароль/сессии/подписка сохранены.
- [ ] P1: свежая сквозная Prodamus TEST оплата/receipt/письмо/вход; учесть срок
      кабинета 12 октября и получить результат по СБП MNT_ID/GPB.
- [ ] P2: intent и результат конкретной обычной оплаты/продления после потери ответа.
- [ ] P3: настоящее продление/подтверждённая отмена с сохранением оплаченного срока.
- [ ] C1: реальные API/SQL browser сценарии участниц, ролей, блокировки и писем.
      C1a: один production browser → native Nest → SQL сценарий block/reload/unblock;
      старый member token остаётся отозван, identity/paid expiry сохранены,
      две audit записи, письмо не отправляется. 1 browser + 12 смежных SQL pass.
      Только локальный transport proxy; роли/выдача/повтор письма ещё открыты.
      C1b: native browser cancel/confirm ручного продления; отказ не пишет SQL,
      confirm добавляет ровно 31 день к прежнему expiry, reload показывает новую
      дату, identity сохранена. 2 C1 browser + 23 grant SQL/HTTP pass.
      Роли/первая выдача/письма и deployment acceptance остаются открыты.
      C1 fixture: сценарии вынесены в отдельный test-only модуль; общий lifecycle
      не дублирован. 2 C1 browser pass до/после, 15 cases зарегистрированы.
      C1c: member/moderator не видят owner-вкладку; реальные browser GET members
      и POST grant дают 403 без SQL/SMTP side effects. 4 C1 browser pass.
      Действия moderator, первая выдача/письма и deployment ещё открыты.
      C1d: explicit resend из admin UI → одна outbox/audit → настоящий loopback
      SMTP; UI подтверждает очередь, не доставку. Existing account получает login
      без reset token, identity/expiry сохранены; повтор delivery без дубля.
      5 C1 browser pass; первая выдача/moderator actions/deployment ещё открыты.
      C1e: moderator закрывает конкретную жалобу через UI/Nest/SQL; комментарий
      и автор сохранены, audit одна, reload не возвращает жалобу. 6 C1 browser
      + 4 report SQL/HTTP pass. Первая выдача/остальные moderation/deployment открыты.
      C1f: первая выдача через UI/native API/SQL; cancel без write, confirm =
      31 день от now, pending future order игнорируется и сохраняется. Тот же
      member JWT 403 → 200, reload показывает продление; identity/no mail сохранены.
      Paid-filter removal mutation RED; 7 C1 browser + 23 grants GREEN, типы.
      Первая выдача локально проверена; прочие moderation/deployment открыты.
      C1g: moderator UI cancel/confirm удаления parent; reply становится root,
      его report/like сохранены, parent report/like удалены, audit ровно одна.
      Reload подтверждает SQL результат, автор/SMTP неизменны; parentId mutation
      RED снята. 8 C1 browser + 5 moderation SQL/HTTP GREEN, типы проходят.
      Test-only локальная приёмка; C1/deployment и A7 остаются открыты.
      C1h: moderator блокирует автора из жалобы; cancel без write, confirm
      отзывает JWT, сохраняет identity/paid expiry/comment/report, audit одна.
      Cancellation intent записан без provider confirmation; worker не запущен.
      Queue-removal mutation RED снята; 9 C1 browser + 8 moderation SQL/HTTP
      GREEN, типы проходят. C1/deployment/A7 остаются открыты; далее остаток C1/C2.
- [ ] C2: real-API редактор/статьи/вложения/черновики/scheduled без дублей.
      C2a: native browser create/edit/reload/delete draft; одна manual feed
      запись, draft/published=0, тот же ID после edit, cancel без SQL write.
      Published=true mutation RED снята; readiness ждёт снятия inert после
      draft recovery. 10 C1/C2 browser + 36 creation SQL/HTTP GREEN, типы.
      SDK cookie fixture — не обычный admin login; остальные C2 сценарии открыты.
      C2b: committed create/200 → потеря ответа; текст сохранён, Save закрыт,
      явная «Проверить сохранение» повторяет прежний ключ и возвращает тот же ID.
      Одна SQL draft запись/creation intent, reload успешен. Replay-return removal
      mutation RED снята; 11 C1/C2 browser GREEN, типы. Production не менялся.
      C2c: обычный password login admin с настоящим scrypt → cookie → редактор;
      logout очищает cookie, member login/reload не возвращает owner controls.
      Native admin read/create = 403, identity сохранена, SQL без forbidden поста.
      Admin-login denial mutation RED снята; 12 C1/C2 browser GREEN, типы.
      Local transport proxy; prepared-dev skipped suite/deployment не закрыты.
      C2d: UI create/edit/reload будущего schedule, Moscow → literal UTC;
      один ID, scheduled/published=0/publishedAt=NULL. До срока core ticks пусты,
      public feed не содержит пост; +3h mutation RED снята. 13 C1/C2 browser
      + 3 content SQL GREEN, типы. Full due/publication delivery ещё открыта;
      A6 active-build регрессия после explicit timezone fixture: 27 cases GREEN;
      default-off build восстановлен, rollout/deployment всё ещё открыты.
      C2e: собственный editor schedule переведён SQL fixture на прошедший срок;
      native core публикует один batch, public HTTP отдаёт тот же ID/текст,
      publishedAt равен scheduledAt, повтор пуст, admin reload «Опубликован».
      Scheduler status=draft mutation RED снята; 14 C1/C2 browser GREEN, типы.
      Это не wall-clock/worker/announcements acceptance; media/devices открыты.
- [ ] C3: реальные взаимодействия, поиск, Библиотека, тест, профиль и поддержка.
      C3a: native member password login → like/save → reload/logout → другой
      account без чужих состояний → первый account со своими состояниями.
      SQL/credentials/roles/sessionVersion/paid expiry сохранены; missing userId
      saved-read mutation RED снята. 15 C1/C2/C3 browser GREEN, типы.
      Unpaid profile gate потребовал paid fixture, production не менялся.
      Категории/profile listing, comments/media, вся навигация/устройства открыты.
      C3b: native saved API и profile feed/club categories: feed+both / club+both,
      reload, unpublished legacy rows скрыты. Expiry собственной SQL подписки
      исключает club из HTTP без удаления saved rows; identity неизменна.
      hasClub bypass mutation RED снята; 16 C1/C2/C3 browser GREEN, типы.
      SDK cookie/local transport proxy — не deployment; comments/media,
      полная навигация/физические устройства и A7 остаются открыты.
      C3c: guest native feed search/empty/clear; feed+both разрешены,
      club/legacy draft скрыты, SQL read-only. Search-predicate removal RED снят;
      missing tags schema исправлена только в test fixture, tags HTTP 200.
      17 C1/C2/C3 browser GREEN, типы; comments/media, Библиотека/тест,
      полная навигация/физические устройства и A7/deployment открыты.
      C3d: native community comment create/reload/cancel-delete/confirm-delete;
      одна root SQL запись с тем же текстом/автором, credentials/expiry сохранены.
      Insert-text corruption RED снята; 18 C1/C2/C3 browser GREEN, типы.
      Completed onboarding задан scoped marker только в fixture; внешних
      reply push/media нет. Edit/reply/photos/lost-response и A7 ещё открыты.
      C3e: native own-comment edit cancel сохраняет исходную строку; save HTTP
      200 меняет только текст прежнего ID/автора, reload сохраняет правку.
      Edit-text corruption RED снята; 18 C1/C2/C3 browser GREEN, типы.
      Production не менялся; чужой edit/negative authorization, reply/photos/
      lost-response, полная навигация/устройства и A7/deployment ещё открыты.
      C3f: ordinary paid member/admin не видят чужой edit; прямой native POST
      возвращает 403, без cookie 401; comment/security identity/expiry сохранены.
      Author-check bypass RED снят; 20 C1/C2/C3 browser GREEN, типы.
      Штатный SDK lastSignedIn не включён в identity invariants; production
      не менялся. Reply/photos/lost-response/навигация/устройства/A7 открыты.
      C3g: add commit → потеря HTTP ответа → сохранённый draft/blocked send →
      explicit refresh видит одну строку без повторного POST; cancel/confirm
      отказа сохраняет/очищает draft, не удаляя comment. Далее edit/reload/delete.
      Insert-text corruption RED в lost case снята; 21 C1/C2/C3 browser GREEN,
      типы. Это fail-closed list recovery, не idempotent add API; reply/photos/
      lost edit-delete/навигация/устройства/A7/deployment остаются открыты.
      C3h: update commit → потеря ответа → blocked save/сохранённый draft →
      explicit refresh canonical строки; cancel editor не откатывает commit.
      Один update POST, reload с прежним ID. Update-text mutation RED снята.
      Первый общий run имел unhandled C1 transport race и не считался GREEN;
      focused 2 pass + повтор общий 21 pass/exit 0, типы. Редкая fixture race
      остаётся ограничением; reply/photos/lost delete/навигация/A7 открыты.
      C3i: delete commit → потеря ответа → explicit refresh пустого списка →
      reload без записи; ровно по одному add/update/delete, identity/expiry прежние.
      Wrong-delete-predicate RED снят; 21 C1/C2/C3 browser GREEN/exit 0, типы.
      Редкая C1 transport race не повторилась, её устранение не заявлено.
      Reply/photos/остальная навигация/устройства/A7/deployment ещё открыты.
      C3j: self-reply cancel сохраняет draft без SQL записи; send создаёт child
      с исходным parentId, reload сохраняет ответ. Native own-child delete
      не удаляет root; далее прежний CRUD. Missing-parentId RED снят;
      21 C1/C2/C3 browser GREEN/exit 0, типы. Reply другому автору/push не
      проверен; photos/экраны/навигация/устройства/A7/deployment открыты.
      C3k: comment like HTTP/SQL → pressed и counter 1 → reload → unlike,
      comment/identity/expiry прежние. Wrong-like-author RED снят;
      21 C1/C2/C3 GREEN + 2 focused после scoped likes cleanup, типы.
      Account switching likes/чужой reply-push/photos/прочие экраны/устройства,
      прежняя редкая transport race и A7/deployment ещё открыты.
      C3l: гостевая библиотека list/search → public body → back; прямой club
      detail locked/sections=[] без body, draft скрыт в list/HTTP/UI, SQL прежняя.
      Club-access bypass mutation RED снята; 22 C1/C2/C3 GREEN/exit 0, типы.
      Следующий C3m: undefined unpublished detail даёт query error/
      «Повторить», а не «Статья не найдена» — UX дефект воспроизведён и не закрыт.
      Paid article/reload/expiry/media/остальные экраны/устройства/A7 открыты.
      C3m: native not-found RED → screen-only undefined-to-null success adapter;
      wire/backend контракт прежний, errors не перехватываются, key/signal сохранены.
      Unpublished/missing not-found + network retry/recovery; 22 C1/C2/C3 GREEN,
      root/frontend типы/lint/default build/API/boundaries. Далее paid article
      reload/expiry; прочие C3 экраны/media/устройства/A7/deployment открыты.
      C3n: paid direct article HTTP/unlocked/body/reload; synthetic expiry →
      locked/no body после reload, article/identity/payment reads неизменны.
      Denied-paid/expiry-bypass RED сняты. Первый общий run exit 1 из-за прежней
      C1 transport race (не GREEN); 3 focused pass → 23 общих pass/exit 0, типы.
      Live expiry без reload/account switching/media/экраны/устройства/A7 открыты;
      причина transport race не установлена и ошибка не подавлялась.
      C3o: guest quiz 10 UI выборов → literal cottagecore/21 и scoped local result;
      restart сбрасывает ответы, reload сохраняет последний итог, SQL identity прежняя.
      Dropped-persistence mutation RED снята; 24 C1/C2/C3 GREEN/exit 0, типы,
      default build восстановлен. Это клиентский результат, не server persistence;
      member/profile/switching/blend/прочие эстетики/экраны/устройства/A7 открыты.
      C3p: native email/password вход member → 10 UI выборов → member-scoped
      cottagecore/21 → результат в профиле после открытия/reload; SQL identity
      и synthetic paid entitlement прежние. Profile-read mutation RED снята;
      25 C1/C2/C3 GREEN/exit 0, типы/default build. Own tmpfs DB удалён.
      Клиентское хранение; switching/SPA/full result reopen/blend/другие эстетики,
      устройства/media/transport race/A7/deployment ещё открыты.
      C3q: native member login/quiz/profile → logout удаляет cookie и scoped result;
      следующий native account login/profile/reload не получает чужую эстетику.
      SQL обеих identity fixtures/paid entitlement прежние; omitted-cleanup RED
      снята. 26 C1/C2/C3 GREEN/exit 0, типы/default build; own tmpfs DB удалён.
      Не server/cross-device persistence; SPA/full result reopen/guest → login,
      blend/другие эстетики/media/устройства/transport race/A7 открыты.
      C3r: guest проходит quiz → native member login → профиль без чужого title,
      guest result очищен/member result отсутствует; reload/SQL identity/payment
      прежние. Null-owner cleanup mutation RED снята; 27 C1/C2/C3 GREEN/exit 0,
      типы/default build, own tmpfs DB удалён. Client storage, не server persistence.
      Далее воспроизвести SPA/full result reopen; blend/другие эстетики/media/
      устройства/transport race/A7/deployment открыты.
      C3s: native RED поймал profile result CTA → новый welcome. Отдельный
      static /quiz/result восстанавливает scoped validated/canonical result,
      не меняя completedAt; обычный /quiz и restart остаются fresh welcome.
      28 C1/C2/C3 GREEN/exit 0, 15 parser unit (score mutation RED → GREEN),
      типы/lint/default build/API/boundaries. Absent/malformed result → welcome.
      Дизайн/session/club policy сохранены; own tmpfs DB удалён, сервер не обновлён.
      Browser blend/прочие эстетики/result focus-session races/media/устройства/
      server persistence/transport race/A7/deployment открыты.
      C3t: /quiz/result → restart → полное новое прохождение → новый completedAt
      → reload нового итога. Path-only persistence mutation даёт RED на старой
      дате; снята полностью, production diff пустой. 28 C1/C2/C3 GREEN/exit 0,
      root types/default build; SQL identity/paid entitlement прежние.
      Own frontend остановлен/tmpfs DB удалён после проверки принадлежности.
      Остальные эстетики/blend/focus-session/media/устройства/A7 ещё открыты;
      не server/cross-device persistence, сервер не обновлялся.
      C3u: native guest quiz даёт goblincore 11/cottagecore 10, blend с обеими
      вкладками; /quiz/result/reload сохраняют оба ключа/scores/completedAt.
      Wrong-tab mutation RED снята; 29 C1/C2/C3 GREEN/exit 0, root types/default
      build; SQL identity прежние, own frontend/tmpfs DB очищены. Production
      diff пустой. Остальные эстетики/blend boundaries/focus-session/media/
      устройства/transport race/A7/server persistence ещё открыты; без выкладки.
      C3v: native RED подтвердил raw browser title в профиле вместо canonical
      result. Профиль переиспользует parser страницы результата, invalid/null
      → приглашение пройти тест, валидный → canonical card/CTA/full result.
      Storage/SQL identity неизменны. 30 C1/C2/C3 GREEN/exit 0, 17 parser/storage
      unit, root/frontend types/lint/default build/API/boundaries проходят.
      Own frontend/tmpfs DB очищены; дизайн/формат записи/авторизация прежние.
      Focus/session/media/устройства/A7/deployment остаются открыты.
      C3w: saved result → focus/native me сохраняет итог/completedAt; cookie
      удалена только в собственном browser context → online/native me user:null
      → welcome/прежний user storage очищен, SQL identity прежние. Constant-scope
      mutation RED снята полностью; 30 C1/C2/C3 GREEN/exit 0, root types/default
      build, production diff пустой. Me возвращает 200/user:null — исправлено
      неверное ожидание теста, не production bug. Own frontend/tmpfs DB очищены.
      Не закрывает concurrent read/owner races/media/device/A7/deployment.
      C3x: standalone scoring suite — семь полных эстетик, literal answer IDs/
      scores, вес дома и blend с разницей 1/3/5. Boundary/home mutations RED
      сняты полностью; 27 scoring/parser/storage unit GREEN/exit 0, root types.
      Production diff пустой; unchanged browser/SQL/build не повторялись.
      Остальные эстетики покрыты на unit уровне, их browser/media/device
      приёмка и concurrent read/owner races/transport/A7/deployment открыты.
      C3y: direct reducer immutable snapshot/back/edit/next scoring, first-question
      floor и restored restart/fresh start. Две изолированные mutations RED
      сняты полностью; initial shared-fixture contamination устранена, не counted
      as extra failures. 4 reducer + scoring/parser: 29 focused GREEN/exit 0,
      root types/format GREEN, production diff пустой. Не async-owner/browser
      acceptance; concurrent read/owner/transport/media/device/A7 gates открыты.
      C3z: read/owner boundaries inspected; getItem reads synchronously before
      Promise, effect cancelled guard preserved. Own native Chromium/loopback
      probe fetch → delayed upstream → navigation → release → fulfill succeeds;
      simple navigation-cancellation hypothesis does not reproduce old C1
      already-handled error. No speculative suppression/retry/teardown fix.
      Далее exact C1 lifecycle instrumentation/native reproduction; transport/
      owner acceptance still open. Docs-only, no external/SQL/user files.
- [ ] S1: сезонный read/write/CAS и четыре даты; материалы заказчика.
      S1a: native admin save/reload, 409 draft/confirmation, committed reply loss,
      eight Moscow boundary HTTP/SQL reads + native subscribed pageshow pass.
      Synthetic media/dates/event/access only; customer images/fallback and
      physical sleep/device acceptance remain open. See current journal above.
      S1b: real local fallback WebP decode passes for missing spring/autumn and
      unavailable summer images; no customer-media/device acceptance implied.
- [ ] S2: mailto-заказ обоих материалов с реальной конфигурацией и устройствами;
      серверную форму не считать согласованной заменой этого пути.
- [ ] M1: проверить карту закрытых файлов и прямые public-read URL.
      M1a: локальная карта storage/потребителей; 4 real SDK/loopback wire pass.
      Подтверждён исходящий public-read, не реальная политика рабочего bucket.
      API/direct URL private/public acceptance и рабочая карта ссылок ещё открыты.
- [ ] M2: закрытая выдача/перенос только по проверенной карте, storage/API acceptance.
- [ ] V1: контракт/валидация VK source и public/club, совместимость прежних видео.
      V1a: read-only аудит + проект границ в плане: required UNIQUE youtubeId,
      public catalog без club gate и строгий anonymous worker требуют совместимого
      решения до смешанного каталога. Вложения наследуют access родителя;
      iframe нельзя класть в file videoUrl или выдавать гостю закрытый source.
      Официальные docs недоступны (web error / direct HEAD 418); host/path/query
      не подтверждены. Схема/API пока не утверждены и не менялись; нужны проверка
      контракта и реальные public/club embeds, далее независимый пункт.
- [ ] V2: единый VK renderer для Видео/вложений, реальные ссылки и устройства.
- [ ] Q1: актуальные dependency findings и migration blockers; точечные исправления.
      Q1t: unchanged graph residuals проверены: actual Next tooling braces
      compile/expand на 9003-char/4500-deep pattern дают caught RangeError
      в bounded child; latest 3.0.3, patched release отсутствует. Actual nested
      esbuild 0.18.20 own stdin-only loopback server возвращает synthetic module
      с ACAO * для untrusted Origin; closed/disposed, no user files. Core-utils
      использует transform, не serve; reachable app exploit не доказан.
      No blind out-of-range esbuild override/patch/audit suppression; нужен
      отдельный reviewed compatibility slice. Registry 2 + manual Q1m/Q1p
      остаются; далее independent compatibility/C3 race/transport work.
      Docs-only: unchanged 2251-pass evidence не повторялось, не выложено.
      Q1s: Vitest + seven internal packages exact 4.1.11; real own loopback
      Vite/WebSocket register → HTTP disclosed synthetic outside/denied files:
      2 native RED → 3 GREEN, allowed redirect сохранён. No secrets/user files.
      Initial macOS root-alias 403 исправлен realpath, не security RED.
      Eight integrities/hooks/selected runtime reviewed, rest graph unchanged.
      Full default 2251 pass / 1053 skips, exit 0 (19.09s); types/format/frozen
      install GREEN. Prod audit 0/exit 0; full audit 2 (1 high / 1 moderate),
      exit 1 / 828 deps: braces + legacy esbuild. Manual Q1m/Q1p blockers и
      Q1/A7/external gates остаются, не app-browser/remote-app exploit, не выложено.
      Q1r: scoped js-yaml 4.3.2 в ESLint/eslintrc; empty merge budget,
      hard sequence limit и default depth: 3 native no-throw RED → 4 GREEN.
      Ordinary YAML/merge/omap/multi-doc/dump preserved; numeric underscores
      теперь strings, aliases materialization не защищено этим обновлением.
      Integrity/hooks/selected runtime review, deps unchanged; no major 5.x.
      Full default 2248 pass / 1053 skips, exit 0 (20.97s); types/lint/format/
      frozen install GREEN. Prod audit 0/exit 0; full audit 4 (1 high /
      3 moderate), exit 1 / 828 deps. Registry esbuild/Vitest/mocker/braces
      + manual Q1m/Q1p остаются; Q1/A7/внешняя приёмка открыты, не выложено.
      Q1q: scoped brace-expansion 1.1.21 только ESLint/minimatch 3 edge;
      output count/product/character bounds: 3 native RED → 4 focused GREEN,
      соседний minimatch вместе 7 pass. Ordinary brace/range/escape/dollar
      semantics сохранены; pathological patterns truncate/fallback to literal.
      Integrity/hooks/runtime diff reviewed, deps unchanged, 5.x untouched.
      Full default 2244 pass / 1053 skips, exit 0 (20.88s); types/lint/format/
      frozen install GREEN. Prod audit 0/exit 0; full audit 8 (4 high /
      4 moderate), exit 1 / 828 deps. Не все семь атак воспроизведены отдельно,
      не universal sandbox/app exploit/browser proof. Q1m/Q1p manual blockers
      остаются сверх registry count, Q1/A7/внешние gates открыты; не выложено.
      Q1p: scoped AJV 6.14.0, invalid $data regex SyntaxError: 2 RED → 3 GREEN;
      ordinary/defaults/static/dynamic validation сохранены. Runtime deps
      unchanged, integrity/hooks/upstream diff reviewed; re2 не добавлен.
      Full default 2240 pass / 1053 skips, exit 0 (22.58s); types/lint/format/
      frozen install GREEN. Prod audit 0/exit 0; full audit 15 (9 high /
      6 moderate), exit 1. ВАЖНО: default-engine $data ReDoS на actual 6.14.0
      всё ещё timeout 2s в owned child, новый engine только opt-in. Manual AJV
      blocker + Q1m остаются сверх registry count; не app exploit/Q1 completion.
      Q1o: yaml 2.8.3, exact dev peer + scoped override; generated optional-peer
      removal остановлен до install. Integrity/hooks/runtime diff reviewed.
      parse/parseDocument/parseAllDocuments RangeError: 3 native child RED →
      4 GREEN, ordinary config/docs/flow unchanged. Не depth/CPU/memory limit.
      Full default 2237 pass / 1053 skips, exit 0 (19.81s); root types/format/
      frozen-ignore-scripts install/legacy Vite build GREEN; old font warning.
      Prod audit 0/exit 0; полный audit 16 (9 high / 7 moderate), exit 1.
      js-yaml/Q1m manual blocker/A7/внешние gates остаются открыты.
      Q1n: scoped humanfs/node 0.16.8 + related core 0.19.2/types 0.15.0;
      три integrities совпали, reviewed prepare hooks не выполнялись.
      Actual ESM copy/copyAll на owned temporary fixtures: 2 RED → 2 GREEN;
      symlinks сохранены, обычный copy работает, cleanup без dereference.
      Full default 2233 pass / 1053 skips, exit 0 (22.05s); types/lint/format/
      frozen-ignore-scripts install GREEN. Production graph unchanged.
      Prod audit 0/exit 0; полный audit 17 (9 high / 8 moderate), exit 1,
      828 dependencies. Не sandbox/app exploit/SQL/browser/device proof;
      Q1m manual blocker и все внешние gates остаются открыты.
      Q1m: scoped minimatch 3.1.2 → 3.1.5; stars/globstar bounded children
      2 RED → 3 focused GREEN, ordinary lint/partial semantics сохранены.
      Full default 2231 pass / 1053 skips, exit 0 (23.04s); root types/lint/
      frozen-ignore-scripts install/formatting GREEN. Production graph unchanged.
      Prod audit 0/exit 0; полный audit 18 (9 high / 9 moderate), exit 1.
      ВАЖНО: nested-extglob на actual 3.1.5 всё ещё timeout 2s в owned bounded
      child, несмотря на patched metadata; manual tooling blocker остаётся
      открытым. Не app exploit, не полная Q1 готовность; далее независимый срез.
      Q1l: scoped picomatch 2.3.1 → 2.3.2, только micromatch tooling graph;
      4 actual RED → 5 focused GREEN (inherited classes + bounded extglob child).
      Ordinary glob/exclusions сохранены; integrity/hooks/upstream review GREEN.
      Full default 2228 pass / 1053 skips, exit 0 (24.11s); root types/frontend
      lint/Next build/frozen ignore-scripts install GREEN. Prod audit 0/exit 0;
      полный audit 21 (12 high / 9 moderate), exit 1. Production graph unchanged;
      не SQL/browser/device/clean Linux proof, rollout и остальные Q1 gates открыты.
      Q1k: flatted 3.3.3 → 3.4.4, только ESLint cache graph; compiler types
      сохранены 7.28.5 scoped pin после preview drift. Registry integrity/hooks
      проверены; 4 bounded child RED → 5 focused GREEN, без prototype mutation.
      Full default 2223 pass / 1053 skips, exit 0 (22.19s); root types/formatting/
      frozen install и actual ESLint cold/warm cache GREEN (390 entries,
      одинаковый hash). Own cache удалён после ownership/hash проверки.
      Prod audit 0/exit 0; полный audit 23 (13 high / 10 moderate), exit 1.
      Это tooling, не app exploit/browser/SQL или полная Q1 готовность.
      Q1j: Babel core 7.28.5 → 7.29.6 + reviewed related Babel graph;
      16 registry integrities совпали, install/prepare hooks отсутствуют.
      Два outside-package map disclosure RED → 12 focused GREEN; actual
      styled-jsx transform сохраняет scoped CSS. Full default 2218 pass /
      1053 opt-in skips, exit 0 (20.10s); types/Next/lint/legacy build/formatting/
      frozen install GREEN. Legacy font warning сохранён; не SQL/browser E2E.
      Prod audit 0 findings, exit 0 (325 dependencies). Полный tooling audit:
      25 findings, 15 high / 10 moderate, exit 1 (827 dependencies); triage далее.
      Q1/A7/rollout и внешняя приёмка не закрыты; не пушили и не выложено.
      Q1i: related tRPC server/client/react-query 11.7.2 → 11.8.0 с aligned
      exact peers; excluded Expo прежний. Два bounded child pollution RED →
      27 focused dependency/compiled entrypoint/native Nest HTTP GREEN.
      Full default 2215 pass / 1053 opt-in skips, exit 0 (18.32s), root types/
      backend/Next/legacy Vite build/API/boundaries/formatting/frozen install.
      Legacy font warning сохранён; browser/SQL/clean Linux не подменяются.
      Prod audit 1 low, 0 moderate/high/critical, exit 1: Babel ещё открыт;
      migrations/rollout и внешняя приёмка не завершены.
      Q1h: Browserslist 4.28.1 → 4.28.7 + related datasets; baseline 2.9.8
      удалена в пользу existing 2.11.27. Три custom-stats TypeError RED →
      4 focused GREEN; cache eviction/CLI не выдаются за stress/сквозную приёмку.
      Full default 2212 pass / 1053 opt-in skips, exit 0 (21.96s), root types/
      frontend build/formatting/frozen-ignore-scripts install проходят.
      Prod audit 2 (0 critical / 1 high / 0 moderate / 1 low), exit 1, не clean;
      остались tRPC/Babel, migrations/rollout и внешняя приёмка открыты.
      Q1g: body-parser override 1.20.4 → 1.20.6; parent qs override сохраняет
      patched 6.16.0. Восемь malformed-config startup RED → 87 dependency/
      request-body/native Nest/webhook HTTP GREEN; valid app quotas неизменны.
      Full default 2208 pass / 1053 opt-in skips, exit 0 (20.02s), root types/
      backend build/formatting/frozen-ignore-scripts install проходят.
      Prod audit 5 (0 critical / 3 high / 1 moderate / 1 low), exit 1, не clean.
      Не app exploit/SQL/provider proof; остальные findings и rollout открыты.
      Q1f: sharp root/backend + Next scoped override → 0.35.5; actual macOS
      librsvg 2.63.2/libvips 8.18.7. 27 integrity/hooks metadata проверены;
      81 native decoder/profile HTTP/media pass до и после, без RCE RED claim.
      Full default 2200 pass / 1053 opt-in skips, exit 0 (24.12s), root types/
      backend + frontend build/formatting/frozen-ignore-scripts install проходят.
      Prod audit 6 (0 critical / 3 high / 1 moderate / 2 low), exit 1, не clean.
      API SVG gate/block сохранены; clean Linux/native smoke и rollout открыты.
      Q1e: qs override 6.14.0 → existing 6.16.0; три bounded upstream RED →
      79 dependency/request-body/native Nest/webhook HTTP GREEN (не SQL/provider).
      Full default 2200 pass / 1053 opt-in skips, exit 0 (19.30s), root types/
      backend build/formatting/frozen-ignore-scripts install проходят.
      Prod audit 7 (0 critical / 4 high / 1 moderate / 2 low), exit 1, не clean.
      Parser/auth/trust/CORS/quotas неизменны; rollout и прочие findings открыты.
      Q1d: source-map-js override 1.2.1 → 1.2.2, четыре unsafe-offset
      construction RED → 5 focused GREEN, valid indexed mapping сохранён.
      Full default 2196 pass / 1053 opt-in skips, exit 0 (23.08s), root types/
      frontend build/formatting/frozen-ignore-scripts install проходят.
      Prod audit 11 (0 critical / 4 high / 4 moderate / 3 low), exit 1.
      Build graph risk, не подтверждённый app exploit; rollout ещё открыт.
      Q1c: Axios root/backend 1.20.0 и reviewed related transport graph;
      bounded fetch limit RED → GREEN, real SDK/loopback HTTP сохраняет три
      JSON POST и отказ 502; cookie/session вместе = 13 focused pass.
      Full default 2191 pass / 1053 opt-in skips, exit 0 (17.88s), types/build/
      formatting/frozen-ignore-scripts install проходят. Prod audit теперь
      12 (0 critical / 5 high / 4 moderate / 3 low), exit 1, не clean.
      Inbound trust/auth/CORS/квоты неизменны; external OAuth/outbound proxy,
      clean Linux install и rollout не подтверждены. Legacy-expo вне workspace.
      Q1b: path-to-regexp 0.1.12 → 0.1.13, bounded child timeout RED →
      32 dependency/native HTTP/security GREEN; generated lock diff только matcher.
      Frozen/ignore-scripts install/root types/backend build проходят;
      prod audit 49 (0 critical / 19 high / 26 moderate / 4 low), не clean.
      First full run: 8 subprocess timeouts; focused serial = 85 pass, full
      serial повторил один timeout. pmset log подтвердил 300-second Maintenance
      Sleep внутри обоих full runs; проверка под scoped caffeinate, без смены
      timeout/CI или постоянных настроек питания.
      Protected serial full run = 2188 pass / 1053 skips, exit 0 (77.73s).
      Default parallelism с тем же scoped sleep assertion: 2188 pass / 1053
      skips, exit 0 (17.34s). Assertion снят вместе с завершением own процесса.
      Q1a: proxy-addr override 2.0.7 → 2.0.8; два upstream defect RED →
      20 dependency/native HTTP/client-IP GREEN, прежний loopback trust сохранён.
      Full default 2187 pass / 1053 skips; types/backend build/lint проходят.
      Fresh prod audit 50 (0 critical / 20 high / 26 moderate / 4 low), не clean.
      Frozen/ignore-scripts install и reviewed generated lockfile; Linux rollout,
      SQL acceptance и остальные dependency findings остаются открыты.
- [ ] Q2: критерии нагрузки/baseline, Safari/Android/desktop/PWA приёмка.
- [ ] Q3: матрица сдачи, backup/rollback, инструкция, пилот 5–7 дней/30–50 участниц.

Следующий срез: оставшаяся локальная A6/Checkpoint A приёмка и подготовка A7;
webmail exception согласован/проверен, обычный вход после привязки проверен.
Рабочая история миграций/rollout/deployment остаются отдельными gates.
Форма/worker остаются выключены до целостного
сценария и схемы. Внешние блокеры не препятствуют локальным A/C/M/V задачам.

## Requested frontend corrections — 2026-10-09

- [x] Bind the durable draft notice to the captured editor/owner/slot; add
  controlled IndexedDB race regressions for both editors.
- [x] Separate Prodamus demo UI from live/YooKassa TEST: 790 RUB / 30 days,
  one-off, guest login after plain `/club` return, server-confirmed access and
  profile expiry; reject mismatched demo links and conflicting build flags.
- [x] Stabilize the known browser-test causes: clock drift, ambiguous retry
  selector, scroll-hidden Back button and premature unconfirmed-create assertion.
  Attachment pickers await the checkpoint before clicking; four server-MIME/size
  retry scenarios pass three times each (12/12).
- [x] Types/lint/API (73 procedures), 541 frontend/client/contract/quiz checks,
  and 568-file dependency boundary check.
- [x] Normal and Prodamus TEST production builds; both editor race regressions
  RED on the old hook, each GREEN three times. Other affected scenarios pass
  three times, Moscow-midnight five times. Prodamus TEST browser flow and
  320/390/1440 px layout pass; normal UI remains unchanged.
- [x] Separate YooKassa TEST build and browser regression preserve the existing
  result-check, canceled intent and explicit next-purchase flow.
- [x] Full browser acceptance: 456 pass / 3 real-API skips in six checked batches;
  all 459 manifest IDs accounted for exactly once, no unexpected/flaky in final
  reports. Batch 4 passed 77/77 after the chooser fix; interrupted partial
  90-case run is not used in the final result.
  Loopback/mock-API execution authorized by user; no API/database/payment/deploy.
  Dockerfile reverted as requested; no image-build mode selection added.
- [ ] Shop 4.12: agree manager request form and server acceptance/outbox contract.
  Legacy Expo had online Prodamus checkout, no manager request form. No shop edit.
  Details and remaining acceptance: `apps/frontend/WORK_PLAN.md`.

## Prodamus sandbox connection — 2026-10-08

- [x] Inspect supplied test cabinet and generate/open a synthetic demo invoice.
  Existing subscription definitions and global callback targets found; no global
  settings changed. Their presence does not establish another project's ownership.
  User explicitly confirms this test cabinet was issued for DaryaDarcy.
  Invoice creation is not payment/access acceptance.
- [x] PD1: real webhook refuses ordinary-key demo markers before granting or
  cancelling; fixture + native HTTP RED/GREEN, existing live regressions,
  full/types/build/API/boundaries/docs review and local commit.
  Eight fixture failures and native HTTP 200-before/400-after reproduced the
  missing guard. 13 new cases; full Node 22 suite 1499 pass / 618 SQL/external
  skip. Types/API/build/boundaries pass. Source-only; no provider payment or
  database acceptance, no server flags/callback/key/deployment changes.
- [x] User approved diagnostic-before-entitlement contract on 8 October.
  PD4 still requires its own isolated entitlement design; no live access enabled.
- [x] PD2: default-off separate synthetic-only diagnostic link/receiver, no
  persistence/access/mail. Verify host/merchant/key/amount/demo rejection and
  browser-return non-authority. No live webhook demo-key fallback.
  Operator CLI and bounded native Nest ingress verified: 81 new service/native/
  CLI/compiled cases, 1580 full pass / 618 SQL/external skip. Production ESM
  native probe succeeds; disabling controller registration makes it fail.
  Dedicated configuration per instance, numeric provider IDs, deep input errors,
  replay, wrong bindings/signatures, live-key fallback and cookies are covered.
  No actual provider key loaded, payment made, callback delivered or server changed.
- [ ] PD3 after PD2: scoped test deployment/rollback and actual notification
  delivery; retain working data/overlays, audit/reachability and live blocks.
  Read-only server check: API 300c8d3, web 62c4001, six healthy services; local
  branch remains ahead 40 / behind 1 before this increment. No automatic merge
  or full branch rollout. User selected the dedicated diagnostic service on
  8 October (no DB/mail, one exact ingress path); cannot enable by env alone.
  Standalone Nest composition and compiled isolation acceptance complete locally:
  19 additional cases, full 1599 pass / 618 SQL/external skip. Source-only,
  no secrets loaded or containers/edge changed. Exact runtime/dependency and
  edge rollout review remain; the current API image cannot be assumed to supply
  Nest/reflect-metadata (package-resolution probe reports unavailable).
  Provider-assigned SYS and callback isolation need support confirmation before
  a real demo callback probe; arbitrary fixture SYS is not provider approval.
- [ ] PD4 after PD3: separately approved isolated test-entitlement contract and
  disposable SQL replay/rollback acceptance before demo access activation.
- [ ] Recurring provider test: verify the selected test subscription's price,
  interval and notification routing. Do not infer foreign ownership from existing
  definitions. No changes to existing subscribers or real charges are authorized.

Ownership correction, 8 October: read-only cabinet settings show demo mode, an
integration-key field and demo URL notifications not disabled. The configured
notification target is not DaryaDarcy; it must be reviewed/reconfigured for this
test flow, not treated as proof of a foreign cabinet. The documentation's per-link
SYS requirement is separate from cabinet-level notification settings; inspect the
documented global route before claiming support is the only possible connection
path. No key disclosed, callback changed, payment made or service deployed here.

## Phase 0 — Safety net

- [x] Make S3 integration tests credential-aware.
- [x] Remove stale source-text test expectations.
- [x] Capture public backend/router contracts.
- [x] Green checkpoint: test, type check, backend build.

## Phase 1 — Repository boundaries

- [x] Create workspace/ADR/package skeleton.
- [x] Move legacy Vite client to `apps/legacy-web`.
- [x] Move deployment assets to `infrastructure/deploy`.
- [x] Move repository helpers to `tooling/scripts`.
- [x] Green checkpoint: root commands and both current builds.

## Phase 2 — Backend and data

- [x] Move backend to `apps/backend`.
- [x] Move schema/migrations to `packages/database`.
- [ ] Extract domain routers and repositories.
  HTTP policy, billing, identity, launch configuration and comment repositories
  separated; club and moderation routers extracted without API changes;
  feed, articles and notification routers extracted with unchanged compiled handlers;
  legacy unused comment accessors removed; all tRPC namespaces now have domain
  modules, the root composes only. Remaining work: split db.ts/platform-db.ts
  repositories and large admin internals.
  Video catalogue's seven persistence operations are now separated with an
  unchanged caller facade; see the 9 October checkpoint below. Other domains
  and removal of compatibility facades remain open.
- [ ] Green checkpoint: API contract, tests, check, backend build.

## Phase 3 — Frontend

- [x] Move Expo application to `apps/frontend`.
- [x] Isolate shared contracts in `packages/shared`.
- [x] Verify web/iOS/Android configuration paths.
- [x] Green checkpoint: Expo web build, tests, check.

## Phase 4 — Enforcement

- [x] Add dependency-boundary checks (263 source files, narrow type/build exceptions).
- [ ] Remove temporary facades and stale paths.
- [ ] Split remaining oversized modules.
- [ ] Run final correctness, architecture, security, and performance review.

## Backend safety / launch follow-up — 2026-10-02

- [x] B01: Return/webhook trust boundary; unsigned, invalid/demo and failed events
  never grant or cancel. Files: prodamus.ts, billing-webhook.test.ts.
- [x] B02: Checkout is not login; claimPending only reports verified access;
  blocked email rejected. Files: routers.ts, db.ts, billing-checkout.test.ts.
- [x] B03: Blocked staff/public post details obey a shared access policy.
  Files: trpc.ts, routers.ts, access-policy.test.ts.
- [x] Checkpoint: full tests, type check, API build and evidence-backed review.
  215 passed / 3 skipped; check/build/diff-check pass. This is not release approval.
  Prototype pollution in webhook parser additionally reproduced and repaired.
- [ ] B04: Atomic/idempotent billing + amount/currency/provider identity validation.
  Acceptance: sequential/concurrent duplicate extends once, mismatched sum rejected.
  Verify: isolated MySQL integration tests + sandbox notification fixtures.
  Local club implementation and real-MySQL tests done; sandbox and legacy
  reconciliation pending. Shop remains outside this stage and must stay off at launch.
- [ ] B05: Email verification/setup/reset; no email-inferred staff privileges.
  Acceptance: expired/reused token rejected, existing password untouched.
  Verify: identity HTTP tests + migration rehearsal.
  Backend links/versioned sessions/explicit staff roles done locally;
  Frontend recovery entry and strict SMS capability switch checked locally;
  insert-only registration + atomic consent/setup outbox, email proof before
  password/login and explicit frontend consent checked on local HTTP/MySQL.
  staff preflight and production migration rehearsal pending.
  Read-only migration preflight added: detects orphan 0017–0019, changed hashes,
  unknown/gapped DB history; explicit connection only, no auto-apply. Migration
  0024 email/outbox indexes checked on disposable MySQL with lock-scope tests.
- [ ] B06: Transactional email outbox and resend.
  Acceptance: crash/retry loses no event, duplicate payment queues one message.
  Verify: worker failure/recovery integration tests.
  Atomic club outbox, leased workers, discarded status and audited staff resend
  implemented locally; real SMTP/device/operator acceptance pending.
- [ ] B07: Provider-confirmed cancellation and immediate block enforcement.
  Acceptance: failed provider response cannot report cancellation success;
  paid expiry retained. Verify: sandbox cancellation + all access-path tests.
  Durable request/confirmation, real local HTTP provider errors and retry checked;
  live sandbox profiles and legacy blacklist reconciliation pending.
- [ ] B08: Media validation, closed-body access and comment retention.
  Acceptance: non-image rejected, EXIF removed, protected body unavailable publicly.
  Verify: file fixtures and API authorization tests.
  Photo slice checked: avatar/post/comment JPEG/PNG/WebP decode and re-encode,
  metadata removal, server-owned filenames, 4 MiB/20 MP/concurrent decoder limits.
  13 photo scenarios pass; full local suite 236 pass / 32 skip (DB not provisioned),
  check/build/diff-check pass. Private legacy assets and retention still pending.
  Content/retention slice checked: published status enforced in feed/club/saved
  queries and discussion API; comments retained 365 days, bounded transactional
  cleanup also removes likes/reports and detaches newer replies.
  Disposable-MySQL checkpoint: 271 passed / 3 skipped, check/build/diff-check pass.
  Existing public storage links are NOT revoked by this API repair; migration and
  any optional protected-video implementation remain explicit release decisions.
  URL-import SSRF repaired: no external server-side download; accept only exact
  configured S3 origin + bucket. File upload/provider embeds remain separate paths.
  Eight spoofed/internal URL scenarios checked; full MySQL suite 292 pass / 3 skip.
- [ ] B09: First-release capabilities and seasonal/manager configuration.
  Acceptance: disabled SMS/shop payment/pen-pal routes cannot be called directly.
  Verify: capability matrix API tests and admin configuration roundtrip.
  Server guards checked for SMS, pen-pal discovery/matching and all legacy shop
  entry points (checkout/redirect/webhook/queued mail). Privacy withdrawal remains
  available. Shop cannot be enabled by an environment flag before durable repair.
  Seasonal/manager configuration and client wiring are still pending.
  Configuration slice checked locally: four seasonal sets/annual Moscow dates,
  fixed winter default, managerEmail, administrator-only revisioned/audited writes.
  Tests include concurrent edits, blocked actor, invalid dates/URLs and real JWT
  HTTP admin/public roundtrip. Migration 0023 rehearsed only on disposable MySQL.
  Client wiring/order submission still pending; contact config is not sent mail.
- [ ] Release checkpoint: sandbox E2E, migrations rehearsal, mail/load/security
  checks and approved rollout. Optional HLS/web push require separate scope review.
  Browser/API repair checked: explicit credentialed Origin allowlist, cross-site
  rejection before handlers, provider signature/return boundaries exempt, native
  JSON compatibility, no-sniff/referrer/framing headers and canonical client IP.
  Reverse proxy trust restricted to loopback; remote proxy topologies need review.
  GitLab/GitHub verification pipelines added with disposable MySQL, guarded test
  database URLs, frozen installs, boundaries/types/tests/API/web/post-build checks.
  Local equivalent: 341 passed / 3 skipped, both builds and regression pass.
  YAML parsed; remote runner execution has NOT been performed. No auto deployment.

## Repository navigation cleanup — 2026-10-02

- [x] R01: Group documents and archive historical notes without losing files/tasks.
  Verify: move inventory, relative links and tracked reference scan.
- [x] R02: Concise entry README/docs index/current backend and workflow guides.
  Verify: manual onboarding walk-through and link check.
- [x] R03: Separate one-off legacy tools; preserve normal command paths.
  Verify: command/import inventory and local build commands; no remote script run.
- [x] R04: Local-doc links tested and checked in CI; final types/tests/build review.
  Verify: failing fixtures → passing check, API/web/legacy builds, clean diff.
  Cleanup checkpoint: all 1070 original tracked files accounted for; 253 paths
  relocated, root Markdown reduced to README only. Current docs separated from
  archival snapshots; active tasks and runtime assets/licences preserved.
  Tools grouped into scripts/assets/data/operations/legacy at the same depth.
  Package command paths resolved; 99 JS/60 Python/4 shell files syntax-checked
  without executing remote operations. Frozen install passed without lock changes.
  Link checker: red fixtures first, then unit/isolated-Git CLI coverage; 40 current
  documents pass. CI gate added; remote pipelines have not been executed.
  Final local disposable-MySQL suite: 469 passed / 2 skipped. Types, 279-file
  boundaries, API build, legacy Vite build, main Expo web build and 52-test verify
  passed. Legacy font warning remains; no deployment or release approval.

## Repository hygiene follow-up — 2026-10-02

- [x] C01: Canonical frontend public resources; packaging fails on missing files.
  Verify: red/green isolated packaging tests and both web builds with byte checks.
  Three fixture tests failed for the intended omissions before the repair, then
  passed. Legacy Vite and Expo exports passed; public-resource bytes preserved.
- [x] C02: Preserve historical deployment artifacts in the audit archive; ignore
  generated reports and document active configuration versus old snapshots.
  Four artifacts moved with exact byte comparison against Git originals. Lifecycle
  policy unchanged; both old/current report output paths ignored, archive tracked.
  Existing S3/SSH root/path mismatch documented; repair remains separate work.
- [x] C03: Remove empty root placeholder; align Cursor guidance with monorepo and
  explicit deployment authorization; verify links/types/boundaries/local tests.
  Local checkpoint: 409 tests passed / 65 skipped without a test MySQL. Types,
  279-file boundaries, 40-document links, API/Vite/Expo builds and 52-test verify
  passed. Legacy Vite font warning remains. Root .gitkeep removed (recoverable in
  Git); source, licences and unfinished backend tasks preserved. No push/deploy.

## Current-team ownership cleanup — 2026-10-02

- [x] C04: Delete irrelevant editor/generator/one-off artifacts, remove stale
  commands/links and ignore local Cursor settings. Preserve deployment and its
  helper closure, current requirements/audits, CI, runtime sources and open tasks.
  Verify: protected-file hashes, reference scan, docs/boundaries/types/tests/builds.
  Removed 37 tracked files, including Cursor rules, unused Expo reset, old report
  generator/command, archived npm lock/QR and spent notes/diagnostic scripts.
  Protected-file digest confirms 815 runtime/deploy/CI/lock files unchanged.
  Frozen install, 37-document links, 279-file boundaries, types, API/Vite/Expo
  builds and 52-test verify passed; final local suite 409 pass / 65 skip without
  test MySQL. Vite font warning remains. Removed files recoverable from 9c39659;
  no push, external operation or release approval.

## Backend continuation: notification access — 2026-10-02

- [x] N01: Blocked accounts excluded from every push delivery audience; latest
  consent resolves equal-second events deterministically. Extends B07.
  Verify: failing real-MySQL regressions, permitted/denied recipient matrix,
  grant/revoke ties, full local suite/types/boundaries/API build and contract.
  Confirmed both defects with real MySQL: 14 of 15 focused cases failed before
  the fix; all 15 pass after. Full disposable-MySQL suite: 487 pass / 2 skip;
  types/boundaries/docs/API build/52-test verify pass. No schema/API changes or
  external notifications. Already-queued messages/device acceptance remain out
  of this local guarantee; B07 and the overall release checkpoint stay open.
- [x] N02: Push failures cannot be reported as successful submissions. Validate
  HTTP/JSON/ticket outcomes, preserve audience filtering and 100-message chunks.
  Verify: failing transport fixtures, partial batches, full suite/types/API build.
  Confirmed 13 failing cases before repair; all 17 transport regressions pass.
  Full disposable-MySQL suite: 504 pass / 2 skip; types/boundaries/docs/API build
  and 52-test verify pass. Only provider acceptance is counted, not device delivery.
  Real devices, receipts/retries and stale-token cleanup remain separate work.

## Backend continuation: account retention — 2026-10-02

- [x] N03: Account anonymization is atomic and rechecks eligibility under the
  billing owner lock. Late failure rolls back all profile/comment/activity edits;
  concurrent workers count once; a committed renewal prevents stale deletion.
  Verify: real-MySQL failure/renewal/concurrency tests, existing 30-day and active
  subscription rules, full suite/types/boundaries/docs/API build. No live purge.
  Three failures reproduced before repair; all 8 real-MySQL cases pass after.
  Full suite: 512 pass / 2 skip; types/boundaries/API build/52-test verify pass.
  Financial/audit/backup/S3 and old mail/link retention remain separate work;
  B08 and release checkpoint remain open, not complete erasure or release approval.
- [x] N04: Manual club grants serialize with settlement and account retention;
  distinct simultaneous grants accumulate every day with distinct order IDs.
  Preserve API/default duration; validate days and reject blocked/deleted users.
  Verify: real MySQL concurrency/expiry/recipient/bounds tests, full suite and API
  contract/types/boundaries/docs/build. Retried HTTP intent idempotency not added.
  Six original failures → all 12 focused cases pass, including 10 simultaneous
  grants with independent order IDs and all added days preserved. Full suite:
  524 pass / 2 skip; types/280-file boundaries/docs/API build/52-test verify pass.
  Module billing/grants.ts owns the transaction; router/facade signatures unchanged.

## Backend continuation: video publication boundaries — 2026-10-02

- [x] N05: Hidden videos cannot be fetched by public ID or streamed through the
  YouTube proxy; unknown catalog IDs never invoke downloader/upstream transport.
  Verify: real HTTP/MySQL list/detail/stream/Range/cache-revocation fixtures,
  internal hidden-video dedup, full suite/types/contract/boundaries/docs/API build.
  Public S3/YouTube originals and already-open streams stay outside this guarantee.
  Four original assertion failures → all 8 HTTP/MySQL cases pass. Parallel fixture
  ID collision separately reproduced and fixed only in guarded test setup.
  Full suite on reused and freshly provisioned MySQL: 533 pass / 2 skip;
  types/280-file boundaries/docs/API build/52-test verify pass. B08 stays open.

## Backend continuation: scheduled publication ownership — 2026-10-02

- [x] N06: Scheduled workers return only their own committed publications;
  concurrent workers do not duplicate announcement inputs, and an admin's
  withdrawal while a row is locked is not returned as a publication.
  Verify: real MySQL locks/concurrency/rollback/date and eligibility matrix,
  full suite/types/contract/boundaries/docs/API build. Push outbox/retries and
  manual confirmScheduledPost announcement ownership remain separate work.
  Two actual assertion failures on the original worker → all 4 MySQL scenarios
  pass, including two worker batches, next tick, withdrawal and trigger rollback.
  Full suite: 537 pass / 2 skip; types/280-file boundaries/docs/API build and
  52-test verify pass. No real push or schema change; release checkpoint stays open.

## Backend continuation: manual publication ownership — 2026-10-02

- [x] N07: admin.confirmPost announces only its own committed draft/scheduled
  transition, never an already-published retry or scheduler-owned publication.
  Preserve early confirmation/date rules and HTTP result. Verify real authenticated
  HTTP/MySQL repeats/concurrency/scheduler/rollback/role and missing-row cases,
  full suite/types/boundaries/docs/build. No push-outbox or updatePost guarantee.
  Four original assertion failures → all 10 real authenticated HTTP/MySQL cases
  pass. Legacy published/false visibility is still repairable; repeat HTTP result
  remains {success:true}. Full suite: 547 pass / 2 skip, types/281-file boundaries/
  docs/API build/52-test verify pass. Fixtures for global scheduler suites are
  mutually exclusive, while their actual concurrent workers remain real.

## Backend continuation: atomic post editing — 2026-10-02

- [x] N08: Post edits and replacement videos commit/rollback together; edit
  publication shares ownership with manual/scheduled paths and uses saved text.
  Verify real HTTP/MySQL partial failure/decoded filenames/optional vs empty video
  lists/non-video preservation/concurrency/date and missing-row regressions,
  full suite/types/contract/boundaries/docs/API build. createPost, uploadMedia,
  optimistic revisions, full request idempotency and push outbox remain separate.
  Nine genuine regression failures on the original route → 24 real HTTP/MySQL
  cases and 6 route unit cases pass. Full suite: 561 pass / 2 skip; types,
  283-file boundaries, docs, API build and 52-test verify pass.
- [ ] Investigate one transient parallel registration failure (both race
  requests returned 500); MySQL's error counters record deadlocks at the same
  time, but the precise cause is not established. Five subsequent full runs
  pass without changes to registration. Do not treat this as repaired or hide
  it with test retries. Reproduce with SQL diagnostics on a fresh test database.
  Investigation 2026-10-03: 11 full runs on a new disposable database and
  8 paired registration/retention runs pass. Statement history captures no
  registration deadlock; global error counters also rise during successful runs.
  Those counters alone do not establish the endpoint failure's cause. Still open.
  Recurred during N11 on 2026-10-05: both responses were 500. InnoDB's latest
  deadlock was an earlier content-test cleanup, not this registration attempt.
  A subsequent diagnostic full run with statement history enabled passed;
  do not call registration fixed or enable automatic test retries.

## Backend continuation: atomic post creation — 2026-10-03

- [x] N09: New post and initial videos commit or roll back together. Preserve
  numeric response, normalization/status/date rules and permissions; announce
  only after commit. Check real HTTP/MySQL failures/pending visibility and
  scheduler behaviour, then full suite/types/boundaries/docs/build/regressions.
  Legacy teasers, standalone uploads, HTTP idempotency and push outbox stay open.
  Four real regression failures on the old path → all 35 HTTP/MySQL content
  cases pass, including 11 new creation cases. Full suite: 572 pass / 2 skip;
  types, 284-file boundaries, docs, API build and 52-test verify pass.

## Backend continuation: safe MySQL backups — 2026-10-05

- [x] N10: Remove database credentials from process arguments/errors; finalize a
  private gzip only after successful dump exit and completed output. Failed jobs
  remove their own partial/config files and can retry on the next scheduled tick;
  concurrent callers share one in-process job. Regression tests reproduce four
  original failures and two scheduling failures; real MySQL 8.4 option parsing
  and dump/restore on a disposable fixture checked. Full suite 554 pass / 2 skip;
  types/lint/API build/contract/boundaries/docs/format pass. Production restore, S3 retry,
  timeout, crash-leftover cleanup and cross-process ownership remain outside N10.
  - [x] Redact raw S3 exceptions in the MySQL backup orchestrator's upload and
    retention failure warnings. Three synthetic private-marker RED cases repaired;
    local gzip, exact SDK commands, local retention and warning visibility remain
    verified. Backup tests: 16 pass / 2 native MySQL skip; whole non-MySQL suite:
    839 pass / 4 skip. No real S3 or MySQL restore acceptance in this increment;
    off-site retry/durability and production rehearsal remain open.
- [x] N11: Server-side createPost request idempotency. Lost response/retry must
  return the original post ID, including concurrent identical requests; reject
  reuse of a key for another payload. Preserve legacy clients without a key.
  Four old-path HTTP assertion failures → 35 real HTTP/JWT/MySQL cases pass,
  including a duplicate observed waiting on the owner's actual transaction.
  Additive migration 0025 rehearsed only on disposable MySQL. Latest full suite:
  589 pass / 2 external skip; types/lint/build/72-procedure contract/397-file
  boundaries/41-document links pass. Earlier full run failed the existing
  registration race, still open above. No production migrations or external push.
- [ ] Wire stable createPost intent keys into the frontend editor and its
  uncertain-response/retry flow, with browser verification. Backend optional
  support alone does not protect today's unkeyed frontend calls.
- [ ] N12: Transactional publication push outbox; worker crash/retry cannot lose
  an announcement. Provider delivery/deduplication limits must remain explicit.

## NestJS migration — 2026-10-05

- [x] M01: Review/pin Nest dependencies; keep pnpm/Vitest/esbuild/Drizzle.
  Acceptance: scripts disabled, one lockfile, baseline suite/types/build preserved.
  Verify: pnpm test with disposable MySQL; pnpm check; pnpm build; native audit.
  Files: apps/backend/package.json, pnpm-lock.yaml, tsconfig.json, ADR-005.
  Dependencies: none; scope: medium.
  Verified: Nest 12.1.2 family, reflect-metadata 0.2.2, RxJS 7.8.2; frozen
  ignore-scripts install. Baseline and post-dependency runs: 589 pass / 2 skip.
  Types/build/lint/API/docs pass; audit unchanged at 33 high/36 moderate/4 low.
- [x] M02: Nest HTTP runtime with native health/capability controllers.
  Acceptance: one HTTP application, unchanged security/parsers/tRPC contracts;
  runtime creation performs no worker/external side effects, close releases port.
  Verify: tests/nest-application.test.ts; pnpm check; pnpm build; full suite.
  Files: runtime factory, app module, system controller, launch module, HTTP tests.
  Dependencies: M01; scope: medium. Executable switch is a separately verified step.
  Real factory starts no jobs/listener; 20 real HTTP checks cover parser/auth/CORS/
  HMAC/logout/tRPC/disabled features/close. Executable switched in M02b below.
- [x] M02b: Use Nest runtime from the existing production/dev executable.
  Acceptance: same host/port/timeouts and routes; actual built artifact starts.
  Verify: built-process loopback smoke; full suite/types/build/contract checks.
  Files: _core/index.ts, backend README, root README, architecture API docs.
  Dependencies: M02; scope: medium.
  Verified: the compiled Node entrypoint includes the Nest modules, serves real
  health/capabilities HTTP, and rejects an occupied production port (3 tests).
  Full MySQL suite: 612 pass / 2 external skip; types/build/lint/API/boundaries/
  documentation pass. A shared-fixture latest-post assertion failed once;
  deterministic owned ordering dates fixed it, without changing production code.
  Workers still use existing intervals; Nest shutdown lifecycle is deferred to M07.
- [x] M03: Native launch settings controller/service, preserving JWT/Drizzle.
  Acceptance: HTTP shapes/statuses, role checks, optimistic revision and audit
  transaction preserved; only one production registration for each endpoint.
  Verify: real Nest HTTP/JWT/MySQL roundtrip/conflict/blocked-user tests.
  Files: launch controller/service/module, runtime factory, existing settings tests.
  Dependencies: M02b; scope: medium.
  Verified: launch routes now belong only to LaunchController/LaunchService;
  unused Express launch adapter removed. Real Nest/JWT/MySQL suite preserves
  save/read/public response shapes, 401/403/415, safe 400, stale-edit 409, audit
  transaction and role/block changes with an existing token. Full suite: 620
  pass / 2 external skip; types/build/lint/72-procedure API/402-file boundaries/
  42-document checks pass. Built Node process also exercises safe settings failure.
- [x] Checkpoint: Nest foundation + launch verified; record actual migration gaps,
  dependency advisories and earlier registration failure before continuing.
  Only foundation + launch are native so far. Identity/password/payment/media
  adapters, tRPC service composition, worker intervals and Drizzle pool ownership
  are transitional. Native audit and release gates remain open; registration
  race was not reproduced in these runs and is NOT declared fixed. No frontend
  code, SQL schema, deployment configuration, production data or remote push changed.
- [ ] M04: Specify and migrate identity adapters/guards; retain sessions/password
  invariants and investigate the existing intermittent registration race.
  - [x] M04a: Native PasswordController/PasswordService and IdentityModule;
    password request/completion/setup page + staff access resend. Previous
    identity/routes adapter removed; real Nest/MySQL mail/setup/provider-boundary
    tests retain one-use links, no automatic session, safe recipient response,
    CSP nonce, no-store and staff/block/audit rules. 621 pass / 2 external skip;
    types/lint/API/boundaries/docs/backend build pass; Next production build passes.
  - [x] M04b: Native session/login/registration/SMS transport + injected service;
    remove OAuth adapter, preserve cookies/TOTP/rate limits/disabled features.
    Verified: 10 real-password/JWT/MySQL tests cover login/cookie/Bearer bridge,
    database session revocation/blocking, independently calculated TOTP and
    quota; existing registration and cookie regressions pass through Nest.
    Built Node artifact invokes the injected login service. Previous OAuth
    adapter removed. Full suite: 631 pass / 2 external skip; types/build/lint/
    API/boundaries/docs pass. Common policy/guards and the registration-race
    investigation still remain; M04 as a whole is not marked complete.
  - [ ] M04c: Shared injectable session/role policy and registration-race diagnosis.
    - [x] M04c1: IdentityModule exports SessionService; native session/launch/
      password controllers share required/optional authentication and role checks.
      New provider contract assertion failed before implementation; real JWT/MySQL
      verifies live role changes, blocking and session-version revocation. Focused
      71 tests and root/Next typechecks pass. Native guards and race diagnosis remain.
    - [x] M04c2: Native AdministratorGuard/AccessEmailStaffGuard + narrow HTTP
      denial filter. Eight added HTTP/JWT/MySQL characterization cases passed
      before and after extraction: legacy plain/JSON errors, no-store, JSON-body
      spoofing, live roles/revocation/blocking, content-type ordering and stricter
      resend origin. Existing successful resend/audit/quotas remain covered.
      Full disposable-MySQL suite: 640 pass / 2 external skip; root/Next types pass.
    - [ ] M04c3: Reproduce and establish the intermittent registration cause.
      Added bounded, code-only error capture around the actual SessionService
      calls; existing HTTP race assertions now retain nested SQL/configuration
      classifications without SQL/recipients/tokens/key material. Its diagnostics
      are verified against actual consent-trigger and invalid-encryption failures.
      A forced twenty-way precheck burst produces one account/token/mail/consent
      and nineteen duplicates; HTTP quota is not disabled (burst uses the domain
      service). Two full runs in this continuation pass, latest 641 / 2 external
      skip. Test MySQL history enabled, no new 1213/1205 observed in that run.
      This does NOT reproduce or repair the earlier HTTP 500/500; no speculative
      retry or registration production change. API build/Next build/types/lint/
      72-procedure contract/406-file boundaries/42-document links pass.
  - [x] N13 separate repair: a blocked account with a correct password previously
    reached a sign-in write and HTTP 500. A real HTTP/MySQL assertion reproduced
    500 vs required 401; PasswordUser now rejects before lastSignedIn/session
    issuance. Uniform invalid-credential response, no cookie/JWT/sign-in write
    verified; staff TOTP and quotas still pass. Latest full suite: 631 pass /
    2 external skip; types/lint/API/boundaries/docs/API build/Next build pass.
- [ ] M05: Specify and migrate content service wiring; preserve N07–N11 regressions.
  - [x] M05a: ContentModule/ContentReadService for post detail, bookmarks and
    interaction aggregation; application-scoped TrpcModule/TrpcService composes
    the HTTP router and optional session via injected services. Common club policy
    moved unchanged into identity, no content→tRPC policy dependency. Nine added
    real HTTP/JWT/MySQL cases preserve unpublished/paid visibility, saved order/
    media, live role/expiry/block/version and auth failures. Removing the existing
    paid-detail check deliberately caused four assertion failures; restored before
    extraction (mutation proof, not a newly found production bug). Full suite:
    650 pass / 2 external skip; types/lint/API build/72-procedure contract/411-file
    boundaries pass. Article/read and admin/write slices still remain.
  - [x] M05b: Article summaries/detail/locked previews use the same injected
    ContentReadService; article router now only validates/dispatches. Six new
    native HTTP/JWT/MySQL cases cover public summaries, allowlisted previews,
    paid sections/expiry/staff, revoked/blocked sessions and unpublished/missing
    articles. Intentional bypass produced four assertion failures, restored before
    extraction; no newly found production leak is claimed. Actual compiled Node
    smoke exercises feed/article reads, optional context and protected denial.
    Full suite: 656 pass / 2 external skip; root/Next types, lint, server/Next
    builds, unchanged 72-procedure contract and 411-file boundaries pass.
  - [x] M05c: ContentWriteService injected through ContentModule/TrpcService and
    required router factories; unchanged shared schemas define validated inputs.
    Existing 79 creation/edit/publication HTTP/JWT/MySQL regressions now use the
    production Nest application. Three added cases cover live moderator/session
    denial for all writes and revoked replay. Deliberate idempotency bypass failed
    the numeric-ID retry assertion and was restored before extraction; no newly
    found production duplicate is claimed. Transactions, intent hash, media rollback
    and post-commit announcement ownership preserved. Compiled Node admin denials,
    full suite 659 pass / 2 external skip, root/Next types, lint, API/Next builds,
    unchanged 72-procedure contract, 413-file boundaries and docs pass. Existing
    db.ts pool/helpers remain transitional; N12 delivery and registration diagnosis
    remain open. No frontend/schema/dependency/deployment/provider changes.
  - [x] M05d separate pagination fix: four native HTTP/MySQL regressions reject
    fractional limit, negative/fractional offset and unsafe integers with 400.
    Before repair the first three returned 500 (real helper: ER_PARSE_ERROR), and
    unsafe integers were accepted. Default 12/nullish cursor and wire types remain.
    Full suite 663 pass / 2 external skip; types/lint/backend build/API check pass.
  - [x] M05d: Feed list/pagination/tags and public video list/detail use the
    injected ContentReadService; video router requires the same service factory.
    Five new native HTTP/MySQL cases cover public visibility, exact page IDs/default
    12/null cursor, tag+trimmed search/bound values, counts/ordered attachments and
    reference tags. Removing the existing club-target filter deliberately failed
    the page assertion, then was restored before extraction (not a real new leak).
    Eight video/stream regressions now use the production application, mocking
    only the downloader/upstream; hidden/revoked playback and Range preserved.
    Compiled Node smoke exercises catalog fallback/invalid input as well. Full
    suite 668 pass / 2 external skip; root/Next types, lint, backend/Next builds,
    unchanged 72-procedure contract and 413-file boundaries pass. Query helpers
    and pool still transitional; no frontend/schema/provider or deployment changes,
    reaction/comment/upload paths remain next.
  - [x] Club pagination: native HTTP/JWT/MySQL reproduced 500 for fractional
    limit and negative/fractional offset, and silent acceptance of unsafe integers.
    Integer/nonnegative safe-number validation now returns 400. Five new cases
    retain default 20, optional input/null cursor, max 200, paging, visibility and
    anonymous denial. Full suite 673 pass / 2 external skip; types, lint, backend
    build and unchanged 72-procedure/25376-byte API pass. No SQL/auth policy change.
  - [x] M05e: Six discussion operations now use injected ContentCommentService;
    post reactions use ContentWriteService and mandatory feed/club factories.
    Fourteen new native HTTP/JWT/MySQL cases preserve club/public distinctions,
    publication/window rules, ownership/live staff, blocked/revoked sessions,
    text/photos, replies, report upserts and cleanup, boolean/coerced post toggles.
    Deliberate club guard bypass failed the expiry-denial assertion, restored
    immediately; not a production leak. Full suite 687 pass / 2 external skip;
    root/Next types, lint, backend/Next builds, exact 72-procedure/25376-byte API
    and 415-file boundaries pass. SQL helpers/pool and durable reply delivery
    remain transitional. A test-fixture media deadlock was diagnosed via InnoDB;
    intentionally gated suites now share fixture ownership without disabling
    concurrent requests inside them. No production locking/schema change claimed.
  - [x] Post reaction atomicity: native HTTP/JWT/MySQL reproduced lost toggles
    in concurrent bursts and two duplicate rows from deterministically gated
    inserts. Canonical like/save helpers now lock the actor row and toggle inside
    one transaction, returning after commit. Ten new regressions cover gated/even/
    odd requests, independent actors, legacy duplicate disable and failed-write
    rollback; existing auth/coercion/boolean contract preserved. Full suite:
    697 pass / 2 external skip; root/Next types, lint, backend/Next builds,
    unchanged 72-procedure/25376-byte API, 416-file boundaries and docs pass.
    No schema, frontend, provider or deployment changes.
  - [ ] Review reaction pair indexes/unique constraints and missing-post policy
    separately; network retries of a toggle are still non-idempotent. Review media
    query indexes/transaction deadlocks separately from test-fixture isolation.
  - [x] M05f: admin.uploadPhoto/admin.uploadMedia use injected ContentUploadService;
    ContentModule/TrpcService and mandatory router factories own composition.
    Seventeen new native HTTP/JWT/MySQL cases preserve live access/pre-parser
    denial, real photo re-encoding, media folders/names/association/defaults and
    safe storage/SQL failures. Deliberate byte-validation bypass failed three
    rejection assertions, restored before extraction (not a production leak).
    Focused 39 pass, full suite 714 pass / 2 external skip; root/Next types, lint,
    backend/Next builds, exact 72-procedure/25376-byte API, 418-file boundaries
    and docs pass. No new endpoint, frontend, provider, schema or deployment change.
  - [x] Generic media encoding/key safety: invalid/empty/noncanonical base64 and
    same-name/same-millisecond key collisions reproduced before repair. Bound
    encoded length by the existing 50 MiB JSON ceiling before decoding; fixed
    folders plus server UUID keys exclude client paths/names/extensions. Human
    metadata, MIME/type, association, auth and API shapes preserved. Seventeen
    added regressions; focused 47 pass, full suite 731 pass / 2 external skip;
    root/Next types, lint, backend/Next builds, unchanged 72-procedure/25376-byte
    API and 419-file boundaries pass. No legacy object rewrite or provider calls.
  - [x] Generic media declared Content-Type: native HTTP/JWT/MySQL reproduced
    acceptance of HTML/SVG headers for every category and incompatible/malformed
    MIME values; an overlong value failed SQL with 500 after storage. MIME essence
    is now validated against the category and normalized consistently for storage
    and SQL, before decoding. Editor PDF/DOC/DOCX/TXT, audio/video families and
    octet-stream fallback remain accepted; valid ASCII token/quoted parameters
    including charset/codecs are preserved, malformed parameters rejected.
    Thirty new cases; focused 77 pass,
    full suite 761 pass / 2 external skip; root/Next types, lint, backend/Next
    builds, unchanged 72-procedure/25376-byte API and 420-file boundaries pass.
    No dependencies, schema, parser, frontend or provider changes. Format-byte
    detection is a separate step; this does not certify safe files/playback.
  - [x] Audio/video signature detection: approved file-type 22.1.1 promoted from
    the existing lock graph to an exact direct backend dependency. Unknown/foreign
    signatures fail before storage/SQL; canonical MIME replaces misleading labels,
    aliases and binary fallback. MP4/WebM are shared containers, not proof of tracks.
    One active worker, five-second active deadline, owned byte copy and awaited
    teardown; no new HTTP quota/429. Native HTTP/JWT/MySQL regression, genuine
    generated fixtures, worker failure/timeout/serialization tests and compiled
    ESM plus existing CommonJS/tsx runtime checks. Focused 99 pass; full 783 pass /
    2 external skip. Clean frozen offline install with scripts disabled passed;
    no added transitive versions. Audit still reports 33 high / 36 moderate / 4 low
    in the existing workspace graph; no detector-chain advisories in this snapshot.
    This is signature classification, not full validation/playback/antivirus.
  - [x] Declared PDF/DOCX signature slice: native HTTP/JWT/MySQL reproduced
    fourteen accepted invalid/mislabelled payloads before repair. Require exact
    detected MIME for these two declared types before storage/SQL; preserve bytes,
    valid MIME parameters and standalone/associated contracts. Locally constructed
    PDF/minimal DOCX, ordinary ZIP and a package advertising macro-enabled Word;
    no user's documents or executable macro payloads. Eighteen added native cases
    and one compiled ESM/real-worker policy case; focused 118 pass, full 802 pass /
    2 external skip. No dependency, schema, frontend, parser, provider or quota change.
    This is classification, not full PDF/OPC validation or antivirus.
  - [x] TXT/opaque upload slice: native HTTP/JWT/MySQL reproduced byte-validation
    bypass before repair. Known foreign binaries no longer pass as text/opaque;
    complete fatal text decoding supports Unicode/BOM and explicit Windows-1251,
    rejects malformed bytes/controls/charset ambiguity and preserves storage bytes.
    Opaque PDF/DOCX/text gets canonical MIME; appended charset respects SQL ceiling.
    Forty-eight native additions and expanded compiled ESM real-worker policy;
    focused 166 pass, full 850 pass / 2 external skip. Root/Next types, lint,
    backend/Next builds, unchanged 72-procedure/25376-byte API, 422-file boundaries
    and docs pass. No dependencies/schema/frontend/quota/provider change. This
    is encoding/type validation, not an HTML filter/antivirus or all-document safety.
    Windows-1251 picker text without explicit charset may require UTF-8 conversion.
  - [x] Backend standalone upload metadata: return the canonical mimeType and
    decoded fileSize alongside unchanged url/mediaId for associated and standalone
    uploads. Native HTTP/JWT/MySQL reproduced six missing-metadata failures before
    repair; 140 upload cases now pass, including WAV labelled MP3, opaque PDF and
    TXT with appended charset. No frontend source/tests/generated types changed;
    the user explicitly reserves those updates for the frontend developer.
    Handoff: docs/development/backend-handoff-2026-10-05.md. Strict check:api is
    intentionally not bypassed: its stale frontend snapshot blocks staging merge
    until the frontend owner regenerates it. Full suite: 851 pass / 2 external S3
    skip with real disposable MySQL backup/restore enabled; types, lint, backend
    build, 422 source boundaries pass. No new dependency/schema/provider.
  - [x] Raw-video signature validation: the existing HTTP endpoint reuses the
    canonical MIME policy/isolated detector before storage. Native HTTP/JWT/MySQL
    reproduced 20 incorrect outcomes before repair; 34 native scenarios plus
    four injected-failure cases pass. MP4/WebM/MOV container compatibility,
    URL-only response, live admin/block/revocation and actual 80 MiB HTTP ceiling
    retained. No frontend/dependency/schema/quota changes. Full suite: 889 pass /
    2 external S3 skip with disposable MySQL backup/restore enabled. This is not
    playback/antivirus/provider acceptance or migration of raw wiring to Nest.
  - [x] Raw-video object key isolation: fixed-clock native HTTP/JWT/MySQL tests
    reproduced collisions for two sequential/four concurrent same-name uploads.
    Built-in randomUUID now replaces timestamps; folder, sanitized filename,
    original bytes/MIME and URL-only response preserved. Two failing regressions
    now pass; focused 63/full 891 pass with 2 external S3 skip. Types/lint/backend
    build/boundaries pass. No old-object migration, frontend or dependency changes;
    distinct keys do not make retries idempotent or prove provider acceptance.
  - [ ] Remaining document format/ownership: reviewed Word-specific detector for
    legacy DOC, frontend consumption of canonical standalone upload metadata
    (backend response ready; editor unchanged), and orphan cleanup after failed
    SQL association. Declared msword still
    bypasses byte checks; generic CFB is not proof of Word. Do not claim a safe
    document boundary. Signatures do not prove absence of active content or
    protect public URLs. Reconcile persisted ownership/references before deletion,
    not on ambiguous SQL errors. Provider/header/privacy acceptance remains open.
  - [x] Video-link input error mapping: native HTTP/JWT/MySQL reproduced 14
    unsupported/malformed URL failures returning 500 rather than 400. Trusted
    policy refusals now use BAD_REQUEST; safe messages/success response and exact
    configured HTTPS origin/bucket boundary preserved. Twenty-one native cases
    cover URL refusals, trim/retain, live role/block/revocation and anonymous access;
    no outbound fetch or storage write. Focused 69/full 912 pass with 2 external
    S3 skip, types/lint/backend build/boundaries pass. No dependencies/frontend,
    ownership proof or reopening external imports; Nest wiring is the next slice.
  - [x] URL-import Nest wiring: admin.importVideoUrl now uses the existing injected
    ContentUploadService, with the origin/bucket policy owned by content instead
    of the raw Express upload adapter. Reuse the 21 native API/eight policy tests;
    focused 210/full 912 pass with 2 external S3 skip. Compiler-rendered contracts
    before/after refactor are identical across 72 procedures (read-only comparison,
    no frontend generation); types/lint/backend build/423-file boundaries pass.
    Existing live authorization/input/error/success behavior preserved. No new
    provider/module/schema/dependency/frontend or outbound fetch. Strict check:api
    still fails on the intentionally untouched snapshot from the earlier metadata
    change; migration does not unblock staging/CI/deploy or prove storage ownership.
  - [x] Raw-video Nest wiring: native VideoUploadController calls injected upload
    and session services. Parser middleware retains pre-body admission, then
    fresh JWT/SQL authorization runs after body reception; superseded admin-video
    business handler removed. Same endpoint, URL-only 200, 80 MiB limit, MIME
    checks, UUID keys and errors. Three streaming revocation tests pass before/
    after migration and fail when the late check is deliberately disabled.
    Compiled ESM HTTP/JWT/SQL/worker test proves actual runtime injection;
    no provider/production jobs, frontend/schema/dependency/auth-policy change.
    Focused 238 plus one compiled case; full 916 pass / 2 external S3 skip with
    disposable MySQL backup/restore. Types/lint/backend build/423-file boundaries
    pass; read-only 72-procedure contract fingerprint unchanged. Strict check:api
    remains blocked on the earlier metadata snapshot; no staging merge/deploy.
  - [x] Admin-content read wiring: five admin queries (posts/postsFiltered/
    scheduledPosts/getPostMedia/stats) now use the existing injected read service.
    Same schemas/adminProcedure, private/unpublished catalog, three post ordering
    rules, ordered metadata and legacy dashboard counts. No extra module,
    fallback service locator, frontend/schema/dependency/auth-policy change.
    Nineteen native cases include compiled ESM HTTP/JWT/SQL; public-catalog
    mutation is detected. Focused 90 pass; the old direct-router publication
    fixture now supplies the mandatory read dependency (six failures resolved).
    Final full suite: 935 pass / 2 external S3 skip, disposable backup/restore;
    types/lint/build/boundaries pass, 72-procedure fingerprint unchanged.
    Strict check:api remains blocked on the earlier untouched frontend snapshot.
    Other admin reads/writes and unbounded admin lists/statistics SQL remain open.
  - [ ] Investigate intermittent concurrency verification: one full run timed out
    observing the second in-flight toggleSave's MySQL actor lock (native comments
    suite). Isolated, paired-with-admin and instrumented full runs passed; no
    cause/fix proven. Final original-test full run passed as well. Temporary
    diagnostic removed; assertions/timeouts unchanged.
    Do not call this fixed or conceal it with automatic retries/skip flags.
  - [ ] Remaining M05: Remaining admin service wiring; no
    claim that all content, storage or SQL ownership has been migrated.
    - [x] Route admin post/media deletion and raw-camera filename cleanup through
      the existing Nest-managed ContentWriteService. Preserve ID schemas, admin
      policy, SQL helpers, void deletion responses and cleanup's no-DB no-op.
      Five expected RED HTTP cases before wiring; 23 new checks pass afterwards,
      including guest/member/moderator/blocked-admin refusal, malformed IDs,
      provider errors and missing-database outcomes. Full non-MySQL suite:
      836 pass / 4 skip; types/build/API/boundaries pass. Session lookup and the
      selected provider are doubled in HTTP wiring cases; real JWT/MySQL deletion
      acceptance is verified at the evening checkpoint below. Raw-camera filename
      cleanup SQL is verified in its separate isolated checkpoint. No frontend/schema/payment,
      shared-server data mutation, push or deployment.
    - [x] Route admin.importVideos through the existing ContentWriteService;
      extract its unchanged wire schema as the service's input type. Preserve
      ordered metadata, null/empty-string defaults, publication flags, helper
      count and administrator policy. Two expected RED service-wiring cases;
      12 added native HTTP checks, 69 focused pass. Full non-MySQL suite:
      851 pass / 4 skip; types/build/API/473-file boundaries/frontend lint pass.
      Session lookup and provider or persistence boundary are doubled; real
      MySQL writes, deduplication and batch rollback are verified at the evening
      atomic-import checkpoint below; concurrency acceptance remains open.
      No frontend/schema/payment/provider/push/deployment changes.
  - [x] Admin article slice: four operations use existing injected read/write
    services; schemas, private/draft order, block normalization and teaser lifecycle
    are unchanged. Twenty real HTTP/JWT/MySQL cases include compiled ESM; a
    deliberate published-only list mutation fails the private/draft assertion.
    Focused 68 pass; corrected-environment full run 1032 pass / 4 skip (two external
    S3 and two native Docker backup/restore cases not run). The first full failure
    and environment diagnosis are recorded in plan.md; no assertions/timeouts
    changed. Types/lint/build/API/boundaries/docs pass, 72-procedure contract intact.
    Owned temporary containers/SQL volume/network/artifacts removed after exact
    ownership checks; staging and other shared-server applications remain healthy.
    No frontend/schema/dependency/provider or staging-deployment change.
  - [x] Article write consistency: atomic article/teaser create/edit/delete
    and concurrent publication behavior. Keep teaser visibility, missing-ID/empty-
    patch semantics and production schema/history unchanged.
    - [x] Extract and verify reusable in-transaction post deletion cascade.
      Before/after: 33 real HTTP/JWT/MySQL tests pass, including compiled ESM
      and deletion rollback/concurrency. Types and backend build pass.
    - [x] Reproduce partial writes/visibility with real SQL failures and gates;
      implement atomic article mutations and serialize same-article writers.
      Nine behavioral failures reproduced before repair; 11 new cases pass after
      repair, focused HTTP/JWT/MySQL + cascade + compiled ESM run: 44 pass.
    - [x] Full/static/compiled verification, review and exact fixture cleanup.
      Full 1043 pass / 4 skip (external S3 and native Docker backup/restore not
      run); types/lint/build/API/436-file boundaries/44-doc check pass. Owned
      containers, synthetic SQL volume, network and temporary artifacts removed.
      Staging remains healthy at 12cfc8d; no frontend/schema/provider/push/deploy.
      Historical duplicates, generic post-source ownership, article creation
      idempotency and teaser visibility/update policy remain separate tasks.
- [ ] M06: Specify and migrate billing service wiring; sandbox/provider acceptance
  remains separate from local tests, no TypeORM/data-model rewrite.
  - [x] Club checkout: Nest-managed service and explicit router composition;
    2 expected RED failures, 76 focused pass and 723 non-MySQL pass / 4 skip.
    Real HTTP and compiled ESM verified; deliberate hidden-instance wiring
    mutation fails the HTTP assertion. Types/build/lint/API/boundaries pass;
    no frontend, dependencies, SQL/schema, provider, push or deploy changes.
  - [x] Subscription reads, read-only claimPending and cancellation use case:
    explicit ClubSubscriptionService, unchanged authorization/SQL/provider policy.
    Three expected composition RED failures; real HTTP hidden-instance mutation
    fails three assertions. 31 slice-focused checks and 753 non-MySQL pass / 4 skip;
    types/build, unchanged API, boundaries and docs pass. Compiled ESM preserves
    verified session ID, paid expiry and guest rejection. No real SQL/provider test.
  - [x] Native webhook ingress: one BillingModule controller, application-scoped
    typed handler binding; raw POST and query-only GET/implicit HEAD preserved.
    2 ingress RED cases, 4 parser-compatibility RED cases repaired before commit;
    DI-bypass mutation fails the raw forwarding test. 72 focused cases pass,
    including real HTTP and compiled ESM; 767 non-MySQL pass / 4 skip,
    types/build/API/boundaries/docs pass; no live SQL/provider replay claim.
  - [ ] Webhook/settlement business-logic decomposition; preserve signature,
    payment replay protection and transaction boundaries with their own tests.
    - [x] Pure Prodamus canonicalization/HMAC extracted to billing/prodamus-signature.
      One implementation and the existing legacy export; merchant-key selection,
      timing-safe verification, parser, transport and settlement are unchanged.
      Nine expected scaffold RED assertions; direct/legacy fixtures preserve own
      __proto__, Unicode, slashes, arrays, nullish values and frozen input.
      Removing slash escaping fails two checks; restore full 1344 pass / 618 skip,
      types/build/API/517-file boundaries pass. No SQL/provider acceptance,
      secret access, frontend, activation, merge, push or deployment.
    - [x] Request-neutral Prodamus payload parsing extracted to billing/prodamus-payload;
      webhook and browser return use the same parser and record coercion helper.
      Twenty-four expected scaffold RED assertions preserve query/body precedence,
      PHP indexed objects, duplicate/collision behavior, JSON/empty-body handling,
      blocked PHP path names and signed own JSON fields. Two native mixed-input
      cases added; dropping query forwarding fails seven HTTP and one compiled
      assertion. Restore full 1370 pass / 618 skip, types/build/API/boundaries pass.
      Decoding is not authentication or settlement acceptance. No schema, SQL,
      external service, frontend, auth/CORS/proxy/quota, activation or rollout.
    - [x] Pure notification field selectors extracted to billing/prodamus-fields;
      preserve exact-key/alias precedence, scalar coercion, selected order prefixes,
      success status, nullish user-ID hints and nested subscription actions.
      Forty literal cases / 23 expected scaffold RED failures; native alias fixture
      preserves complete settlement proof. Alias-removal mutation fails six checks,
      status mutation four; restore full 1411 pass / 618 skip, static/build gates pass.
      Existing selectors are not ID/schema validators or payment authorization.
      Binding/signature/replay/transaction policy and disabled-shop gate unchanged;
      no SQL/provider, secret access, activation, frontend, push or deployment.
    - [x] Outbound PHP query encoder extracted to billing/prodamus-query;
      signed links and cancellation share one implementation. Ten intended
      scaffold RED failures; missing value escaping fails four literal fixtures
      and a new signed-checkout plus-address assertion. Restore: 91 focused checks
      pass, types/backend build/API/520-file boundaries/frontend lint pass.
      Overnight ENOSPC blocked full verification; resumed with 14 GiB free,
      without deleting user files. Fresh full 1422 pass / 618 skip, 111 files pass /
      30 skip; types/build/API/boundaries/frontend lint/docs/format gates pass.
      No failures waived; SQL/external acceptance remains outside this checkpoint.
      No unrelated cache/user-file removal, SQL/provider call, activation or rollout.
    - [x] Payment field projection extracted to billing/prodamus-payment with a
      typed return contract; handler retains signature/merchant binding gates.
      Ten literal fixtures / nine intended scaffold RED failures preserve distinct
      order/payment IDs, raw amount/currency, normalized recipient/domain, nested
      subscription/profile and existing unvalidated user hints. Native monthly
      fixture preserves the full settlement input, one dispatch and no login cookie.
      Dropping profile ID fails four pure checks and native acceptance; restore:
      full 1433 pass / 618 skip, types/build/API/521-file boundaries/lint/docs pass.
      Decoding is not authentication or SQL/provider acceptance. No activation,
      frontend implementation, schema/dependency, auth policy or rollout change.
    - [x] Club payment field binding extracted to billing/prodamus-binding with
      explicit trusted configuration and guard clauses; original-body HMAC,
      merchant-key selection and durable settlement checks remain in the handler.
      35 independent expected-value fixtures / 12 intended scaffold RED failures
      preserve monthly/semiannual rules and legacy profile boundaries. Six new
      signed native rejection cases cannot dispatch settlement or create a cookie.
      Dropping domain matching fails three pure cases and native HTTP; restored:
      162 focused checks, full 1474 pass / 618 skip, types/build/API/522-file
      boundaries/frontend lint/docs/format/whitespace pass. Field matching is not
      authentication or SQL/provider acceptance; M06 orchestration remains open.
      No frontend, schema/dependency, policy, external effects, activation or rollout.
    - [x] Club settlement now uses an application-owned ClubSettlementService and
      required typed durable port; initial and recurring native webhooks consume
      the supplied instance. Legacy facade/default effect and 30/180-day exports
      stay compatible; no SQL/replay/transaction or validation policy rewrite.
      Six service RED failures and native DI 200-instead-of-422 failure reproduced.
      Nine service/legacy cases, three native cases and extended compiled ESM
      protect forwarding, rejected/error/pending decisions and app isolation.
      Legacy-bypass mutation fails three native and one compiled assertion;
      restore full 1486 pass / 618 skip, types/build/API/523-file boundaries,
      frontend lint/docs/format/whitespace pass. SQL/provider acceptance and
      remaining orchestration stay open; no activation or rollout change.
    - [x] Pure cancellation profile field binding extracted to
      billing/prodamus-cancellation; original-body HMAC, recurring key selection,
      demo guard and durable confirmation stay in the HTTP handler. Eighteen
      literal/frozen fixtures, eight native HTTP cases; eight scaffold RED
      assertions. Merchant-guard removal fails three pure checks and one native
      rejection. Restore: 145 focused pass, full 1629 pass / 618 SQL/external
      skip, types/407.2 kB build/unchanged API/529-file boundaries/lint pass.
      Numeric native fixture canonicalization corrected without production change.
      Existing nonempty profile semantics preserved, not stricter payment regex;
      no actual SQL/provider effects, frontend, secrets, activation or rollout.
    - [x] Post-verification cancellation confirmation now uses application-owned
      ClubCancellationService and required typed acquisition/confirmation ports.
      Missing DB, errors, durable false and pending completion preserve policy;
      HMAC/demo/recurring-key/profile guards and SQL transaction stay unchanged.
      Six empty-service RED failures and supplied-service native refusal RED;
      six direct and six new native cases plus compiled ESM acceptance. Hidden
      legacy bypass fails six native checks and one compiled assertion. Restore
      full 1641 pass / 618 SQL/external skip, types/408.5 kB build/unchanged API/
      530-file boundaries/frontend lint/docs/format/whitespace pass. No new
      effects, frontend, dependencies, schema, activation, push or deployment;
      remaining M06 orchestration and durable/provider/release gates stay open.
    - [x] Outbound setActivity now belongs to billing/prodamus-cancellation-client
      with explicit trusted config/fetch; legacy facade/worker sender identity and
      merchant/key/profile/HTTPS/redirect/timeout/response rules remain unchanged.
      Fifteen direct cases / four intended empty-contract RED failures; sixteen
      existing native loopback cases preserved. Redirect-follow mutation fails
      six native checks; restore full 1656 pass / 618 SQL/external skip, types/
      409.0 kB build/API/531-file boundaries/frontend lint/docs/format pass.
      No actual provider/SQL effect or rollout; M06/release gates remain open.
    - [x] Signature comparison/key-list verification now belongs beside canonical
      signing; explicit readonly keys, no env/default/demo-key/cache in the helper.
      Legacy dynamic key trimming and per-operation key selection unchanged.
      Nineteen new checks / five empty-contract RED failures; broad-key cancellation
      mutation fails native HTTP (200 instead of 422). Restored full 1675 pass /
      618 SQL/external skip; types/409.1 kB build/API/531-file boundaries/lint pass.
      No SQL/provider acceptance, frontend, policy, activation or server changes;
      M06 orchestration and all existing release gates remain open.
  - [x] Shop owned/checkout use cases now use explicit ShopModule/ShopService
    composition in Nest and standalone callers. Router schemas/protected access
    and hard-disabled capability gate remain before checkout service entry;
    actor/email, UUID, signed-link-before-write and dormant order tests preserved.
    Two expected supplied-service RED failures repaired. Fifteen new composition
    and native HTTP checks; deliberate hidden-instance mutation fails five
    composition/HTTP/compiled assertions. Restore: 200 focused checks pass,
    full 1300 pass / 618 skip, types/build/API/512-file boundaries/docs pass.
    No real JWT, SQL, provider, frontend, capability enablement, push or rollout.
  - [x] Preserve own JSON fields throughout Prodamus signature normalization,
    including root/nested/array-element __proto__. Two null-prototype dictionaries
    prevent this property from being lost before HMAC; the PHP form parser's
    existing blocked-key policy remains unchanged. Nine expected RED failures
    (including native HTTP 200 instead of 400), then 90 focused checks pass;
    reverting only the sorting dictionary produces eight failures again.
    Full 1285 pass / 618 skip, types/build/lint/API/510-file boundaries pass.
    This is payload-integrity hardening, not a demonstrated paid-access bypass,
    provider compatibility acceptance or completion of M06. No SQL/provider,
    frontend, secret, authorization, push, merge or deployment changes.
  - [x] Cancellation transport rejects all redirects instead of accepting an
    unconfigured endpoint's success. Six native loopback RED failures reproduced;
    redirect: error repairs them. Sixteen transport checks preserve independent
    user/manager signatures, direct success, binding and production HTTPS policy.
    Eight focused files / 87 pass; full 1316 pass / 618 skip, types/build/API/
    512-file boundaries pass. Timeout and durable retries unchanged; false means
    unconfirmed, not proof of no remote effect. Real provider/SQL acceptance
    remains open; only owned local listeners and synthetic configuration used.
    No frontend, auth/CORS/proxy/quota, secrets, activation, push or deployment.
  - [x] Remove millisecond-based shop checkout order collisions from both tRPC
    and legacy redirects. Three concurrent same-clock failures reproduced;
    UUID suffixes retain product parsing and fit the existing 80-character column.
    Shop stays hard-disabled; SQL/provider settlement acceptance is still open.
  - [x] Build both shop checkout links before the pending-order write; two
    expected persistence-order failures repaired, 774 non-MySQL pass / 4 skip.
  - [x] Shop links reject incomplete/unsafe selected merchant, unsigned URLs,
    invalid price and callback origin before persistence. 23 expected RED cases;
    800 non-MySQL pass / 4 skip, independent HMAC compatibility fixtures pass.
    Shop remains hard-disabled; settlement/outbox/provider acceptance stay open.
  - [x] Legacy shop checkout errors no longer log raw database exceptions;
    one expected private-marker leakage failure repaired. 801 non-MySQL pass /
    4 skip, Node 22 gates pass; Docker EOF blocks disposable-MySQL acceptance.
  - [x] Shop catalog lookup rejects inherited object properties in the builder,
    authenticated checkout and legacy redirect before configuration/persistence.
    12 expected RED cases repaired; 813 non-MySQL pass / 4 skip on Node 22.
    Shop remains disabled; no real SQL/provider acceptance or deployment.
- [ ] M07: Specify and migrate worker lifecycle; implement N12 as its own feature.
  - [x] Inspect and draft lifecycle specification in the existing plan, 8 October.
    Four immediate/fixed-interval jobs; timer handles not owned, no executable
    stop/drain, possible slow-run overlap. Existing backup guard and SQL leases
    preserved; detached announcement sends and pool ownership recorded. These
    are source findings, not observed data loss or duplicate payments. Docker
    still returns EOF; no database or external transport touched.
  - [x] M07a: inert IntervalJobs primitive, not activated by the executable.
    Thirteen deferred/fake-timer checks: immediate/fixed cadence, busy skip/no
    backlog, independent jobs, safe error recovery, idempotent start/stop,
    unfinished/rejected work, queued callback fences and owned timers only.
    Ten expected scaffold RED assertions; busy/fence mutations each fail two
    checks, restore passes 37 focused and full 1329 / 618 SQL/external skip.
    Types/build/API/513-file boundaries/docs pass. stop exposes pending promises,
    not a timeout/cancellation/provider-success claim. No domain/provider changes
    or runtime activation; M07b/M07c/N12 remain separate and open.
  - [x] M07b after M07a: Nest job composition; activate only after listen and
    preserve four cadences/helper semantics. Native factory remains worker-free;
    controlled run failures and isolated built startup/listen failure accepted.
    - [x] M07b1: inert WorkersModule/WorkerJobs and typed per-app helper binding.
      Nine orchestration checks, two native apps and one compiled ESM child;
      eight use-case/two missing-provider RED failures, injected-helper bypass
      mutation fails native and built assertions. Restore: 63 focused pass,
      full 1341 pass / 618 skip; types/build/API/516-file boundaries/docs pass.
      Old whole-DB stub completed; per-app test spies isolated after diagnosis.
      index.ts remains unchanged: no new executable timers or shutdown hooks,
      real SQL/provider/mail/push/backup, frontend, secrets, push or deployment.
    - [x] M07b2: replace old executable timers with one explicit activation only
      after successful listen; prove failed-listen behavior in an isolated child.
      Never activate both runners; shutdown-bound review remains unresolved.
      Actual compiled entrypoint: one start, four original cadences and synthetic
      helper effects; occupied port exits 1 with no starts/timers/effects. Env
      loading is removed only by the test build plugin, never in production.
      Original executable RED: zero owned starts/effects. Early-start mutation
      fails against the real HTTP listening event; restored code passes.
  - [ ] M07c after shutdown-bound review: stop timers before drain, app.close and
    signal acceptance, honest pending-at-bound handling. No remote-success claim,
    forced lease reset or real provider activity; inventory detached tasks first.
    Ask for the maximum drain wait before implementing this runtime policy.
  - [ ] Keep mysql2 pool ownership/close and N12 durable publication outbox as
    separate data-lifecycle/features; local single-flight is not a distributed
    lock or exactly-once delivery. Do not close M07 on the specification alone.
- [ ] M08: Specify/migrate remaining API services, remove superseded adapters and
  decompose db.ts without changing contracts. Review every module separately.
  - [x] Fix moderation mutation ID validation as a separate behavior change:
    report/comment/user IDs must be positive safe integers, including optional
    reportId when supplied. Twenty native HTTP invalid-ID regressions fail for
    false success before schema changes; final slice 45 pass, focused 85 pass,
    whole non-MySQL 975 pass / 4 skip. Valid moderator/admin targets, actor,
    audit order, reason trim, optional omission and role refusals preserved.
    Identity/persistence are doubled; no real JWT/SQL mutation/audit claim.
  - [x] M08a: migrate all five moderation operations into explicit Nest-managed
    ModerationService/ModerationModule, shared factory for standalone callers.
    Five expected RED supplied-service refusals repaired; 66 moderation checks,
    bounded inbox, role/ID guards, session actor, failure and audit-order checks.
    Hidden-instance mutation fails ten composition/native-HTTP assertions;
    restore and full suite 1275 pass / 618 SQL/external skip. Types/backend build,
    unchanged API and 510 dependency boundaries pass. Identity/persistence
    doubled; no authorization change, real SQL/JWT or durable audit acceptance.
  - [x] Verify/fix actual moderation mutation/audit transactional consistency
    separately. User block/unblock, report dismissal and reported-comment deletion
    now have real SQL rollback and native HTTP/JWT coverage (checkpoints below).
    This closes these four mutation/audit windows, not M08 or release acceptance.
  - [x] Notification token lifecycle slice (scope approved): preserve
    registration, consent reads/writes and admin purge contracts while wiring
    an explicit Nest-managed notification provider. First characterize HTTP,
    then prove provider-bypass failures and wire the service; finish with full
    non-MySQL/static/API/review gates and a local commit. Exclude latest content
    reads, real delivery, worker lifecycle and any auth/consent-policy change.
    24 characterization checks; four expected RED composition failures repaired.
    Final slice 32 pass, focused 128 pass; a hidden-instance mutation fails four
    native HTTP assertions and is removed. Full non-MySQL: 883 pass / 4 skip;
    types/build/unchanged API/476-file boundaries/frontend lint pass. Separate
    compiled ESM native HTTP probe passes all four paths plus injected refusal.
    Session lookup and provider or persistence boundary are doubled; no real
    JWT/MySQL/device delivery, durable no-DB writes or production-readiness claim.
  - [x] Move notifications.latest into the existing injected ContentReadService;
    preserve public/club access, response fields, ordering and safe errors.
    Characterize HTTP first and prove supplied-provider wiring before full gates.
    16 characterization cases pass before production changes; two native HTTP
    provider-bypass RED cases repaired. Notification suite 50 pass, focused 123
    pass, whole non-MySQL 901 pass / 4 skip; types/build/unchanged API/boundaries/
    frontend-only lint/docs pass. SQL helpers and session lookup are doubled;
    actual JWT/MySQL publication visibility/ordering/expiry acceptance completed
    in the separate native SQL checkpoint below; provider delivery remains open.
  - [x] Reject no-DB false success for token registration, consent grant/revocation
    and administrator token purge at the existing persistence boundaries. Five
    native HTTP regressions fail for false success before the three guard fixes;
    actual missing-DB helpers run with only session lookup doubled. Notification
    suite 52 pass, focused 100 pass, whole non-MySQL 930 pass / 4 skip; types/
    build/unchanged API/479-file boundaries pass. Success shapes, access and legal
    metadata unchanged; no-DB read defaults/recipient selection stay fail-closed.
  - [x] Run token registration/upsert, consent event ordering/legal metadata and
    administrator purge with real HTTP/JWT/disposable MySQL; 10 native SQL cases
    and 77 focused checks pass (checkpoint below). Docker is available locally.
  - [ ] Migrate other remaining domains in their own slices. Real notification
    provider/device delivery remains a separate gate; latest-publication SQL
    acceptance completed below, not full publication/delivery acceptance.
  - [x] Migrate profile update/avatar/deletion-request orchestration into an
    explicit Nest-managed profile service; preserve schemas, session ownership,
    protected access, canonical photo validation and upload-before-update order.
    18 characterization checks pass before production changes; three expected
    RED composition failures repaired. Final profile 24 pass, focused 128 pass;
    a hidden-instance mutation fails three native HTTP assertions and is removed.
    Full non-MySQL 925 pass / 4 skip; types/build/unchanged API/479-file boundaries/
    frontend-only lint/docs pass. SQL/storage and both identity lookups are doubled;
    the real photo decoder runs. No frontend/payment/provider/push/deployment work.
  - [x] Reject false-success profile/avatar responses when no database is
    available; reproduce through native HTTP and fix the common write boundary.
    Three expected RED cases (nonempty/empty patch and avatar URL) repaired;
    the actual no-DB helper runs, only identity/storage are doubled. Profile 26
    pass, focused 70 pass; whole non-MySQL 927 pass / 4 skip. Successful responses,
    schemas and access rules remain unchanged; failure now returns safe HTTP 500.
  - [x] Preflight avatar persistence before photo/storage work: no DB client or
    rejected acquisition yields safe HTTP 500 with no uploaded object. Both new
    HTTP regression expectations fail before the fix for the expected side
    effect; final profile 27 pass, focused 71 pass, whole non-MySQL 928 pass /
    4 skip. Configured-client fixtures use the installed Drizzle mock builder,
    not a real connection; photo sanitization and SQL/storage failure checks pass.
    Types/build/unchanged API/479-file boundaries/frontend-only lint pass.
    This is client availability only, not a live connection/write guarantee.
  - [x] Verify profile field writes and deletion requests with real HTTP/JWT/MySQL;
    eight new SQL cases and 45 focused checks pass (checkpoint below).
  - [ ] Verify avatar upload with real isolated S3; address orphaned uploads after
    SQL failure separately. Immediate erasure/retention policy remains open;
    zero-row profile/deletion-request writes guarded in the checkpoint below.
- [ ] Final checkpoint: whole Nest runtime/MySQL/frontend flow, release rehearsal,
  audit triage/migration history/provider/SMTP/private-file gates and approved rollout.

## TeamAssist isolated staging deployment — 2026-10-06

- [x] Confirm SSH host/teamassist-dev, free resources and existing applications.
  User approved a separate empty test DB; no production imports/providers.
- [x] Triage current runtime/build dependency advisories for the exact test setup;
  see docs/operations/teamassist-staging.md; dependency updates remain separate.
- [x] Build and verify exact staging SHA as Linux/amd64 containers using the
  bounded remote builder after local disk exhaustion. Native sharp/file-type,
  production-only dependencies and absence of env files verified.
- [x] Initialize new isolated empty MySQL from the canonical test baseline;
  retain production migration-history blocker (0017–0019).
- [x] Verify HTTPS UI/API/SQL, protected routes, disabled integrations and bounded
  resources without editing frontend source/types/tests or other server projects.
- [x] Record deployment version and safe stop/rollback instructions; keep known
  browser failures and remaining production release gates open.
- [ ] Local build cleanup: Docker became unavailable after disk exhaustion.
  Generated source/config temp directory removed; old failed local staging image
  and task-specific cache need removal once the local engine works. Do not delete
  unrelated images/containers/volumes or reset Docker Desktop.

## Migration application guard — 2026-10-06

- [x] Reproduce unsafe db:push ordering using disposable process probes.
  Six behavioral failures observed before repair; no real SQL generated/applied.
- [x] Require a clean manifest and matching explicit database history before
  applying reviewed SQL; no automatic generation, journal repair or live SQL.
- [x] Verify focused command/CLI/history tests and static/build gates; record
  missing real-MySQL rehearsal separately from this tooling slice.
  31 focused tests pass; full local run 518 pass / 498 skip (SQL/provider gates
  not run). Disposable MySQL is unavailable (Docker info reports EOF).
  Types, lint, backend build,
  exact 72-procedure/25461-byte API, 434-file boundaries and 44-doc check pass.
  Actual db:push refuses the existing three orphan files before DB/migrate.
- [ ] Reconcile 0017–0019 with source database evidence and rehearse approved
  migrations on a disposable copy. This command guard does not close B05/release.

## Pending registration retry — 2026-10-06

- [x] Reproduce passwordless public-registration retry without account takeover;
  return 202 instead of misleading 409, preserve all identity fields and consent.
- [x] Preserve usable queued/prior links, enforce approved three-mail/hour bound
  under concurrent retries, prove transactional rollback and real local SMTP flow.
- [x] Full/static/API/compiled verification, review, handoff and fixture cleanup.
  58 focused; final full suite 1059 pass / 4 provider/native-Docker skips.
  Types/lint/build/API/boundaries/docs pass. Only owned disposable resources
  removed; staging remains healthy at 12cfc8d. No frontend, migration or rollout.
- [ ] Receive test SMTP configuration securely; agree provider/network setup and
  rollout, then verify real mailbox delivery. No live credentials provided yet.

## Frontend/backend handoff: deleted post update (B7) — 2026-10-07

- [x] Reject every missing-post admin.updatePost with NOT_FOUND, not success;
  preserve successful response and stop before media writes/announcements.
  Six false-success cases reproduced before repair; 13 focused cases pass after
  repair with real editor/service/router and a doubled SQL reader.
- [x] Verify local non-MySQL/static/build gates and document frontend handling.
  650 pass / 4 skip excluding MySQL suites; verify 239 pass. Types, lint, API,
  backend build, 452-file boundaries and documentation checks pass.
  No frontend/generated types, migration, push, staging update or deployment.
- [x] Run manual-publication.mysql.test.ts against disposable MySQL and verify
  deleted-post HTTP 404/media invariants plus existing successful writes.
  Docker recovered; 52 SQL cases (including real HTTP/JWT) pass in the 8 October evening
  checkpoint below. No source/test assertions changed for this verification.
- [ ] Frontend draft retention/notification still needs its owner's acceptance;
  existing browser photo-viewer failure is not addressed by this SQL checkpoint.

## Frontend/backend handoff: complete media reads (B1) — 2026-10-07

- [x] Propagate post_media failures instead of returning a complete empty model;
  reject unavailable DB in the seven media/post read helpers, preserve genuine
  empty results and original media metadata after recovery.
  21 failing outcomes reproduced before repair; 33 fault/empty/recovery/HTTP
  scenarios pass with real repositories/Drizzle and a doubled SQL transport.
- [x] Verify compiled runtime without DB, static/build/API gates and handoff.
  Non-MySQL suite 683 pass / 4 skip; verify 239 pass. Types, lint, API, backend
  build and 452-file boundaries pass. No frontend, schema, push or deployment.
- [x] Run existing content.mysql/nest-content.mysql/nest-admin-content.mysql
  suites on disposable MySQL: 51 cases pass, including compiled ESM, in the
  8 October evening checkpoint below; source/tests/assertions unchanged.
- [ ] Accept editor refusal to change videos without a complete initial model.
  Client UI acceptance and version conflicts are not fixed by SQL reads alone.

## Frontend/backend handoff: preserve video identity (B2) — 2026-10-07

- [x] Reconcile exact URL occurrences instead of deleting/recreating every video;
  preserve retained IDs and all metadata, update only order, scope deletions to
  this post's excluded video IDs. Keep omitted/empty videos semantics and other
  media unchanged. Route the internal replacement wrapper through the post lock
  and edit transaction. New URL-only videos have unknown MIME, not a guessed MP4.
  All 16 new transport-level tests failed before repair and now pass; the real
  helper/Drizzle are exercised, not mocked application logic.
- [x] Verify non-MySQL/static/build/API gates and update the existing handoff.
  699 pass / 4 skip; verify 239 pass. Types, lint, compiled runtime, backend
  build, unchanged 72-procedure API, 452-file boundaries and 47-document checks
  pass. No frontend/generated types, schema, push, staging update or deployment.
- [x] Verify disposable MySQL acceptance: unchanged/add/remove/reorder, omitted/
  empty lists, duplicate occurrences and rollback of the post plus all media.
  Ten focused SQL tests pass in the 8 October evening checkpoint below; Docker
  recovered and only a new isolated fixture database was used. Manual-publication
  SQL checks also pass separately; frontend/provider acceptance remains open.
- [ ] Agree and implement a trusted metadata source for newly uploaded videos;
  URL-derived filename is only a compatibility label, MIME/size/duration stay
  null. No client metadata guessing or server fetch of arbitrary URLs. B2 is not
  fully accepted until this and real SQL verification are completed.

## Frontend compatibility and test rollout — 2026-10-07

- [x] B2 native SQL acceptance: all 10 cases pass on an owned disposable MySQL.
  Content/Nest read suites and creation idempotency: 87 cases pass; publication
  and B7: 52 cases pass. Existing
  earlier native-SQL skips above are historical; metadata registry remains open.
- [x] Retain pending photo/video selections after failed/unknown upload in both
  editors; prevent partial saves and blind reselection until explicit discard.
  Prevent closing a pending/unknown final post write from resetting its guard.
  Six new regressions fail before repair and pass after; 38 upload/editor browser
  cases pass. Reload-safe intent/idempotency recovery (full F5.1) remains open.
- [x] Final gates: 701 non-MySQL cases pass / 4 skips; verify 241 pass;
  complete browser run 232 pass / 3 real-development-API skips; native SQL 149
  pass. Types, lint, both builds, unchanged API, boundaries and docs pass.
  Local generated Next cache removed after screenshot ENOSPC; full rerun passes.
- [x] Update isolated test images, preserving the existing database, SMTP proxy
  and payment prohibition; verify health/HTTPS and record actual release.
  API/web 5c4a9cc deployed, five containers healthy, eight HTTPS checks pass;
  public feed visible. Database counts unchanged; protected backup recorded in
  operations guide. No remote Git push or staging-branch merge in this rollout.

### 2026-10-07 — F5.1, подключение ключа create без постоянного черновика

- [x] Воспроизвести отсутствующий ключ, отсутствие защиты конкурирующего
      финального запроса и поздний upload после подтверждённого create.
- [x] Оба редактора отправляют UUID через общий coordinator; одинаковый повтор
      после явного отказа сохраняет ключ, изменённые данные получают новый.
- [x] Update не получает ключ; неизвестная запись не повторяется; отсутствие
      безопасного UUID не отправляет create и не блокирует закрытие.
- [x] 711 проверок без MySQL / 4 пропуска; verify 251; 34 выбранные и полный
      браузерный прогон 236 / 3 real-development-API пропуска на свежей сборке;
      типы, lint, API, границы, ссылки и обе сборки проходят. SQL не запускался.
- [x] Клиентский остаток F5.1: постоянное намерение того же пользователя,
      payload после reload и осознанное восстановление неизвестного create.
      Реализовано 8 октября; проверки и ограничения указаны ниже.
- [ ] Приёмка F5.1 с настоящим API/SQL в целевом окружении и физическими
      устройствами. Клиентские fixtures не подтверждают установленную миграцию.
- [ ] Push и новый rollout. Сервер пока остаётся на предыдущем 5c4a9cc.

### 2026-10-08 — первый шаг фронтенда, черновики и восстановление редакторов

- [x] Сверить с F5.1, аудитом 25–26 и пунктом сдачи 4.6; бэкенд/БД не трогать.
- [x] IndexedDB-черновики обоих редакторов: поля, форматирование, аудио/документы
      как File, URL медиа, удаления и серверные метаданные; явное восстановление,
      изоляция владельца, ревизии вкладок и блокировка при отказе хранилища.
- [x] Сохранять состояние до отправки; явное восстановление create с прежним
      ключом/payload без повторных uploads. Не повторять неизвестные upload/update.
      Подтверждённую запись завершать без новой записи даже после сбоя очистки.
- [x] Устранить двойное переключение форматирования pointerdown/click;
      проверить жирный/курсив и две ссылки вместе с файлами после reload.
- [x] 212 модульных тестов; 81 целевая браузерная проверка (15 новых и 66
      регрессий, два запуска) на свежей production-сборке; типы, ESLint, неизменный API, границы и ссылки проходят.
- [ ] Совместная приёмка 4.6 с реальным API/SQL, медиа и физическими устройствами.
      Данные хранилища сайта могут быть очищены браузером; autosave до отметки
      «сохранён» ещё не гарантирует восстановление последних изменений.
- [x] Следующий клиентский шаг: комментарии с фото, модерация/административные
      действия; реализация и проверки описаны в разделе ниже.
- [ ] Дальше интеграции и общая приёмка первого этапа. Push/выкладка не запрошены.

### 2026-10-07 — отдельный сервис публичного видео

- [x] Подтвердить исходную ошибку: `/api/yt/:id` возвращает 502;
      yt-dlp отсутствует, основной API остаётся в изолированной сети.
- [x] Проверить официальный загрузчик в отдельном ограниченном контейнере
      без секретов: извлечение метаданных и HTTP 206 для отдельных видео/AAC
      дорожек. Это ещё не проверка полного скачивания и воспроизведения.
- [x] Согласовать объединение без перекодирования и временный кеш до 384 МиБ.
      Пользователь подтвердил схему 2026-10-07; реализация начинается по плану.
- [x] Реализовать сервис только для актуальных опубликованных записей:
      GET/HEAD/Range, отмена, очистка временных файлов и ограничения ресурсов.
      37 native-проверок; общий non-MySQL набор: 716 pass / 4 skip.
- [x] Развернуть отдельный worker и обновить только edge; основной API/web
      остаются на 5c4a9cc, база и SMTP сохранены, оплаты возвращают 503.
      Защищённые копии и точный откат записаны в operations guide.
- [x] Проверить настоящее видео: H.264 + AAC, 96 197 089 байт, HTTP 206,
      обложка 200; браузер воспроизводит и продолжает после перемотки на 7:43.
      Физическое прослушивание звука не выполнялось; оба потока проверены
      ffprobe. Проверен первый ролик, не все 60 и не доступность по всей РФ.
- [ ] Отдельно разобрать свежие advisories основного приложения до 2026-10-08:
      audit 1 critical / 35 high / 36 moderate / 4 low. Новый worker без npm
      зависимостей; это не снимает ограничения production для API/web.
      8 октября: native prod audit 51 (1 critical / 20 high / 26 moderate / 4 low).
      Общий dependency gate остаётся открыт; не путать mitigation с обновлением.
- [x] S1: дополнительный запрет нативного SVG-loader Sharp в API по официальному
      workaround; signature gate и JPEG/PNG/WebP остаются. RED → GREEN с
      настоящим декодером; raster-проверки всех avatar/admin/comment upload.
      Только локально: Next/asset tools и обновление Linux-образа не закрыты.

### 2026-10-07 — оформление отзывов клуба

- [x] Вместо бело-зелёных скриншотов показать настоящие цитаты на тёплой бумаге;
      сохранить ссылки на девять оригиналов и не выдумывать авторов/содержание.
- [x] Проверить чтение, клавиатуру, перелистывание и отсутствие автозагрузки
      скриншотов: три RED→GREEN случая. Готовая сборка — 49 browser pass;
      716 non-MySQL pass / 4 skip; типы, lint, API и границы проходят.
- [x] Проверить мобильный и большой экран, сохранить локальные превью.
- [ ] По отдельному запросу пользователя отправить изменения в Git/на стенд.

### 2026-10-07 — ЮKassa: разовая тестовая оплата клуба

- [x] Подтвердить сценарий: тестовый магазин, без сохранения карты/автосписаний
      и онлайн-оплаты товаров. Пара shopId/ключ проверена чтением аккаунта;
      эта проверка не создаёт платежей.
- [x] Исследовать checkout, SQL settlement и изоляцию стенда; оформить предложение
      в `tasks/plan.md`, сохранив остальные открытые задачи.
- [x] Пользователь подтвердил план и добавление таблицы намерений 2026-10-07.
      Включение оплаты на сервере — отдельная контрольная точка после проверок.
- [x] Y1: Test-only HTTP-клиент. Приёмка: неверный shop/live-ответ/опасный URL
      отклоняется; чтение/время ограничены; ошибки без секретов.
      Проверка: focused Vitest, types, backend build; 2–4 файла.
- [x] Y2, после Y1: Намерение до внешнего запроса. Приёмка: конкурентный повтор
      и рестарт не создают другой платёж; изменённое тело конфликтует; старый
      неизвестный запрос не отправляется. Проверка: отдельная MySQL, миграция,
      preflight; 3–5 файлов.
      11 проверок на настоящей отдельной MySQL 8.4 проходят. Для SSH-проверки
      использован только CLI testTimeout 20 с: серия десяти сериализованных
      транзакций занимает около 14 с через туннель. Assertions и TTL неизменны.
      Preflight сохраняет три прежних orphan 0017–0019; выкладка блокирована.
- [x] Y3, после Y2: Nest checkout/webhook + settlement. Приёмка: только проверенный
      и связанный test/succeeded/paid выдаёт доступ; подделка/return не выдаёт;
      дубль не продлевает срок/не дублирует outbox. Проверка: HTTP, MySQL,
      Prodamus-регрессии и статические проверки; срезы по 3–5 файлов.
      24 native HTTP/MySQL сценария и 15 прежних SQL-регрессий проходят;
      provider HTTP подменён, настоящие sandbox-платежи не создавались.
      Проверены rollback receipt/access/outbox и разовая отмена без Prodamus.
      Типы, build, API (72 / 25461), boundaries и docs проходят; полный прогон
      без MySQL: 1023 passed / 596 skipped (SQL и внешние ресурсы не проверяет).
- [x] Y4, после Y3: Передать клиентский контракт, проверить сохранение ключа
      и обозначение разовой тестовой покупки. Фронт — отдельный scope.
      Контракт HTTP Idempotency-Key описан в backend-handoff-2026-10-05.md;
      caller и TEST-only UI реализованы локально в Y4a–Y4d8; frontend gate off.
      Типы API не изменены этим UI; provider/Safari и rollout остаются Y5.
- [ ] Контрольная точка: review безопасности и native audit перед rollout.
      `pnpm audit --prod --audit-level high`: 51 advisory (1 critical, 20 high).
      Добавленных зависимостей нет; это не 51 доказанная эксплуатация.
      proxy-addr 2.0.7: advisory требует неверного IPv4-mapped IPv6 trust subnet;
      текущий trust proxy = loopback без этого short-prefix subnet. Перед rollout
      обновить/проверить фактическую proxy chain, а не объявлять bypass подтверждённым.
      tRPC experimental_nextAppDirCaller в сервере не найден. Sharp SVG: загрузка
      проверяет JPEG/PNG/WebP до декодера; требуется оценить все runtime пути.
      Axios остаётся в legacy OAuth, новый YooKassa transport его не использует.
      Остальные high/build-path advisories не закрыты; отдельный dependency review
      и повтор audit обязательны. Рефакторинг зависимостей/force upgrades не делались.
- [ ] Y5, после отдельного подтверждения: резервирование, изолированный egress,
      миграция, cabinet webhook и sandbox-платёж; дубль не меняет срок/число
      заданий письма. Проверить возврат и точный откат.
      Пользователь подтвердил безопасный переход базы и rollout тестовой оплаты
      2026-10-07; этапы ниже не разрешают реальные деньги или сброс базы.
- [x] B1: защищённая свежая копия и восстановление в отдельной MySQL без API/
      почтовых работников. Схема, количество и digest строк всех 28 таблиц совпадают;
      данные/конфигурации не выводятся и не попадают в Git.
      Две отдельные копии восстановлены из свежего дампа; 833 строки и все
      24 AUTO_INCREMENT-счётчика сверены. Рабочая БД не сбрасывалась.
- [x] B2, после B1: отдельный fail-closed stage-baseline upgrader только для 0026.
      RED→GREEN unit + настоящая репетиция SQL; несовпадения/блокировка/сбой
      останавливают обновление, точный повтор не пересоздаёт таблицу.
      47 unit/CLI проверок; четыре migration-набора — 78 pass. На настоящей
      восстановленной MySQL проверены CREATE, отсутствие изменений старых строк,
      повтор без DDL, отказ при занятой блокировке и отказ/восстановление после
      недостаточных CREATE-прав. Provider, HTTP checkout и доставка не проверялись.
- [x] B3, после B2: применить только добавление таблицы на тестовом стенде,
      записать фактическую квитанцию вне DB, сохранить старую историю без выдумок;
      проверки гостевого стенда проходят, оплаты до Y4/Y5 остаются выключенными.
      7 октября 20:17 МСК: 28 → 29 таблиц, 833 старые строки/структуры неизменны,
      checkout intents — 0 строк, исторический журнал не создан. Шесть сервисов
      healthy, прежние образы/сети сохранены, 8 гостевых smoke проверок проходят.
      Общий локальный прогон: 1070 pass / 596 SQL/external skip; types/build/API/
      boundaries/docs проходят. Legacy preflight всё ещё блокирует 0017–0019.
- [x] Кабинет тестового магазина 1489524: в Safari подтверждены сохранённые
      уведомления `payment.succeeded` / `payment.canceled` на staging webhook.
      Прежний `/library` заменён; обработчик ещё не выложен, это не приёмка оплаты.
- [x] Подготовить и проверить opt-in payment-only gateway до изменения API-сетей.
      На настоящем Docker: проверенный TLS к `/v3/me` → 401 без ключа;
      неверный/пустой SNI и plaintext отвергаются; прямой TCP egress запрещён.
      Два native-теста проходят, RED и mutation-проверка подтверждены.
      Compose сохраняет существующие SMTP/video/image overlays. Временные
      контейнеры/сети удалены; конфигурация не применена к рабочим сервисам.
- [ ] Развернуть gateway вместе с готовым caller/backend и повторить review
      зависимостей/доступов, затем настоящую sandbox-приёмку Y5. API пока isolated,
      checkout закрыт; ключ/реальные деньги/новый frontend staging не подключены.
- [x] Y4a: подготовить сохранение одной заявки в браузере до dispatch, не
      подключая незавершённый caller к кнопке. UUID + hash без email/URL; отказ
      при сбое storage/crypto/locks и смене выбора, никакой автоматической замены.
      30 unit + 3 Chromium native: две вкладки, reload, настоящий lock timeout;
      mutation shared-lock отвергается. Full suite 1100 pass / 596 skip.
- [x] Y4b: подготовить test caller и отдельный небатчированный tRPC-запрос
      с сохранённым UUID. 13 wire/lifecycle проверок: timeout/retry, отмена
      сессии, изоляция ключей, storage denial, неизменный unkeyed batch.
      Исправлен подтверждённый RED fallback: выключенный test mode больше
      не создаёт keyed-заявку в Prodamus. Full suite 1115 pass / 596 skip.
- [x] Y4c: подключение к UI с явным test/one-off режимом, возврат, терминальный
      статус, новая покупка только после проверки сервером. До полной приёмки
      не включать оплату; /club использует caller только в явно opt-in build.
      Локальная UI-приёмка завершена в Y4d8, стенд не менялся.
- [x] Y4c1: серверная проверка сохранённой заявки без создания нового платежа;
      минимальный статус, проверка получателя, реальная SQL-приёмка.
      48 native SQL + 4 focused checks (50 уникальных): pending/canceled,
      outage, blacklist/actor/email, неизменная unknown-заявка, atomic outbox,
      return+webhook и выбор. Mutation двух binding guards → RED, restore → GREEN.
      Full local: 1115 pass / 611 skip, types/backend build/API/boundaries pass.
      Метод ещё не выведен в HTTP/UI; тестовый стенд и фронт не менялись.
- [x] Y4c2: POST-контракт проверки возврата, undefined input, UUID header,
      strict state-only response, запрет batch/GET, no-store/no session.
      12 HTTP + 56 native SQL сценариев; защитный batch guard проверен mutation.
      Типы API обновлены (73 процедуры); UI и стенд не изменялись.
- [x] Y4c3: квота согласована (12/мин на заявку, 60/мин на IP); реализована
      HTTP-политика с 429/Retry-After. 10 quota HTTP + 57 native SQL;
      mutation нормализации UUID → RED, restore → GREEN; full 1137 pass /
      618 SQL/external skip, types/backend build/API/boundaries/docs проходят.
      UI, схема, зависимости и стенд не изменены; реальная оплата не проверена.
- [ ] Перед выкладкой Y4 проверить реальную цепочку proxy/IP; текущий
      loopback trust не доверяет Docker edge и группирует его клиентов.
      Перед несколькими API-процессами нужен общий атомарный quota store.
- [x] Y4d: UI и безопасная явная следующая покупка после подтверждённого
      терминального результата; ограниченный опрос, без доверия URL/unknown.
- [x] Y4d1: read-only browser return caller: отсутствие заявки — без HTTP,
      строгий POST/state-only, сохранение evidence, отмена сессии/экрана,
      отказ при смене заявки другой вкладкой. 69 unit/wire + 4 Chromium;
      full 1163 pass / 618 skip, types/frontend build проходят. UI не подключён.
- [x] Y4d2: ограниченный опрос одного UUID/сессии: до 6 запросов, минимум 5с
      после завершения, общий бюджет 30с, без retry на 429/ошибках/unknown.
      13 unit/wire + 2 настоящих Chromium HTTP-сценария; mutation интервала
      выявлена. UI, cooldown явных проверок и следующая покупка ещё не подключены.
- [x] Y4d3: резервирование следующей заявки — только явным действием после
      свежего terminal proof под общей Web Lock. Смена UUID/записи, unknown,
      pending, ошибки и abort не заменяют evidence. 25 новых unit/wire;
      настоящие две вкладки дают одного победителя и один stale отказ.
      Это ещё не dispatch новой оплаты и не UI; TEST на стенде не включён.
- [x] Y4d4: отдельный next-purchase caller — fresh proof, новая durable заявка,
      затем один keyed POST; abort/смена UUID между резервированием и dispatch
      запрещают запрос. Timeout сохраняет новый ключ для явного обычного retry.
      UI ещё не использует caller; TEST на стенде не включён.
- [x] Prerequisite result UI: исправлена потеря Retry-After при нормализации
      tRPC ошибки; сохраняется только безопасный числовой delay без private
      response metadata. 19 request-lifecycle checks, RED/GREEN; квоты неизменны.
- [x] Y4d5: controller экрана результата: только одна конечная campaign,
      явные повторные проверки соблюдают Retry-After, cancel/session → paused,
      dispose запрещает поздние callbacks. 12 новых unit/wire + Chromium
      cooldown; storage не меняется. Сам экран и visibility binding ещё не готовы.
- [x] Y4d6: отдельный TEST result view: SSR без browser reads/HTTP, доступные
      состояния, скрытие document/retained tab отменяет campaign; возврат не
      возобновляет её. Cooldown сохраняется, expiry только включает кнопку.
      1 SSR + 5 Chromium UI cases; mutation active-cancel → RED, restore → GREEN.
      Экран ещё не подключён к /club; TEST-mode gate/next-purchase UI остаются.
- [x] Y4d7: /club result route за build-time NEXT_PUBLIC_CLUB_TEST_CHECKOUT;
      по умолчанию legacy, строго true — только TEST result, invalid — unavailable.
      Старый checkout/paid-claim не монтируется в TEST; URL не переключает режим.
      9 SSR checks + настоящие Next route checks в обоих build modes;
      actual provider/context сохраняет cooldown. Стенд не менялся.
- [x] Y4d8: TEST purchase form, явное восстановление той же заявки и next purchase
      с fresh terminal proof; abort скрытого экрана/сессии до dispatch/navigation.
- [x] Y4d8a: caller abort проходит через подготовку/ожидание Web Lock и HTTP
      первой/повторной покупки; отмена до reservation не пишет key. Оба create
      caller проверяют saved key после ответа, поздняя URL не принимается.
      5 regression RED → GREEN; форма и привязка к экрану ещё впереди.
- [x] Y4d8b: /club TEST form: email/plan, проверенная сессия без её изменения,
      явное create/restore/next; terminal proof перепроверяется под Web Lock.
      После попытки нужен новый check; timeout/abort/ошибки сохраняют key.
      Только ожидаемые HTTPS URL ЮKassa, неизвестный результат не даёт новый key.
      14 native UI cases (9 новых), SSR + actual Next route в true/false builds;
      mutation caller signal → лишний HTTP (RED), restore → GREEN.
      Full 1243 pass / 618 SQL/external skip, types/lint/build/API/boundaries pass.
      Provider/Safari, dependency/proxy/release gates остаются; stage не менялся.
- [x] Отдельно диагностировать повторный сбой native video-wrapper в полном
      прогоне: сохранить безопасную диагностику имени упавшего дочернего теста,
      воспроизвести причину под нагрузкой; не считать успешный повтор исправлением.
      V1: воспроизведены timeout/TTL проверки под нагрузкой; виртуальные часы
      и ожидание реального удаления вместо фиксированного sleep. 64/64 suites
      при 8 исполнителях; обе граничные mutation-проверки дают RED.
      Runtime/лимиты не менялись; диагностика не раскрывает child output.

### 2026-10-08 — комментарии, модерация и административные действия

- [x] Сверить аудит 21/23 и сдачу 4.4/4.6 с существующим бэкендом; код API/БД не менять.
- [x] Не отправлять неполный набор фото; сохранять текст и подтверждённые снимки.
      Не повторять неизвестное создание комментария или upload автоматически.
- [x] Проверять подтверждения like, жалоб, блокировок, выдачи Клуба и тегов;
      проверять отсутствие удалённого поста/статьи по свежему списку.
- [x] Защита от двойных нажатий/поздних ответов; права меню; жалобы для модератора;
      перенос кнопок на узких экранах, сохранность выбранных тегов после отказа.
- [x] 212 модульных тестов; 114 различных браузерных сценариев (25 новых,
      89 регрессий); уточнённая проверка курсора проходит три раза. Production-сборка,
      типы корня/фронтенда/E2E, ESLint, неизменный API, границы и ссылки проходят.
      Подставной API; кнопки модерации доступны на 320/390/414px, вид 390/1440 осмотрен.
- [ ] Совместная приёмка с настоящим API/SQL, медиа, физическими устройствами/PWA.
      Серверные ложные успехи для отсутствующих ID и идемпотентность комментариев
      остаются зависимостями; клиентская защита этих действий не переживает reload.
- [ ] Интеграции VK/сезоны/менеджер и общая приёмка 4.1–4.16; публикация не запрошена.

### 2026-10-08 — четыре сезона Клуба, клиентский подшаг 4.10

- [x] Удалить локальный выбор двух сезонов; подключить серверный launch-config.
      Обновление в московскую полночь и после возврата/сна/восстановления сети.
- [x] Сохранить подтверждённое оформление при отказе; fallback готовых изображений,
      прежняя геометрия баннера и читаемое сообщение с повтором.
- [x] Вкладка «Сезоны» только для владельца: режим, четыре даты и ссылки; сохранить
      managerEmail, использовать expectedRevision, удержать ввод при конфликте/сбое.
- [x] 252 модульных случая (202 verify + 50 отдельно); 56 разных browser cases
      (22 сезонных + 34 регрессии); типы, lint, сборка, API и границы проходят.
      Корневой package.json не менять. Итоговые визуальные проверки — в WORK_PLAN.
- [ ] Настоящие API/SQL/CAS, согласованные даты/материалы заказчика, физические
      устройства/PWA и совместная приёмка 4.10. Бэкенд/БД не запускались и не менялись.
- [ ] Далее заказ менеджеру 4.12, инструменты менеджера, VK 4.11 и общая сдача.
      Перед окончанием работы удалить появившуюся .aws; push/выкладка не запрошены.

### 2026-10-08 — объединение фронтенда и бэкенда для staging

- [x] Без конфликтов объединить frontend `0b77270` с пятью локальными серверными
      коммитами, сохраняя историю и прежние ограничения TEST/подписей/доступа.
- [x] Проверить объединённое дерево: 1779 pass / 618 SQL-external skip;
      типы, lint, обе сборки, API, границы и документация проходят.
- [x] Воспроизвести и исправить ожидания в browser-тестах без изменения runtime:
      отправленный запрос перед сменой аккаунта, завершённые проверки статуса,
      подтверждённая правка комментария и запись удаления вложения в IndexedDB.
      Каждый затронутый сценарий проходит три повторения.
- [x] Завершить общий прогон девяти browser-spec: 168/168 pass, типы и lint
      перепроверены после последних правок тестов. Объединённая версия проверена
      для запрошенного обычного push в Git staging; выкладка на сервер не входит.
- [x] Уточнить индикатор сохранения черновика: исправлено 9 октября, checkpoint
      подтверждает только записанный снимок. Оба управляемых browser-теста
      воспроизводят ошибку до исправления и проходят после него. Настоящие
      API/SQL/provider/device gates остаются открыты.

### 2026-10-08 — M06 обработка платежного уведомления

- [x] Выделить request-neutral payment orchestration в billing: явные ленивые
      configuration/fulfilment ports и ответ только после durable settlement.
      Ключи, canonical parser, merchant binding, транзакции и replay не изменены.
- [x] 14 прямых случаев / 7 ожидаемых scaffold RED; новый native HTTP тест
      отклоняет ключ другого магазина. Удаление проверки выбранного ключа ломает
      прямой тест и HTTP (200 вместо 422); восстановленная версия проходит.
- [x] 141 focused checks с compiled ESM; full 1794 pass / 618 SQL-external skip,
      типы, 409.6 kB build, неизменный API и 559-file boundaries проходят.
      Только локальный коммит; frontend/staging/server в этом запуске не меняются.
- [ ] M06 real SQL/provider acceptance и release gates остаются открыты;
      M07c не реализовывать до решения о максимальном ожидании shutdown.

### M06 cancellation orchestration — 8 October, evening

- [x] Отделить cancellation acknowledgement от HTTP: обязательные ленивые
      secret/binding ports, проверка выбранного ключа до merchant configuration,
      ответ только после app-owned durable confirmation. Политики не изменены.
- [x] 10 прямых RED/GREEN случаев и 55 focused checks с native HTTP/compiled ESM.
      Mutation без проверки ключа ломает прямой тест и HTTP (200 вместо 422).
- [x] Full 1804 pass / 618 SQL-external skip; типы, 410.2 kB build,
      неизменный API и 560-file boundaries проходят. Только локальное сохранение;
      frontend, staging и сервер не меняются.
- [ ] Real SQL/provider acceptance, M07c shutdown bound и прежние release gates
      остаются открыты; fixture verification не разрешает включение оплаты.

### M06 durable regression rerun — 8 October, 20:42 Moscow

- [x] На новой локальной одноразовой MySQL 8.4: settlement/cancellation —
      15 настоящих SQL-проверок проходят без пропусков. Изолированная tmpfs,
      loopback-only порт, синтетические данные; собственный контейнер удалён.
- [x] Отдельно 55 cancellation/native HTTP/compiled ESM проверок проходят.
      Это не объединённая проверка HTTP → настоящая SQL → Prodamus.
- [ ] Остальные SQL/external проверки, миграционная/provider приёмка и M07c
      остаются открыты. Код, фронт, сервер и настройки оплаты не менялись.

### M08 user moderation audit atomicity — 8 October, 20:59 Moscow

- [x] Block/unblock и audit теперь фиксируются в одной транзакции; при отказе
      audit блокировка, sessionVersion и cancellation intent откатываются вместе.
      Успешные правила доступа/блокировки/отмены не изменены.
- [x] Два исходных SQL RED, шесть новых SQL-проверок (две с native HTTP/JWT);
      возврат audit после commit ломает четыре теста. После восстановления:
      97 focused pass, full 1804 pass / 624 SQL-external skip; типы/build/API/
      boundaries/lint проходят. Собственная одноразовая база удалена.
- [x] Атомарность dismiss report — следующий checkpoint ниже.
- [ ] Атомарность delete comment — отдельный следующий срез.
      M07c и provider/dependency/rollout gates не закрыты; без push/deploy.

### M08 report dismissal — 8 October, 21:15 Moscow

- [x] Отклонение жалобы и audit фиксируются вместе. Два SQL RED (один native
      HTTP/JWT), четыре новых SQL случая, повторный разрыв транзакции снова
      ломает обе rollback-проверки. Сохраняются остальные жалобы и комментарий.
- [x] 113 focused pass после отдельного ремонта старой SQL-заглушки уведомлений;
      full 1804 pass / 628 SQL-external skip, types/build/API/boundaries/lint/docs.
      Одноразовая tmpfs база удалена; без frontend/push/deploy/provider effects.
- [x] Delete comment/audit — выполнен в следующем checkpoint. Старый неиспользуемый
      content/comments.dismissCommentReport оставлен до отдельной уборки.
      M07c и прежние provider/dependency/rollout gates остаются открыты.

### M08 reported-comment deletion — 8 October, 21:30 Moscow

- [x] Удаление комментария, его лайков/жалоб, отвязка ответов и audit теперь
      фиксируются вместе. Два исходных SQL RED (один native HTTP/JWT); пять
      новых SQL случаев. Возврат audit после commit снова ломает оба отката.
- [x] 118 focused pass; full 1804 pass / 633 SQL-external skip; types/backend
      build/API/boundaries/lint/docs проходят. Собственная одноразовая база удалена.
- [ ] Старые content/comments.dismissCommentReport и deleteCommentAndReports
      не имеют runtime callers; оставлены до отдельного разрешения на уборку.
      M08 в целом, M07c и provider/dependency/rollout gates остаются открыты.
      Никаких frontend/push/deploy/payment effects.

### M08 notifications SQL acceptance — 8 October, 21:45 Moscow

- [x] 10 новых native HTTP/JWT/SQL случаев: upsert устройства, actor из сессии,
      anonymous registration, legal metadata/последнее same-second согласие,
      admin-only точечная очистка и три безопасных отказа SQL без ложного успеха.
- [x] 77 focused pass; подмена target user при очистке ломает два теста.
      Изолированы две SQL-фикстуры общей аудитории, исходные assertions сохранены.
      Full 1804 pass / 643 SQL-external skip; types/build/API/boundaries/lint/docs.
- [ ] Реальная доставка/устройства и общая приёмка остаются открыты. Runtime,
      схема, фронт, сервер и настройки уведомлений не менялись; own test DB удалена.

### M08 profile persistence SQL acceptance — 8 October, evening

- [x] Восемь native HTTP/JWT/SQL случаев: session actor, запрет записи чужих
      role/email, partial/empty patch, повторный запрос удаления без стирания
      профиля, unauthenticated refusals и два отказа SQL без ложного успеха.
- [x] 45 focused pass; подмена адресата UPDATE ломает три теста. Full 1804 pass /
      651 SQL-external skip; types/build/API/boundaries/lint/docs проходят.
      Новый тест не подменяет identity/SQL и не отправляет внешних запросов.
- [ ] Avatar upload/S3/orphan cleanup, zero-row writes и erasure/retention остаются
      открыты на этом checkpoint; zero-row writes исправлены отдельно ниже.
      Runtime/frontend/server не менялись; own tmpfs база удалена.

### M08 latest announcement SQL acceptance — 8 October, evening

- [x] 14 native HTTP/JWT/SQL случаев: публикация/status/target, порядок по
      publishedAt с fallback createdAt, пустой ответ, guest/member/staff,
      paid/pending/failed/expired/null expiry и доступ до конца отменённого периода.
      Повторный запрос с тем же JWT перечитывает изменённый срок из SQL.
- [x] 66 focused pass. Выбор draft вместо published ломает 14 тестов;
      обход проверки club entitlement — 6. Runtime восстановлен byte-identical.
      Full 1804 pass / 665 SQL-external skip; types/build/API/boundaries/lint/docs.
- [ ] Доставка/provider/device и полная публикационная приёмка остаются открыты.
      Новая глобальная latest SQL suite требует отдельную свежую одноразовую БД
      и BACKEND_LATEST_ACCEPTANCE=1; не запускать параллельно с SQL publishers.
      Own tmpfs база удалена; frontend/server/политики не менялись.

### M08 absent profile row — 8 October, evening

- [x] Три SQL RED воспроизвели ложный успех при отсутствующей записи пользователя:
      profile field, avatar URL persistence и deletion request. Канонические
      UPDATE теперь проверяют matched affectedRows и не возвращают успех при нуле.
- [x] Повторные одинаковые изменения существующего профиля успешны (FOUND_ROWS
      штатного mysql2); empty patch остаётся прежним no-op. 49 focused pass,
      full 1804 pass / 669 SQL-external skip, types/build/API/boundaries/lint/docs.
- [ ] Missing-row проверки вызывают настоящий Nest service + SQL напрямую,
      не доказывают HTTP deletion race или загрузку/очистку avatar в S3.
      Erasure/retention и provider/rollout gates открыты; own tmpfs база удалена.
      Без frontend/server/auth-policy/push/deploy изменений.

### M05 handoff SQL verification — 8 October, evening

- [x] 62 pass: manual-publication SQL (52, включая native HTTP/JWT) + post-video
      reconciliation SQL (10). Removed-post refusal/media invariants, transaction
      rollback and existing success paths verified without external delivery.
- [x] 51 content/native-content/native-admin-content SQL checks pass in a separate
      sequential run, including compiled ESM. No production/test changes needed.
- [x] Full default 1804 pass / 669 SQL-external skip; types/build/API/boundaries/
      lint/docs pass. Logs and exact scopes recorded in plan; own tmpfs DB removed.
- [ ] Frontend initial-model refusal/draft retention, trusted video metadata,
      external storage/push delivery, migration/provider/rollout gates stay open.

### M05 atomic bulk video import — 8 October, evening

- [x] Real HTTP/JWT/MySQL RED reproduced a partial batch after the second insert
      failed. Canonical bulkImportVideos now checks duplicates and writes using
      one transaction; failure rolls back earlier rows and a clean retry works.
- [x] Seven SQL cases verify metadata/null/empty defaults, order, existing and
      within-batch duplicates, empty batch, rollback/retry and guest/member refusal.
      63 focused pass; full default 1804 pass / 676 SQL-external skip. Types,
      build/API/boundaries/lint/docs pass; own disposable tmpfs DB removed.
- [ ] Concurrent competing imports/retry policy remain unaccepted. No quotas,
      schema, auth, frontend, server, provider, activation or deployment changes.

### M05 admin content deletion SQL acceptance — 8 October, evening

- [x] Nine real native HTTP/JWT/MySQL cases: post/dependent cascade, surviving
      legacy reply detachment, final-delete fault rolls back every earlier change,
      single-media scope, missing-ID no-op and guest/member refusal for both routes.
- [x] Omitting media cascade deliberately breaks the persisted-state assertion;
      original runtime restored byte-identical. 44 focused pass; full default
      1804 pass / 685 SQL-external skip. Types/build/API/boundaries/lint/docs pass.
- [ ] Actual external asset deletion/storage,
      concurrency and rollout/provider gates remain separate. No runtime or
      frontend/server/policy changes; own disposable tmpfs DB removed.

### M05 raw-camera filename cleanup SQL acceptance — 8 October, evening

- [x] Seven native HTTP/JWT/MySQL checks, 15 literal filename fixtures: recognized
      camera names cleared across posts, document names/null/empty and all other
      metadata retained, repeat no-op, statement rollback and unauthorized refusal.
- [x] Broadening the SQL predicate to all non-null names breaks retention test;
      canonical source restored unchanged. 42 focused pass; full 1804 pass /
      692 SQL-external skip, types/build/API/boundaries/lint/docs pass.
- [ ] Global maintenance suite requires BACKEND_MEDIA_NAMES_ACCEPTANCE=1 and a
      fresh disposable DB without other SQL publishers. External storage/rollout
      remains unaccepted; own tmpfs DB removed, runtime/frontend/server unchanged.

### M08 existing account-retention SQL regression — 8 October, evening

- [x] Eight existing checks rerun alone on fresh disposable MySQL: all-or-nothing
      scrub rollback, eligible repeat no-op, preservation of active/grace/recent/
      no-request accounts, concurrent single processing and renewal after lock wait.
- [x] No production/test changes or new RED/GREEN claim. Full default 1804 pass /
      692 SQL-external skip; types/build/API/boundaries/lint/docs pass. Own DB removed.
- [ ] Only existing SQL semantics verified: full HTTP/worker lifecycle erasure,
      external files/backups and legal retention acceptance remain open. No policy,
      frontend/server/provider/activation/deployment changes.

### M08 HTTP-to-worker retention acceptance — 9 October, early morning

- [x] Four new real HTTP/JWT/SQL cases: fresh deletion request, eligible aged
      request, active club and club grace through the Nest maintenance worker.
      Persisted target and neighboring-account state checked; no external effects.
- [x] Omitted maintenance cleanup fails one case; bypassed age/club protection
      fails three. Production source restored byte-identical; 50 focused pass
      (12 retention SQL cases). Own isolated tmpfs database/container removed.
- [x] Full default 1804 pass / 692 reported SQL-external skips; types, backend
      build/API/boundaries/lint/docs pass. Safe test cleanup's optional-worker type
      error diagnosed and repaired with explicit Nest get<WorkerJobs>, not a cast.
- [ ] BACKEND_RETENTION_WORKER_ACCEPTANCE=1 is a sequential fresh-DB-only opt-in.
      External files/backups, legal erasure and deployed shutdown remain open;
      M07c still requires a human drain-bound decision. No runtime/frontend/server,
      policy/payment/merge/push/deploy changes.

### M08 native profile disappearance acceptance — 9 October, early morning

- [x] Three HTTP/JWT/SQL cases reject false success when the account disappears
      after authentication but before profile field, avatar URL or deletion write.
      Canonical methods execute after a deterministic SQL deletion at the test-only
      service boundary; generic HTTP errors and neighboring-account snapshot checked.
- [x] Removing affectedRows guards fails all three cases; production restored
      byte-identical. 42 focused pass (15 SQL), full 1804 pass / 695 reported skips;
      types/build/API/boundaries/lint pass. Owned disposable tmpfs database removed.
- [ ] Real competing requests, external avatar upload/cleanup and erasure are not
      accepted by this interleaving test. M07c needs a human drain-bound decision;
      provider/dependency/rollout gates remain open. No runtime/frontend/server,
      payment/policy/activation/merge/push/deploy changes.

### M08 native maintenance SQL failure recovery — 9 October, early morning

- [x] One new worker/SQL test: final scrub failure rolls back all account data,
      the next scheduled tick recovers, and the third is a stable no-op. Neighbor
      untouched; error log generic. Only interval scheduling is fake-timed.
- [x] Removing pending-promise release prevents recovery and fails the test;
      production restored byte-identical. 51 focused pass, 13 SQL cases; full
      1804 pass / 695 reported skips. Owned fresh tmpfs database removed.
- [ ] Sequential fresh-DB opt-in only; external erasure/legal signoff, M07c human
      drain bound and provider/dependency/rollout gates remain open. No runtime,
      frontend/server/payment/policy/activation/merge/push/deploy changes.

### M06 signed native webhook-to-SQL acceptance — 9 October, early morning

- [x] Nine new native HTTP/real SQL checks: one club period and access mail across
      sequential/concurrent replays, five binding refusals, unsigned refusal,
      live demo refusal and mail-link failure rollback/clean retry.
- [x] Bypassed demo guard fails actual persisted-access assertion; rejected valid
      replay fails HTTP acknowledgment. Production restored byte-identical.
      Final 69 focused pass, including 24 SQL checks; own tmpfs DB removed.
- [x] Full default 1804 pass / 704 reported SQL-external skips; types, backend
      build, unchanged API, boundaries and lint pass. No runtime/API/policy change.
- [ ] Real provider delivery, deployed test-access scope, renewal/cancellation
      native HTTP-to-SQL, dependency/rollout gates and M07c human drain bound
      remain open. No frontend/server/payment/activation/merge/push/deploy changes.

### PD4 first dev Prodamus entitlement — approved user scope

- [x] PD4a: native HTTP/disposable SQL RED/GREEN for monthly demo checkout,
      signed 30-day settlement, replay/refusal and rollback. No live guard change.
- [x] PD4b: bounded separate receiver + no-worker compiled entry, same checkout
      response and strict dev/test configuration; verify build/native boundaries.
- [x] PD4c: review/audit, versioned bundle and exact two-route server rollout
      with recoverable edge/config backup; configure global test-store callback.
- [ ] PD4d: confirm actual provider delivery after human test payment, read access
      through existing dev account. Until then payment is not end-to-end accepted.

PD4c evidence: source 1d9fce3, dedicated healthy prodamus-test process alongside
unchanged 1f67d5b API/web. Fourteen external refusal/health checks pass; host and
container exact routes only, original quotas/live/shop blocks retained. Cabinet
callback saved with action-time human confirmation; demo notification prohibition
unchecked. Owned disposable DB and temporary encrypted-transfer key files removed.
See operations/teamassist-staging for bundle hash and precise rollback. No actual
provider payment, receipt or access observed yet; PD4d remains open.

PD4d update: human completed a demo provider flow. Matching provider payment
reports success, but Open banking EU sends currency=eur; callback receives 400
and dev order stays pending with no receipt/access. Do not manually grant or
replay. Resolve RUB-only method restriction versus separately specified FX
acceptance before asking for another test. Four unverified cancellation SQL test
drafts remain local after interruption; disposable container already removed.

- [x] PD4e local: remove selected method/installment hiding for new TEST links;
      accept signed RUB-order payments in RUB/EUR/USD/KZT/BYN, retaining foreign
      evidence in receipt replay identity. No guessed FX or live currency change.
- [x] Six initial RED, numeric-scalar RED and altered-FX replay mutation; 79
      focused checks pass on disposable SQL/native/compiled paths. Full 1816
      pass / 760 reported skips; types/build/API/boundaries/lint/docs pass.
      Exact owned tmpfs DB removed, no mounts/OOM and owner inventory empty.
- [x] Deploy only 6987883 TEST bundle on pinned image, six existing containers
      unchanged, seven healthy. User-approved provider retry receives 200/success.
      Exact-order read-only SQL: one receipt, paid 790 RUB order, 30-day expiry
      8 Nov 01:35 MSK. Outbox marked sent, one attempt/no error. No new charge.
- [ ] Other actual provider methods and logged-in browser access not accepted
      by the one EUR flow; recurring/shop remain out of scope. Frontend TEST
      autopay wording remains incorrect. Existing rollout/dependency gates open.

### M06 native cancellation-to-SQL acceptance — 9 October, 01:48 Moscow

- [x] Finish four saved cancellation drafts: independently signed native HTTP
      confirms the real SQL profile/order, preserves paid expiry, rejects unknown
      profile/wrong key and fully rolls back on a paid-order write failure.
- [x] Correct only malformed fixture action and disposable MySQL trigger setup;
      seed an outstanding lease to test release. Three mutation RED checks catch
      skipped durable confirmation, skipped order marking and retained lease.
      Production restored byte-identical; no signature/transaction/replay change.
- [x] Eight focused files / 115 checks pass (28 actual SQL checks); full default
      1816 pass / 760 reported skips. Types, both backend builds, unchanged API,
      boundaries and lint pass. Exact owned tmpfs DB removed, owner inventory empty.
- [ ] Native renewal SQL / actual provider cancellation acceptance remain open;
      fixed-Date replay does not prove timestamps stable across later deliveries.
      M07c human drain bound, rollout/dependency and frontend wording gates persist.
      No frontend/server/payment/worker/activation/merge/push/deploy change.

### PD4f explicit read-only staging smoke — 9 October, 02:03 Moscow

- [x] Keep closed-payment default; add explicit Prodamus TEST mode. Probe only
      GET refusals and invalid {} POSTs, no valid purchase/signature/credentials.
- [x] Fifteen real-CLI loopback tests cover mode mismatch, open live callback,
      guest access, unsigned/empty acceptance, response/session/cache and redirect
      failures. Default/TEST RED and corrected shop-auth RED precede GREEN.
- [x] Dev passes all 13 probes. Guest shop returns 401 before the disabled
      capability guard; this is not authenticated shop-payment acceptance.
      Full 1831 pass / 760 reported SQL-external skips; types/build/API/boundaries/
      lint/docs pass. No SQL resources created, frontend or server changed.
- [ ] Actual other provider methods, logged-in paid browser access, incorrect
      frontend autopay wording, HTML CSP, dependency/rollout and M07c human
      drain-bound gates remain open. No new order, payment, push or deployment.

### M06 native renewal-to-SQL acceptance — 9 October, 02:08 Moscow

- [x] Four new native HTTP/disposable SQL checks: concurrent/later signed replays
      add one paid period, unknown profile/initial-payment key refuse, access-link
      failure fully rolls back and a clean retry succeeds.
- [x] Three mutation RED checks catch disabled recurring dispatch, lost remaining
      paid expiry and skipped renewal outbox. Runtime restored byte-identical.
      Eight focused files / 128 checks pass, including 32 actual SQL checks.
- [x] Full default 1831 pass / 764 reported SQL-external skips; types/backend
      build/API/boundaries/lint pass. Exact owned tmpfs MySQL removed; no mounts/
      OOM and matching owner inventory empty. No frontend/runtime/server change.
- [ ] Real provider recurring charge/cancellation and TEST autopay are not
      accepted by these local fixtures. M07c human drain bound and prior provider,
      frontend wording/CSP, dependency and rollout gates remain open. No real
      payment, SMTP, worker activation, merge, push or deployment.

### M05 competing bulk-import SQL acceptance — 9 October, 02:19 Moscow

- [x] Force two real HTTP/JWT imports to wait on the same synthetic video ID.
      One whole batch commits; the loser returns generic 500 with no partial row.
      Its explicit retry adds only the missing row and preserves existing metadata.
- [x] Transaction-bypass mutation fails the persisted-row assertion; db.ts
      restored byte-identical. Three focused SQL files / 37 checks pass. Full
      default 1831 pass / 765 reported SQL-external skips; types/build/API/
      boundaries/lint pass. Owned tmpfs MySQL removed, no mounts/OOM, inventory empty.
- [ ] All interleavings and automatic retry/conflict UX are not accepted by this
      forced collision. No runtime/frontend/server/policy/provider change; prior
      video metadata/storage, M07c human drain bound and release gates remain open.
### M05 video catalogue persistence extraction — 9 October, 02:28 Moscow

- [x] Move the seven video catalogue SQL operations into a typed connection-free
  content/video-repository.ts; preserve db.ts API/getDb ownership, publication
  predicates, ordering/NFC, internal raw dedup, write refusals and bulk transaction.
  Executable ASTs match the pre-extraction statements. Seven no-DB cases and three
  SQL CRUD/publication cases supplement native import/publication coverage; false
  success and wrong-row deletion mutations both fail before restoration. Final
  focused 50 pass (40 SQL + seven no-DB + three built-runtime); full 1838 pass /
  768 SQL-external skips. Types/build/API/564-file boundaries/lint/docs pass.
  Owned tmpfs-only MySQL removed, no working DB/provider/remote changes. Existing
  video SQL fixtures require sequential files because fixed cleanup IDs overlap
  auto-increment imports; this harness limitation is not claimed fixed. M05/M08,
  M07c and rollout/dependency/provider gates remain open. Details in plan.md.

### M05 parallel video fixture isolation — 9 October, 02:32 Moscow

- [x] Reproduce one fixture connection deleting another connection's imported
  video through overlapping fixed/auto-generated IDs (fresh real-SQL RED).
  Share test-only video schema initialization with checked named-lock ownership
  and generated IDs outside existing fixed cleanup ranges; preserve every runtime
  file, schema definition and original behavior assertion. Regression now proves
  the created row survives independent cleanup, not an exact ID constant.
- [x] Fresh-counter parallel acceptance: five SQL files / 41 checks pass, including
  published video policy and competing bulk-import rollback/retry. Full default
  1838 pass / 769 SQL-external skips; types/build/API/564-file boundaries/lint/docs
  pass. Owned loopback/tmpfs-only MySQL removed; owner inventory empty. This closes
  the preceding video fixture serial-only limitation, not all SQL isolation or the
  unrelated saved-post lock observation. No runtime/frontend/shared-server change,
  migration, payment/provider, policy, merge/push/deploy; existing gates stay open.

### M06 settlement request preparation — 9 October, 02:42 Moscow

- [x] Extract existing proof/amount/period checks and receipt/order preparation into
  a pure typed billing module. Original predicates, hashes and all recipient/SQL
  transaction statements match structurally; no changed signature/replay policy.
- [x] Thirty-nine literal-hash/refusal/immutable-input cases pass after scaffold
  RED. Removing FX binding produces four RED failures, including real HTTP/SQL
  changed-currency replay acceptance; restored before final checks. Original and
  extracted SQL baselines each pass 79 checks; final focused 172 pass, full default
  1877 pass / 769 SQL-external skips. Types/build/API/boundaries/lint/docs pass.
- [x] Review completed; exact owned loopback/tmpfs MySQL removed after ownership
  verification, inventory empty. Trigger creator setting changed only in that
  disposable fixture. Missing auxiliary review files disclosed; primary review
  instructions and project gates used. Details and evidence in plan.md.
- [ ] Remaining M06 work and real provider/browser/recurring acceptance stay open,
  as do M07c human drain-bound and dependency/rollout/frontend wording/CSP gates.
  No frontend, shared-server, actual payment, auth/CORS/proxy/quota, schema,
  dependency, merge/push or deployment changes.

### Frontend/admin backend alignment — 9 October, 02:49 Moscow

- [x] Fetch staging and inspect frontend 0b77270: already included via 7524987,
  no remote-only changes. Check editor, action confirmations, moderation, seasons,
  manager contact, access resend and subscription request/response boundaries.
- [x] Reproduce missing-user block/unblock 200 and missing-post publication false
  success (three RED cases); return transaction-checked NOT_FOUND/404 without
  changes, cancellation/audit or announcement. Preserve successful response shapes,
  already-published retry and role/session policies. Green: 60 focused checks.
- [x] Expanded disposable HTTP/JWT/SQL: 231 pass / 12 files. Full 1877 pass /
  771 reported SQL/external skips; types/build/API/boundaries/lint pass. Review and
  frontend handoff/API docs updated. Owned loopback/tmpfs MySQL removed, inventory
  empty; fixture diagnostic permissions never changed a shared server.
- [ ] First-email binding remains disabled awaiting a concrete approved identity
  scenario. Reload recovery of legacy checkout/cancellation/resend, actual provider,
  SMTP/devices and previous rollout/dependency/M07c gates stay open. No frontend,
  auth/CORS/proxy/quota/schema/dependency, push/merge/deployment changes.

### M06 blocked-recipient / saved-profile acceptance — 9 October, early morning

- [x] Extend existing native signed webhook SQL coverage with six cases:
  blocked initial/renewal/existing-receipt rejection, unblock/retry without double
  access, and initial saved-profile owner/recipient/amount conflict. Full durable
  rows of both synthetic members stay unchanged on refusal; no session cookie.
- [x] Prove sensitivity with temporary guard removals: three blocked-case RED
  failures and one profile-owner native 200-instead-of-422 failure. Restore runtime
  exactly; new tests characterize existing policy, do not change it. Outbox still
  refuses blocked recipients independently; do not claim first/renewal access bypass.
- [x] Five SQL/native files / 98 pass; full 1877 pass / 777 opt-in SQL-external
  skips. Types/build/API/boundaries/lint/format pass. Review and existing handoff
  updated; precise evidence/limitations in plan.md. Exact owned loopback/tmpfs
  MySQL removed, label inventory empty; only synthetic data removed.
- [ ] First-email identity scenario and M07c drain bound still require the user;
  real provider/recurring/SMTP/devices and previous rollout/dependency gates stay
  open. Inspect remaining safe M08 domain/repository scopes next, not another
  completed payment/cancellation wrapper. No runtime/frontend/shared-server,
  policy/schema/dependency, actual payment, merge/push or deployment changes.

### Frontend/admin stale article save — 9 October, early morning

- [x] Fresh staging fetch confirms current frontend already included. Fix
  updateArticle acknowledgement of missing/deleted article: NOT_FOUND/404 under
  existing row lock, before article/teaser writes. Preserve same-data successful
  save and idempotent delete/orphan cleanup, schemas/roles and lock/transaction.
- [x] RED four native missing/stale/orphan/concurrent cases; GREEN 36 focused,
  final eight-file SQL 156 pass; full 1877 pass / 782 opt-in SQL/external skips.
  Types/build/API/boundaries/lint pass, review and existing API/handoff updated.
  No frontend edit or browser/server acceptance claimed. Evidence in plan.md.
  Owned tmpfs MySQL removed after identity/owner/no-mount/no-OOM verification;
  owner inventory empty. Only synthetic resources from this run removed.
- [ ] First-email scenario still needs explicit user approval; M07c human drain
  bound, optimistic article revisions, actual provider/SMTP/devices and previous
  rollout/dependency gates remain open. No push, merge or server deployment.

### Frontend/admin member/payment availability — 9 October, early morning

- [x] Follow actual current frontend: email-binding draft remains disabled,
  no identity change inferred. Existing members/payments reject a missing DB
  client instead of returning false known-empty lists. Successful SQL unchanged.
- [x] Four RED helper/native HTTP refusals; 47 focused GREEN including access
  policy. Session lookup alone is doubled, not JWT unavailability acceptance.
  Real SQL 42 pass / three files; three added member/payment/grant projection
  checks. Full 1889 pass / 785 opt-in skips; types/build/API/boundaries/lint pass.
  Review/API/handoff updated; evidence and limits in plan.md.
  Owned loopback/tmpfs MySQL removed after exact owner/no-mount/no-OOM checks;
  owner inventory empty, only synthetic resources removed.
- [ ] First-email identity contract remains unapproved/disabled as in frontend;
  previous M07c/provider/SMTP/device/rollout/dependency gates remain open.
  No frontend or shared-server changes, merge/push/deploy.

### Frontend/admin club-grant refusals — 9 October, early morning

- [x] Current admin confirmation flow now receives explicit 404 for absent and
  409 for blocked/deleted grant recipients, under unchanged pre-write owner lock.
  31-day default, separate per-call grant, permissions and success shape unchanged.
  No blind retry made safe; unconfirmed SQL/network result still needs checking.
- [x] Six RED regressions; 23 focused GREEN with real HTTP/JWT/SQL. Expanded
  three-file SQL 50 pass; full default 1889 pass / 793 opt-in skips. Types/build/
  API/boundaries/lint pass, review/API/handoff updated; evidence in plan.md.
  Exact owned tmpfs MySQL removed after owner/no-mount/no-OOM checks; matching
  owner inventory empty, only synthetic resources removed, working DB untouched.
- [ ] Initial email identity contract, M07c drain bound, provider/SMTP/device and
  previous rollout/dependency gates remain open. No frontend edit or server
  acceptance, merge/push/deploy; do not present this as all scenarios completed.

### M08 admin membership read repository — 9 October, early morning

- [x] Continue from 46654dd; inspected M06 checkpoints without repeating completed
  payment modules. Extract only admin member/payment reads into domain-owned
  repository with supplied DB handle, same public facade/queries/error/rights.
- [x] Four new SQL characterizations; two expiry/order mutation RED failures,
  original behavior restored before extraction; executable AST unchanged. Final
  five-file 101 pass (54 real SQL), full 1889 pass / 797 opt-in skips. Types/build/
  unchanged API/boundaries/lint/format pass. Review and existing docs updated.
  Owned tmpfs MySQL removed after exact owner/no-mount/no-OOM checks; owner
  inventory empty. Evidence and type-generator diagnosis saved in plan.md.
- [ ] Remaining safe domain/repository scopes and existing first-email/M07c/
  provider/SMTP/device/dependency/rollout gates stay open. No frontend edit,
  pagination/optimization, actual payment, merge/push/deploy or shared-server work.

### M08 article read repository — 9 October, early morning

- [x] Continue locally after user-requested staging update to ae70522. Extract
  three article reads behind unchanged facade/connection/queries/normalization;
  public hidden/body rules and admin rights remain in their existing owners.
- [x] Four new native SQL characterizations, three mutation RED failures;
  original restored before extraction, executable AST unchanged. Final selected
  105 pass (40 real SQL); default 1889 pass / 801 opt-in skips. Types/build/API/
  boundaries/lint/format pass. Existing docs/review/evidence recorded in plan.md.
  Exact owned tmpfs database removed after owner/no-mount/no-OOM checks; matching
  owner inventory empty, working database untouched.
- [ ] Remaining safe repository scopes and prior identity/M07c/provider/SMTP/
  device/dependency/rollout gates stay open. This new slice is local only, without
  frontend, actual payment, automatic merge/push/deploy or server acceptance.

### M05/M08 ordinary-reader article acceptance — 9 October, before deadline

- [x] Four new real HTTP/JWT/SQL cases protect paid ordinary-reader access,
  next-request expiry revocation, pending/failed refusal and immediate block.
  Reuse one exact synthetic order/owned account; no session or SQL double.
- [x] Baseline 32 pass, three mutation RED failures, runtime restored exactly.
  Final 85 selected pass (67 real SQL), full 1889 pass / 805 opt-in skips;
  types/build/API/boundaries/lint/format checked. Existing handoff/review/evidence
  saved in plan.md. Owned tmpfs container removed after exact ownership/no-mount/
  no-OOM checks; matching inventory empty, working DB untouched.
- [ ] Previous first-email/M07c/provider/SMTP/device/dependency/rollout gates and
  remaining repository work remain open. Test-only local increment, no runtime
  authorization/payment policy, frontend, remote merge/push/deploy or server claim.

### M08 admin post-read repository — 9 October, daytime continuation

- [x] Resume from clean 9a0c0bd under the new human request; expired overnight
  heartbeat confirmed PAUSED, no replacement schedule or new deploy authority.
- [x] Extract filters/calendar/statistics behind unchanged db.ts facade and
  canonical shared post ordering. Existing SQL, signatures, counts, access and
  no-DB projections retained; executable AST/initializer comparison unchanged.
- [x] RED/GREEN and review: baseline 21 / five expected mutation failures; sixth
  candidate proves top-5 limit independently, nullable projections checked with
  existing session double. Exploratory month-delta probe removed because shared
  global statistics are not transactional snapshots; no month acceptance claim.
- [x] Final 100 selected pass (52 real SQL), full 1890 pass / 806 opt-in skips;
  types/build/API/boundaries/lint/format/docs checked. Owned tmpfs database removed
  after exact ownership/no-mount/no-OOM checks; matching inventory empty, working
  DB untouched. Handoff/review/evidence recorded in plan.md.
- [ ] Remaining M08/M06, first-email/M07c/provider/SMTP/device/dependency/rollout
  gates remain open. Local backend-only slice, no frontend/payment-policy change,
  remote merge/push/deploy, server acceptance or automatic continuation.

### M08 post-media read repository — 9 October, daytime continuation

- [x] Continue clean f8694a6 on the current feature branch. Move canonical batched
  hydration and single-post media read out of db.ts; connection/visibility owners,
  SQL/order/grouping/metadata/empty/error behavior and API remain unchanged.
- [x] Two new native detail/batch media cases; baseline 51 pass, six expected
  order/selector RED failures, one grouping-fallback RED failure. Runtime restored;
  both executable AST bodies unchanged. No injected SQL-error acceptance claim.
- [x] Final 102 selected pass (54 real SQL), full 1890 pass / 808 opt-in skips;
  types/build/API/boundaries/lint/format/docs checked. Exact owned tmpfs database
  removed after owner/no-mount/no-OOM checks; matching inventory empty, working DB
  untouched. Existing handoff/review/evidence saved in plan.md.
- [ ] Remaining M08/M06/first-email/M07c/provider/SMTP/device/dependency/rollout gates
  open. No frontend/payment-policy/upload/storage change, push/deploy, server
  acceptance or recurring continuation.

### Prodamus TEST successful return — 9 October, 13:33 MSK

- [x] User-approved single-line fix: successful TEST return /club?paid=1 starts
  existing bounded server-access checking; non-success return stays /club.
  URL hint never grants access. Frontend/signatures/settlement remain unchanged.
- [x] Native HTTP/SQL RED then GREEN; 100 focused pass (52 SQL), full 1890 pass /
  808 opt-in skips, types/build/API/boundaries/lint/docs checks pass. Exact owned
  disposable database/network removed; working DB not used as a test fixture.
- [x] Deploy only prior 6987883 runtime source plus this one line, not unrelated
  local refactors. Old bundle reproduces byte-for-byte; new artifact differs in
  one line. Only TEST container replaced, seven healthy, 15 HTTPS checks pass;
  fresh provider link observed with corrected return. Rollback/evidence in plan
  and operations docs. No payment, resend, cabinet change, branch merge or push.
- [ ] Card/GPB and SBP failures remain unconfirmed upstream issues; no new paid
  end-to-end acceptance, real money/autocharges or production approval. Old links
  retain their old return URL; do not repeat a payment merely to test the return.
  Existing dependency/rollout and unrelated backend gates remain open.

### M08 post-catalog read repository — 9 October, daytime continuation

- [x] Continue clean bd31aa0 on the current feature branch. Extract paginated
  feed/club and saved-ID reads behind unchanged db.ts signatures. Preserve SQL,
  filters/cursors/order/duplicate IDs/media/errors; services keep access decisions.
- [x] Two characterization cases, baseline 33; independent filter/ID-order
  mutations each produce the expected RED failure and are restored. Executable
  AST/helpers/columns and facade signatures unchanged except passing the client.
- [x] Final 137 selected pass (56 real SQL, 81 maintenance/transport doubles),
  full 1890 pass / 810 opt-in skips; types/build/API/boundaries/lint/format/docs
  checked. Exact owned tmpfs DB removed after ownership/no-mount/no-OOM checks,
  matching inventory empty, working DB untouched. Evidence/review in plan.md.
- [x] Prodamus diagnostic request sent by the user through the website chat;
  supplied screenshot shows Sent. Agent sent nothing/read no mailbox. No need
  to duplicate the request or require MAX login; provider diagnosis still open.
- [ ] Remaining M08/M06/identity/M07c/SMTP/device/dependency/rollout gates stay
  open. Local backend-only slice; no frontend, payment policy, new public search,
  remote merge/push/deploy, server acceptance or automatic continuation.

### M08 post detail / latest read repository — 9 October, continuation

- [x] Continue clean 3048108. Move single-post and latest-announcement reads to
  content/post-detail-repository.ts; preserve facade signatures/executable AST,
  fields/media/date ordering/absence/errors and existing service-owned access.
- [x] Two new native detail cases; baseline 35 content / 14 latest. Selector
  mutation fails two checks; wrong date ordering fails one. Both restored before
  extraction. Global latest run isolated on a fresh empty publication dataset.
- [x] Final 153 selected pass (72 real SQL, 81 doubles); full 1890 pass / 812
  opt-in skips. Types/build/API/boundaries/lint/format/docs/diff checked. Exact
  owned tmpfs DB removed after ownership/no-mount/no-OOM checks; inventory empty,
  working DB untouched. Evidence/review saved in plan.md and existing handoff.
- [ ] Remaining M08/M06/identity/M07c/provider/SMTP/device/dependency/rollout gates
  remain open. No frontend, auth/payment policy, remote merge/push/deploy, new
  payment or server acceptance. Await provider reply to the user's sent request.

### M08 legacy feed read repository — 9 October, continuation

- [x] Continue clean b708ff1. Move getPosts to the existing content catalog
  repository, preserving facade signature, executable AST, single client
  acquisition, projection/visibility/order/tag membership/media/errors.
- [x] Two native HTTP/MySQL characterizations; baseline 37 pass. Uncorrelated
  likes and substring-tag mutations each give one expected RED failure and are
  restored before extraction. No normalization or commentCount field added.
- [x] Final 141 selected pass (60 real SQL, 81 doubles); full 1890 pass / 814
  opt-in skips. Types, backend/web builds, unchanged API, boundaries, frontend
  lint, selected formatting/docs/diff checked; client regression 208 pass.
  Exact owned tmpfs DB removed after owner/no-mount/no-OOM checks; matching
  inventory empty, working DB untouched. Evidence and review in plan.md.
- [ ] Legacy list remains unpaginated; no query/performance/SQL-error acceptance
  change. Remaining M08/M06/identity/M07c/provider/SMTP/device/dependency/rollout
  gates stay open. No frontend edits, payment-policy changes, merge/push/deploy
  or new payment; no recurring continuation enabled.

### M08 full admin post catalog — 9 October, continuation

- [x] Continue clean 4b3a9ac. Move getAllPostsAdmin to the existing admin content
  repository; preserve executable AST/facade signature, one client, private rows,
  canonical sort/media/errors. Access stays at the unchanged native boundary.
- [x] Two new native HTTP/MySQL cases, baseline 22 pass; wrong date and neighbor
  media mutations each fail one check, restored before extraction.
- [x] Final 143 selected pass (62 real SQL, 81 doubles); full 1890 pass / 816
  opt-in skips. Types, both builds, API/boundaries, frontend lint, selected
  formatting/docs/diff checked; client regression 208 pass. Exact owned tmpfs
  DB removed after ownership/no-mount/no-OOM check; working DB untouched.
- [ ] No pagination/performance/auth/payment-policy change or new SQL-fault
  acceptance. Remaining M08/M06/identity/M07c/provider/SMTP/device/dependency/
  rollout gates open; no frontend edit, merge/push/deploy or new continuation.

### M08 personal post-reaction reads — 9 October, continuation

- [x] Continue clean c205581; group liked/saved-ID reads in existing
  content/post-reactions.ts with unchanged toggle transaction. Executable AST,
  facade signatures/client acquisition, actor predicates, duplicates, bookmark
  order and historical no-DB/error behavior preserved; body access stays separate.
- [x] Two new real HTTP/JWT/MySQL cases; two missing actor predicates and reverse
  bookmark order each fail one check, restored before extraction. Eight added
  transport-only cases cover empty/error/recovery without claiming real faults.
- [x] Selected 153 pass (64 real SQL, 89 doubles), full 1898 pass / 818 opt-in
  skips. Types, both builds, unchanged API/boundaries, frontend lint, selected
  formatting, docs/diff checks and client regression 208 pass. Self-review and
  exact owned tmpfs DB cleanup recorded in plan; working DB untouched.
- [ ] Existing unpaginated reads and historical no-DB empty results deliberately
  unchanged. Remaining M08/M06/identity/M07c/provider/SMTP/device/dependency/
  rollout gates open; no frontend edits, merge/push/deploy or new schedule.

### M08 full tag catalog — 9 October, continuation

- [x] Continue clean 9082ae1; move getAllTags to the existing catalog repository.
  Executable body/signature and one lazy client preserved; all categories and
  unused tags, original labels, ascending sortOrder, no-DB empty and SQL error
  behavior unchanged. No new layer/query/filter/normalization.
- [x] One native HTTP/MySQL characterization plus three transport cases;
  wrong order, missing seasons and swallowed error each fail one RED check.
  All temporary mutations restored; 157 selected pass (65 SQL, 92 doubles),
  full 1901 pass / 819 opt-in skips. Types, both builds, API/boundaries, lint,
  formatting, docs/diff and 208 client regressions checked. Exact owned tmpfs
  database removed, owner inventory empty, working DB untouched.
- [ ] Remaining M08/M06/identity/M07c/provider/SMTP/device/dependency/rollout
  gates open. Local-only; no frontend/auth/payment-policy/server changes,
  merge/push/deploy or new continuation. Provider card/SBP acceptance still open.

### Prodamus TEST return dialog — human-approved behavior, 9 October

- [x] Human-approved exact webpack cache cleared (618 MiB, rebuildable), Docker
  engine recovered after approved restart; disposable SQL tests possible.
  Host disk pressure returned during full transform run, not fully resolved.
- [x] Backend-only one-order TEST result implementation and self-review:
  95 selected pass, including 73 SQL; pending versus
  durable receipt, mail/setup/login status, tamper/expiry/refusal/no writes or
  session proven through RED/GREEN; existing quota preserved. Exact owned DB
  removed, working DB untouched. Full parallel run blocked by ENOSPC; unchanged
  serial retry 1911 pass / 840 skips. Types/backend+TEST builds/API/boundaries,
  lint/client regressions/docs/format/diff checked; local-only backend slice.
- [x] Add accessible return dialog and bounded cancellable check locally
  (10 October; see current evidence below). Success only
  after server proof; guest goes to email setup/login, signed-in member gets
  verified access; pending/error/old links never imply payment or sent mail.
- [x] Local frontend verification/self-review/commit completed 10 October;
  see fresh evidence below. The 9 October disk/build blocker is historical.
- [ ] New user's actual order/notification/mail/browser acceptance still unverified.
  No automatic deployment, edge/auth/schema/quotas change, external mail,
  resend or payment. Rollout and SMTP acceptance remain open.

### Staging publication review — human request, 9 October

- [x] Fetch staging; ae70522 is already an ancestor of 09868ff, 13 feature
  commits ahead and no incoming commits. Frontend 0b77270 already integrated
  by 7524987; preserve frontend source, no redundant merge or force push.
- [x] Review key frontend/backend contracts and regressions. Fresh types,
  lint/API/boundaries/docs, standard+TEST backend and frontend builds pass;
  serial Vitest 1911 pass / 840 opt-in skips, selected browser suites 168 pass.
  Missing expected browser recovered with installed executable override only.
- [x] Publish reviewed current feature plus this evidence to staging by normal
  fast-forward push. Remote SHA b52381e995590a51cbef1759c8e9b69bf765ebc7
  matches local HEAD; this checklist confirmation follows as docs only.
  Server deployment not requested or performed.
- [ ] Real SQL/provider/SMTP/device/dependency/rollout acceptance remains open.
  Docker inventory currently unresponsive; no working DB or container changes.
  Frontend return dialog and concrete email-binding scenario still pending.

### Frontend UI/navigation integration — explicit human request, 9 October

- [x] Review source eb0e01f / frontend fix 67c9002; fast-forward staging from
  160be04 without conflicts or loss of backend changes.
- [x] Trace and correct browser-test readiness/scroll/layout preconditions and
  obsolete paid URL expectation; production code and acceptance assertions
  preserved. Repeated affected suites pass; see plan for exact run accounting.
- [x] Fresh serial unit tests 1963 pass / 840 opt-in skips, types/lint/API/
  boundaries/builds/docs/format/whitespace pass. All 547 browser cases accounted
  for across runs: 544 successful, three real-API skips; no single-green-full-run
  claim. Provider/SQL/SMTP/physical-device acceptance not inferred from fixtures.
- [x] Refetch and publish integrated staging by normal push, verify remote SHA
  9662f6c (integrated code; publication evidence follows as docs only).
  No server deployment or payment configuration change authorized by this merge.

### Prodamus TEST account/access return UI — 10 October, human continuation

- [x] Inspect current staging c416b34 and the existing account, settlement and
      transactional email/result implementation. No duplicate backend registration:
      passwordless account row is created at checkout; only verified settlement
      grants access and queues the setup/access email. Account/session policy intact.
- [x] RED/GREEN sessionless result reader with strict response validation,
      omitted cookies, bounded cancellation/body reads, safe errors and rate-limit
      metadata. Existing session requests still include cookies by default.
- [x] Accessible TEST-only return dialog, six serial/30-second checks, guest
      setup/login and accurate pending/sent/unavailable mail states. Same-account
      members refresh canonical subscription; another account cannot claim access.
      No automatic legacy paid=1 claim in TEST; manual check/live behavior retained.
- [x] Self-review; 1996 unit pass / 840 opt-in skips, 11 browser cases repeated
      twice (22 pass), compiled TEST native regression, types/lint/API/boundaries,
      backend+TEST frontend builds. Ordinary frontend build/native and 24 existing
      club-payment browser regressions pass. Screenshots at 320/390/1440; wait
      for the real fade completion before measuring appearance. No style workaround.
- [x] Publish and deploy reviewed TEST return UI/result exposure on explicit
      human approval, 10 October. Remote code 595d4a0; seven dev services healthy.
      Initial 149f701 rollout rolled back when a real HTTP contract mismatch was
      found; stable return quota header fixed through RED/GREEN before redeploy.
      See plan and staging runbook for backups, exact route and rollback evidence.
- [ ] Actual new guest order, provider notification, SMTP delivery and user
      browser acceptance. Public browser check used an invalid proof only;
      no payment, email resend, cabinet change or working SQL test fixture.

### Admin completion — 10 October, human request

- [x] Fetch and inspect current frontend/admin changes and saved contract scope;
      0b77270/67c9002 already integrated, no incoming remote-only commits.
- [x] Distinguish unavailable DB from genuinely empty admin article/filtered/
      scheduled/statistics results through native HTTP RED/GREEN and role checks.
- [x] Types/backend build/lint/API/boundaries and self-review; 111 focused tests,
      full serial regression 2024 pass / 840 opt-in skips. No query/auth changes.
- [x] Native SQL regression on a newly owned disposable MySQL after Docker
      recovered: fresh publication suite 2949 pass / 0 fail / 30 external opt-in
      skips, 194 files. Working database never used as an acceptance fixture.
- [x] Browser RED/GREEN for statistics refetch failure with cached data: show
      an explicit error and allow recovery instead of presenting old numbers.
- [x] Recheck current editor/attachment/draft/moderation/season/member/email
      frontend scenarios: 145 selected browser cases pass. Repeated full unit run
      2024 pass / 840 opt-in skips; frontend build/types/lint pass. Review and
      screenshots confirm existing layout. See the current admin audit report.
- [x] Human confirmed first binding admin-only, for an account without email,
      with email confirmation, no account merge and rejection of occupied email.
- [x] Approve the detailed schema/concurrency plan in SPEC-email-binding.md:
      separate proofs, normalized uniqueness, existing-upsert collision guard.
- [x] Implement the identity-scoped writer prerequisite after four expected
      SQL-boundary RED failures, retaining the same-openId update contract.
- [x] Accept the writer on a newly owned disposable MySQL database, including
      cross-identity constraint rejection, rollback and multi-connection races.
      Five original SQL cases pass; four normalized-identity cases now protect
      different-connection races. Docker recovered without a restart.
- [x] Add normalized non-empty email uniqueness with a read-only data preflight;
      legacy duplicates/noncanonical/invalid email block rollout, never a repair.
      Verify on owned MySQL 8.4; working DB and existing migration-history gates
      unchanged. First binding and actual rollout remain disabled.
- [ ] Implement verified slices and connect the existing frontend form after
      this approval; real SQL/SMTP/rollout acceptance must not be inferred.
- [x] Internal request/proof slice: strict stable intent, current locked admin/
      legacy recipient eligibility, separate encrypted durable outbox and audit
      without account writes. Native RED/GREEN, replay, rollback and concurrency.
      No HTTP route, worker registration or enabled form; migration 0028 only on
      a newly owned disposable MySQL fixture.
- [x] Internal single-use confirmation: current locked recipient and proof checks,
      normalized-unique arbitration, expiry after SQL wait, atomic email-only
      write/audit and terminal PII scrub. 35 native tests; no session or HTTP route.
- [ ] Binding delivery/transport/lifecycle: lease/retry, explicit confirmation
      POST, automatic expiry scrub, 30-day retention and account-deletion cleanup.
      Then finalize HTTP schemas/inspection and connect the existing admin form.
- [ ] Joint provider/SMTP/device/admin acceptance and deployment remain separate;
      no staging push or server change in this local continuation.

### Explicit staging/dev update — 10 October 2026

- [x] Fresh remote/frontend review, clean fast-forward from ac7c471; normal
      staging push and exact code remote 2e3339c verified, no force/lost changes.
- [x] Fresh owned SQL/full checks + 13 browser cases; archived HEAD TEST build,
      offline amd64 release and isolated native runtime probes. Dependency gates
      remain open; no package upgrade or false payment/email acceptance claim.
- [x] Protected backup then code-only API/web/TEST deployment. Resolve stale
      edge DNS with config-preserving reload; include reload in saved rollback.
      Seven healthy services; counts/other containers/integration configs kept.
- [x] 13 public smoke, 8 result transport and real deployed guest Chromium pass.
      Invalid proof only, no purchase, provider notification replay or email.
- [x] Stop exact owned disposable SQL fixture; erased test data unrecoverable,
      working data untouched. Record runbook hashes/rollback/open gates.
- [ ] Binding exposure/schema/delivery/lifecycle and joint provider/SMTP/user
      acceptance remain pending. This publication does not enable that feature
      or fix unconfirmed Russian payment gateway errors.
