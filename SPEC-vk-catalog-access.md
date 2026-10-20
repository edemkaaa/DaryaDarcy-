# AG8: VK-каталог и клубный доступ

## VK-перенос20 октября2026 — состав явно принят пользователем

После mixed release пользователь поручил доделать VK и подтвердил:
«Да:22 открытых VK, старые YouTube скрыть». Это разрешает только22 новых
canonical VK источника из предоставленного export и снятие публикации60
существующих YouTube rows, без удаления/переназначения старых ID и access.
Новые VK access=public. Рабочие schema/users/subscriptions/config и старые
S3 objects не менять. Фронтенду — документ, не ручные UI/design изменения.

До cutover: fresh backup/admin+schema guards и репетиция на own tmpfs
backend_test. Новые VK сначала unpublished, replay по existing upsert/sourceKey;
длительности — из предоставленного PDF/TXT. Затем одна SQL transaction
публикует22 и скрывает60; rollback меняет только эти publication flags.
Новые публичные copies19 предоставленных PNG допустимы только в отдельном
app-assets/vk-catalog-20261020-U52Zwx prefix, без overwrite/ACL/policy изменений.
Это native533–537x300–301 fallback, не большие исходники. Для3 остальных
thumbnailUrl=null, без чужой/придуманной обложки. Дизайн остаётся прежним.

Браузерная проверка настоящего vk.ru iframe снова остановлена site-safety gate.
Не обходить другим браузером/raw HTTP/CDP/CDN. Реальный playback остаётся
ручной внешней приёмкой, даже если22 API playback responses верны.

Перенос выполнен:22 public VK опубликованы,60 YouTube скрыты и сохранены.
33 live HTTPS checks приняты,19 new public copies прочитаны signed/anonymous
с совпадением SHA,3 thumbnailUrl=null. Fresh backup40 tables server/local0600;
schema42/admin credentials/session/config/прочие таблицы/runtime images прежние.
Нового build/deploy app code не было: используется текущий mixed backend.
21 октября по явному разрешению thumbnail flag=true включён при сборке и web
обновлён без ручных UI/source изменений. Настоящий browser/guest подтвердил22
карточки/19 loaded images/3 прежних fallback и opt-in на обеих страницах.
DB/admin/backend/S3 прежние; real VK playback по-прежнему не принят.
Остаток и точный handoff —
[документ фронтендеру](docs/development/frontend-video-fixes-2026-10-20.md).
Rollback/доказательства — [runbook](docs/operations/candidate-backend-image-rollback.md).

## Выпуск20 октября2026 — VK-only cutover отложен пользователем

После read-only проверки стенда (60 опубликованных YouTube,0 VK) пользователь
выбрал выпуск остальных правок без отключения YouTube до переноса VK.
Отменяется только действие cutover4c04d62; работа сохранена в истории Git.
Временно остаются смешанный каталог/playback, legacy list/getById, прежний
YouTube proxy/worker и валидированный admin import. Новые VK covers и opt-in
includeThumbnails сохраняются. Working rows/ID/access/flags не переписывать.
Переход к VK-only, импорт22 источников и подтверждение playback/качественных
обложек остаются отдельным согласованным шагом; не включать его при обновлении.

## Статус — Accepted for local backend implementation, 14 октября 2026

Пользователь явно принял контракт и разрешил локальную реализацию/проверки:
«Фронт и рабочую БД не трогай, реальные ссылки проверим отдельно».
Фронт, рабочая БД, старые ролики и настройки VK не изменяются. Worker меняется
только для принятого запрета anonymous club bypass и его loopback acceptance.

Основание: [сохранённый разбор ТЗ, 4.11](docs/audits/frontend-stage-one-scope-2026-10-03.md)
и [план фронтендера](apps/frontend/WORK_PLAN.md). VK требуется в разделе Видео и
во вложениях. Клубная карточка ограничивается внутри приложения; защита полученной
VK-ссылки от пересылки/скачивания исключена. Оригинал договора недоступен;
это сверка сохранённого разбора, а не новая проверка первоисточника.

## Проверенный исходный код до реализации

- videos.list/getById — public, repository возвращает все published строки.
- videos.youtubeId обязательный unique; videoUrl nullable; access/provider нет.
- admin.importVideos ориентирован на YouTube. VK нельзя записывать с выдуманным ID.
- Anonymous video worker использует публичный каталог как authority по youtubeId.
  Нельзя закрыть только экран или один detail endpoint и оставить этот обход.
- Вложения post_media наследуют доступ поста; этот путь не заменяет каталог.
  Новую policy постов/ролей/подписок здесь не добавляем.
- Наличие VK-плеера ранее проверено в staging; текущая локальная feature-ветка
  не содержит найденных VK-renderer исходников. Ветки автоматически не объединять.

## Принятое минимальное решение

Один существующий videos-каталог, без второго видеохранилища/платного хостинга.
Additive схема: access public|club (default public для старых записей), provider
youtube|vk (старые youtube), nullable youtubeId и отдельный vkEmbedUrl для VK.
Валидация взаимоисключающих источников на server boundary; никакого фиктивного
youtubeId, автоматического переноса/закрытия старых строк или массового импорта.
Миграция 0031 зарегистрирована после 0030; рабочая история/применение не проверены.

### Чтение

Добавлены additive процедуры; старые wire shapes публичных YouTube сохраняются:

```ts
videos.catalog.query({ limit?: number, cursor?: number, direction?: "forward" })
// strict input; limit 1..100, default 20; cursor positive safe integer
// deterministic id ordering; nextCursor: number|null
type VideoCard = {
  id: number; title: string; duration: string|null;
  access: "public"|"club"; canWatch: boolean;
}; // никаких playback URL, youtubeId, embed/hash или private cover URL
// output: { items: VideoCard[]; nextCursor: number|null }

videos.playback.query({ id: number }) // strict positive safe integer
type Playback =
  | { id: number; provider: "vk"; embedUrl: string }
  | { id: number; provider: "youtube"; youtubeId: string; videoUrl: string|null };
```

Совместимость 19 октября (VCAT-C1): текущий tRPC infinite-query клиент сам
добавляет `direction: "forward"`. Сервер принимает только этот необязательный
служебный параметр; отсутствие параметра сохраняет прежние вызовы. Обратная
пагинация не вводится: `backward`, другие значения и неизвестные поля дают
BAD_REQUEST. Начальная страница не передаёт cursor; null не заменяет его отсутствие.
Порядок, SQL, лимиты, output и проверки доступа не меняются. Текущий frontend
transport проверен без правок его файлов. Generated frontend contract пока
не синхронизирован: `check:api` требует regeneration, отложенную по прямому
запрету менять фронт. Это не разрешение на push/deploy или рабочие SQL/S3.

Только published карточки. Заголовок/длительность клубной карточки намеренно
публичны для метки «Для участниц клуба»; содержание и источник не раскрываются.
canWatch вычисляется сервером по существующему hasClubAccess, не по subscribed;
служебный доступ не превращается в платную подписку. Он информационный:
playback повторно проверяет актуальную сессию/блокировку/клубный доступ каждый раз.
Не доверять роли/access/canWatch от клиента и не кэшировать частный ответ публично.

Ошибка доступа к club: гость UNAUTHORIZED, вошедший без доступа FORBIDDEN;
blocked/revoked — существующая identity policy, без изменения кодов auth.
Неизвестный/unpublished id — NOT_FOUND; SQL/schema отказ — INTERNAL_SERVER_ERROR,
не публичный fallback. Повреждённый источник не отдаётся как другой provider.

Legacy videos.list/getById обязаны выдавать **только public** записи независимо
от feature flag: anonymous worker не должен получать club youtubeId даже из cache.
Прямые worker GET/HEAD/Range/thumb проверяются после снятия публикации/доступа.
Если источник ранее был public и скопирован, запрет внутри приложения не является DRM.

### Запись и формат VK

Новый admin.upsertVkVideo: strict { embedUrl, title, access, published, id? }.
Права existing admin, не расширять модератора. Explicit access/publication;
старый importVideos оставляет YouTube/public и не принимает новые привилегии молча.
Для повторного создания того же canonical VK source нужен unique guard и атомарный
возврат того же ID; если данные отличаются — CONFLICT, не молчаливое перетирание.
Редактирование существующего ID отдельно от создания; источник/выдача валидируются.

Разрешать только согласованный HTTPS embed origin/path/query, без HTML iframe,
credentials, redirects, arbitrary fetch/SSRF, short URLs и загрузки с VK сервером.
Не считать обычную share-ссылку готовым iframe источником. Точный allowlist и
canonical fingerprint фиксируются по реальным примерам заказчика и совместимому
parser фронтендера до реализации; неизвестные параметры не «исправлять» догадкой.
Уточнение для локального среза: проверен parser в origin/staging. Допустимы
https://vk.com, https://vk.ru, https://vkvideo.ru, path /video*ext.php;
oid — ненулевой signed decimal до 20 цифр, id — positive decimal до 20 цифр,
hash — 8..128 символов A-Z/a-z/0-9/*/-. Только single oid/id/hash/hd/autoplay,
hd 0..3 optional, autoplay 0/1 приводится к 0; fragment/лишние параметры запрещены.
Ссылка canonical сохраняет origin и hd; unique source key — SHA256([oid,id]),
не hash/настройки плеера. Тот же source с другой canonical ссылкой/данными — CONFLICT
при create; explicit id обозначает update. Возврат записи: {id:number}.
Реальные настройки/воспроизведение VK не заявляются проверенными.
Настройку приватности/встраивания и наполнение выполняет владелец VK.

## Локальные RED/GREEN срезы и границы

1. Схема/входы и native SQL: старые YouTube/public неизменны, VK без fake ID,
   malformed источник отвергнут, repeated create/rollback/CONFLICT проверены.
2. Catalog/playback native HTTP/JWT: public/club, гость/member/staff/expired/
   blocked/revoked, unpublished, отсутствие утечки источника в карточках.
3. Legacy API и настоящий worker loopback: club источник не читается через
   anonymous API/cache/GET/HEAD/Range/thumb; прежние public ролики доступны.
4. Handoff: additive types и acceptance передаются фронтендеру, без его правок.
   Default-off нового пути; включение только после совместимого клиента/schema.
   Rollback не запускает старый public-only неосведомлённый backend поверх club
   строк: предварительно изолировать новые строки/сохранить access-aware backend.

Не создавать/публиковать рабочие видео, не включать флаги и не менять старые ACL.
S3 не нужен для local API/worker acceptance; физическое воспроизведение VK требует
реальных embed-ссылок, разрешения владельца и отдельной внешней проверки.

## Результат локальной реализации

Реализованы admin.upsertVkVideo, videos.catalog/playback, default-off
VK_CATALOG_ENABLED, migration 0031 и legacy public-YouTube projection без новых
source fields. Повторы создания защищены unique vkSourceKey; иной payload —
CONFLICT. Текущий actor/session/role проверяется внутри SQL transaction. Рабочие
строки/флаги не менялись; миграция выполнена только на одноразовом backend_test.

RED наблюдался на отсутствующих routes, раскрытии новых полей в старом ответе,
legacy /api/yt, silent public import policy и worker normalization/access bypass.
Затем GREEN: 88 проверок
в 11 backend/test файлах, без skip; внутри них 21 VK SQL/HTTP сценарий и один
SQL API → отдельный Node worker → warm cache/GET/HEAD/Range/thumb сценарий.
Native Node worker suite — 42 pass, без skip (существующее MockTimers warning).
Синтетические bytes/URLs и контролируемый downloader double не доказывают реальное
VK-воспроизведение. Миграция отдельно проверена на старой структуре с сохранением
YouTube строки, её прежних полей и public defaults. Не репетиция working history.

TypeScript/backend build/boundaries успешны. check:api остаётся stale: frontend
generated types не переписывались. Offline migration preflight: только старые
untracked 0017–0019, databaseChecked=false/releaseApproval=false; 0031 зарегистрирован.
Self-review: wire compatibility, transaction/unique guard, auth/privacy,
bounded pagination и отсутствие внешнего VK fetch. Новых dependencies/CI нет.

### Обязательные условия выпуска

- Совместимый frontend, реальные VK embed/настройки/устройства проверяются отдельно.
- AG5 history/preflight/backup/rollback перед working migration; schema → backend
  → compatible client/worker → flag. Никакого rollback старого public-only API
  поверх club строк или снятия фильтров при отключении нового флага.
- Проверить **реальный** edge route. teamassist/edge.video.conf направляет
  /api/yt и /media/yt-thumb в проверенный worker. Старый nginx-daryadarcy.conf
  напрямую проксирует yt-thumb в i.ytimg.com с public cache, не проверяя каталог:
  этот путь не сертифицирован как закрытый и не должен обслуживать mixed catalog.
  Рабочий nginx не прочитан/не изменён, local шаблоны не выкладывались.
- Не обещать защиту полученной VK/YouTube-ссылки вне приложения. Старые public
  материалы не переводить в club автоматически. Реальных ссылок/платежей/почты нет.

Проверки (из корня repo, SQL только после проверки принадлежности своего стенда):

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:docs
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm exec prettier --check SPEC-vk-catalog-access.md
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm exec tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm --filter @daryadarcy/backend build
PATH=/opt/homebrew/opt/node@22/bin:$PATH BACKEND_TEST_DATABASE_URL=mysql://root@127.0.0.1:33380/backend_test pnpm exec vitest run tests/vk-catalog.mysql.test.ts tests/vk-worker-boundary.mysql.test.ts tests/video-publication.mysql.test.ts --maxWorkers=1
PATH=/opt/homebrew/opt/node@22/bin:$PATH node --test --test-reporter=spec apps/video-service/test/*.test.mjs
git diff --check
```

Код: owning content videos router/repository/vk-catalog,
packages/database schema и отдельная additive migration; tests в корневом tests/,
worker acceptance в apps/video-service/test/. Vitest/native MySQL и node:test
используют existing conventions, без новых dependencies/CI/фронтовых тестов.
Отсутствие BACKEND_TEST_DATABASE_URL означает skip, не acceptance. Стиль — existing TypeScript,
Zod strict на wire boundary, явный discriminated Playback union выше.

Mixed public/club каталог, additive reads/admin запись, nullable YouTube ID,
public title/duration и worker guards приняты к локальной реализации. Реальные
embed примеры и их public/club размещение нужны только для отдельной внешней
приёмки. Это не разрешение на frontend/working migration/включение.
