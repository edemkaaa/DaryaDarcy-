# AG8: VK-каталог и клубный доступ

## Статус — Proposed, 14 октября 2026

Поручение «Давай делаем да все» продолжает подготовку минимального серверного
контракта. Конкретные API/schema ниже предложены для принятия, не включены в код.
Фронт, рабочая БД, старые ролики, worker и настройки VK не изменяются.

Основание: [сохранённый разбор ТЗ, 4.11](docs/audits/frontend-stage-one-scope-2026-10-03.md)
и [план фронтендера](apps/frontend/WORK_PLAN.md). VK требуется в разделе Видео и
во вложениях. Клубная карточка ограничивается внутри приложения; защита полученной
VK-ссылки от пересылки/скачивания исключена. Оригинал договора недоступен;
это сверка сохранённого разбора, а не новая проверка первоисточника.

## Проверенный текущий код

- videos.list/getById — public, repository возвращает все published строки.
- videos.youtubeId обязательный unique; videoUrl nullable; access/provider нет.
- admin.importVideos ориентирован на YouTube. VK нельзя записывать с выдуманным ID.
- Anonymous video worker использует публичный каталог как authority по youtubeId.
  Нельзя закрыть только экран или один detail endpoint и оставить этот обход.
- Вложения post_media наследуют доступ поста; этот путь не заменяет каталог.
  Новую policy постов/ролей/подписок здесь не добавляем.
- Наличие VK-плеера ранее проверено в staging; текущая локальная feature-ветка
  не содержит найденных VK-renderer исходников. Ветки автоматически не объединять.

## Минимальное предлагаемое решение

Один существующий videos-каталог, без второго видеохранилища/платного хостинга.
Additive схема: access public|club (default public для старых записей), provider
youtube|vk (старые youtube), nullable youtubeId и отдельный vkEmbedUrl для VK.
Валидация взаимоисключающих источников на server boundary; никакого фиктивного
youtubeId, автоматического переноса/закрытия старых строк или массового импорта.
Номер миграции выбрать по актуальному journal после принятия; SQL сейчас не создаётся.

### Чтение

Предлагаются additive процедуры; старые wire shapes публичных YouTube сохраняются:

```ts
videos.catalog.query({ limit?: number, cursor?: number })
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
Настройку приватности/встраивания и наполнение выполняет владелец VK.

## Реализация после принятия — локальные RED/GREEN срезы

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

## Необходимое решение

Проверки подготовки (из корня repo):

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:docs
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm exec prettier --check SPEC-vk-catalog-access.md
git diff --check
```

Будущий код: owning content videos router/repository/read/write services,
packages/database schema и отдельная additive migration; tests в корневом tests/,
worker acceptance в apps/video-service/test/. Vitest/native MySQL и node:test
используют existing conventions, без новых dependencies/CI/фронтовых тестов.
Exact focused команды и имена новых suites записать при принятом первом срезе;
не выдавать ещё несуществующий runtime test за pass. Стиль — existing TypeScript,
Zod strict на wire boundary, явный discriminated Playback union выше.

Принять mixed public/club каталог, описанные additive reads и admin запись,
nullable YouTube ID вместо фиктивных значений, публичные title/duration карточек
и обязательное закрытие legacy worker обхода. Дать 1–2 реальных embed примера
и указать, какие из них клубные. Это не разрешение на фронт/working migration.

Проверка этой подготовки: source/spec review и docs/diff, не runtime GREEN.
