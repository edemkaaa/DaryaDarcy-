# БД-кандидат: backend artifact и откат приложения

## RELEASE-U1 — обновление применено, приёмка загрузок открыта,20 октября 2026

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
