# M1a: карта границ доступа к медиа — 10 октября 2026

Статус: локальная инвентаризация кода и проверка исходящего S3-протокола.
**Не сертификат приватности рабочего bucket и не подтверждённая утечка его файлов.**
Рабочие объекты, секреты, кабинет и ACL/policy сервера не читались и не менялись.
Пока A6c3 ожидает решения о webmail navigation, это независимый безопасный пункт M1.

## Подтверждённая граница

[storage.ts](../../apps/backend/src/storage.ts) отправляет `PutObject` с
`ACL: public-read` для всех S3-загрузок, независимо от будущего типа публикации.
Возвращается прямой endpoint/bucket/key URL без срока/подписи/проверки подписки.
`storageGet` строит такой же URL без запроса к bucket; по текущему поиску вызовов
helper не используется production-потребителями. Основной путь — сохранённые
URL, возвращённые `storagePut`, а не вызов `storageGet` при каждом чтении.

[Четыре wire-проверки](../../tests/storage-public-boundary.test.ts) используют
настоящий AWS SDK и собственный loopback HTTP endpoint с синтетическими ключами.
Проверены исходящие PUT/ключ/ACL для фото, документов и club comment photos,
а также отсутствие storage-запроса при `storageGet`. Все четыре проходят.
Сервер fixture лишь принимает PUT: он не моделирует ACL, anonymous GET, Block
Public Access, Object Ownership, CDN или Timeweb. Успех этих тестов **не доказывает**
анонимную читаемость рабочего объекта. Производственный код не изменялся.

## Карта классификации перед M2

| Источник/ссылка | API-граница | Object key / хранение URL | Что проверять перед переносом |
| --- | --- | --- | --- |
| Фото публикации | `admin.uploadPhoto`; чтение club-поста ограничено сервисом | `feed/photos/<uuid>.webp`; `posts.photos`/richText | Сопоставить объект всем постам и статьям; один prefix не означает публичность |
| Аудио/документ/видео вложения | `admin.uploadMedia`; публикация/чтение зависит от поста | `feed/audio`, `feed/documents`, `feed/videos`; `post_media.url` | Club/draft/scheduled против feed/both; загрузка до ассоциации может оставлять orphan |
| Raw-видео | admin-only `/api/admin/upload-video` | `feed/reels/<uuid>_<safe-name>` | Определять доступ по всем ссылкам на объект, не по filename/prefix |
| Фото комментария | `club.uploadCommentPhoto` требует аккаунт; `club.comments` — clubMemberProcedure | `club/comments/<userId>/<uuid>.webp`; `post_comments.photos` | Подписка/блокировка на API не проверяется при прямом чтении object URL |
| Avatar | профиль своего аккаунта | `avatars/<userId>/<uuid>.webp`; `users.avatarUrl` | Не считать платным вложением автоматически; сохранить публичный дизайн |
| Статья/обложка | `articleById` скрывает sections без club-доступа, но отдаёт cover/title как teaser | `articles.coverUrl`, `articles.sections` | Обложка может быть намеренно публичной; вложения sections классифицировать отдельно |
| Каталог видео/YouTube service | published-каталог и отдельный сервис явно публичны | `videos`, `/api/yt/<id>`, thumbnail cache | Не превращать нынешние публичные видео в платные молча; это отдельный V1-контракт |
| Ранее сохранённые/внешние URL | post/article inputs сохраняют допустимые ссылки | SQL/JSON может ссылаться на чужой origin | Нельзя исправить чужой storage сменой ACL нашего bucket; нужен отдельный список |

Источники границ:
[uploads](../../apps/backend/src/content/content-upload.service.ts),
[photo encoding](../../apps/backend/src/media/photos.ts),
[admin router](../../apps/backend/src/admin/router.ts),
[club router](../../apps/backend/src/club/router.ts),
[content reads](../../apps/backend/src/content/content-read.service.ts),
[raw video](../../apps/backend/src/content/video-upload.controller.ts),
[profile](../../apps/backend/src/profile/profile.service.ts),
[public video](../../apps/backend/src/content/videos-router.ts),
[video service](../../apps/video-service/server.mjs).

## Открытая приёмка M1/M2

1. На собственном изолированном S3-совместимом хранилище проверить public/private
   объекты: guest/expired/blocked/paid через настоящее API и прямой GET/HEAD/range.
   Loopback wire выше не заменяет эту проверку.
2. Отдельной согласованной read-only процедурой получить карту рабочих объектов
   и всех SQL/JSON ссылок, ACL/policy и CDN. Не использовать имя папки как права.
   Shared public/private объект требует явного решения или копии, не смены ACL вслепую.
3. Выбрать проверенный private delivery путь: сервер с live access-check либо
   ограниченная подписанная ссылка. Срок ссылки и отзыв при блокировке — часть контракта.
4. Репетиция переноса, backup/rollback, старые сохранённые URL и browser cache;
   orphan/delete и публичные teaser/avatar остаются отдельными классами.

**M1 открыт**, M2 не начат. Изменение одного `public-read` на `private` сейчас
сломает все текущие direct URL и не исправит старые объекты, bucket/CDN policy
или внешние ссылки. Массовые ACL/URL/данные и смысл подписок не изменялись.
