# Daryadarcy Modular Monorepo

## Активная очередь по ТЗ и фронту — 10 октября 2026

Приоритет и критерии — в начале [плана](plan.md). Пользователь разрешил
продолжать работу по нему самостоятельно. Исторические пункты ниже сохраняются;
их старые статусы выкладки не отменяют свежий release 2e3339c/2210be5.

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
- [ ] S1: сезонный read/write/CAS и четыре даты; материалы заказчика.
- [ ] S2: mailto-заказ обоих материалов с реальной конфигурацией и устройствами;
      серверную форму не считать согласованной заменой этого пути.
- [ ] M1: проверить карту закрытых файлов и прямые public-read URL.
      M1a: локальная карта storage/потребителей; 4 real SDK/loopback wire pass.
      Подтверждён исходящий public-read, не реальная политика рабочего bucket.
      API/direct URL private/public acceptance и рабочая карта ссылок ещё открыты.
- [ ] M2: закрытая выдача/перенос только по проверенной карте, storage/API acceptance.
- [ ] V1: контракт/валидация VK source и public/club, совместимость прежних видео.
- [ ] V2: единый VK renderer для Видео/вложений, реальные ссылки и устройства.
- [ ] Q1: актуальные dependency findings и migration blockers; точечные исправления.
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
