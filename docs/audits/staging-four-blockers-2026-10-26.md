# Четыре блокера запуска — 26 октября 2026

## Границы

Выпуск staging, Prodamus, платные иллюстрации/файлы рецептов и Петербурга, 22 VK.
БД, админские входы, оригиналы и образы отката сохраняются. Новых функций нет.

## Локально проверено

- VK backend уже допускает export без hash; frontend приведён к тому же
  контракту. Пустой/неправильный/повторный hash отклоняется, autoplay=0.
- Reload перекрывал верхний правый угол iframe. Проверен настоящий компонент
  с собственным HTML-плеером: области до исправления пересекались, после
  reload ниже iframe; внутреннее закрытие рекомендаций работает. Это проверка
  размещения/событий, а не запуска настоящего VK.
- 220 иллюстраций из source-map получают URL исключительно из private bindings.
  Нет public fallback; owner в query key; смена identity отменяет/очищает запросы.
- Manifest: 1635 exact URL, включая старые форматы/производные и 220 hashed build
  paths. Это число адресов, не новых файлов. Все проверены через production Next
  HTTP: 404/private,no-store. Encoded segments и optimizer проверены; cover 200.
- Найдены два исторических Yandex PDF. Рецепты 128115880 B/30 страниц: пять
  частей <32 МиБ без re-encoding. Compressed image streams идентичны; 10 сравнений
  first/last raster exact. Петербург 8858859 B/12 страниц. Оригиналы вне Git.
- Tmpfs MySQL: 220 реальных WebP (4 cleaned lossless) + 6 PDF, SDK/локальный
  S3-wire; 226 PUT, replay без дублей, member SHA256 exact, guest/outsider denied;
  после expiry 220 старых member URL denied. Это не приёмка Timeweb ACL.
  Свой контейнер удалён, чужие сохранены.
- 3268 unit passed/1733 skipped; root/frontend types, lint, API contract,
  boundaries, API/TEST/web build passed. Полный browser suite не запускался;
  локальные browser actions выполнялись Cua. Новый opt-in CI case не объявлен passed.

## Внешние условия

- Владелец подтвердил отсутствие боевых настроек Prodamus. Нужны активный
  payform кабинета Дарьи, рабочий secret, ID тарифа 790 ₽/месяц, recurring
  secret/возможность отмены, webhook/result URLs по инструкции проекта.
  Секреты в закрытом файле вне Git. TEST и отключённый NORMAL не меняются.
- После private API владелец Yandex должен отозвать старые публичные ссылки
  рецептов/гида; сервер не имеет доступа управлять этими shares.
- Production audit: 3 Next advisories, 16.3.8; patched >=16.4.1. SVG optimizer
  выключен, cacheComponents=false, Server Actions отсутствуют. Компенсации
  не означают чистый audit; framework upgrade не смешан с переносом материалов.

## Выпуск — завершён 26 октября, 18:35 МСК

Код `ff2c2295a505b9f4b9f38ab2a54eaca7c77345ae` отправлен в staging и выложен.
Три сервиса (API/web/restricted TEST) healthy, restart=0/OOM=false. Фактические
байты обоих backend bundles и web BUILD_ID сверены с manifest. TEST bind mount
переведён на новый versioned bundle; старые bundles и три rollback image сохранены.
Native runtime: Nodemailer 10.1.4, body-parser 1.20.9/2.4.0, nested qs 6.16.1,
Multer 2.5.0; Sharp 0.35.5 без замены native binaries. Лимиты/флаги не менялись.

- Backup 41 таблицы: 488072 B gzip; SHA256
  `578d97e207e3045de9e1f1c47ed3b58646f0c2af6ffe968e343f1a2ab1eea281`.
  Gzip/число таблиц/SHA проверены на сервере и Mac. Закрытые копии вне Git.
- Проверены все 44 миграции и отсутствие pending; DDL/ledger не изменялись.
- 13 idempotent операций импорта: +226 private objects/файлов и bindings
  (220 WebP/5 частей рецептов/1 Петербург). Все 226 GET администратору дают
  точные SHA; все 226 гостевых API и anonymous S3 HEAD — отказ. ACL/policy
  существующего закрытого префикса проверяет оператор; старые объекты не менялись.
- Перед выпуском и после него: по 2 синтетических user accounts, 13 representative
  файлов (каждая эстетика и каждый PDF); member exact SHA, outsider denied,
  после expiry прежние 13 URL denied. В обоих прогонах только свои fixtures
  удалены; без Prodamus/outbox/писем. Синтетические платежи не были реальными.
- Проверки всех существовавших строк (кроме activity timestamps) и схемы совпали;
  7 users/3 admins, 933 posts, 2 articles, 82 videos сохранены. Сверен digest
  id/openId/email/passwordHash/role/sessionVersion/blockedAt всех 3 admins.
  Дополнения ровно в library_file_bindings(+226), library_file_migrations(+13),
  private_content_files(+226); прежние строки этих таблиц тоже совпали.
- Native candidate API 13 checks, live API 15; candidate web 11. Публичный HTTPS
  smoke 6 экранов — 200; representative old/raw/hashed/optimizer paid paths —
  404/no-store, public cover — 200/immutable. Guest recipes/peterburg list — 404.
- Cua на опубликованном сайте: admin session сохранилась; recipes dialog показывает
  5 PDF по порядку страниц, Петербург — PDF. Гид получил все 7 private namespaces,
  DOM содержит 104 carousel images через private API/0 public paid sources;
  3 видимых фото загружены. Это не утверждение, что все 220 одновременно в DOM.
  Бесплатные тест/Лошадка/стилизации/обложки не переводились в paid.
- Каталог API: 22 открытых VK, canWatch=true и обложка у каждого. Запуск всех 22
  НЕ принят: до выкладки в IAB у 62/65 наблюдалась ошибка VK, у 61 — controls;
  это не доказательство звука/перемотки/полного экрана. Прямое сравнение на VK
  запретила site-safety policy браузера (не запрос подтверждения); обходов нет.
  Исправления hash/геометрии проверены локально, источник ff2c229 выложен;
  физический Safari/iPhone и причина ошибки провайдера остаются отдельной приёмкой.
- Только наши дубли временных архивов удалены: сервер 165236646 B, Mac вместе
  с локальным Next cache 441232419 B. Backup, оригинальные PDF, source copies,
  образы, БД, runtime image cache сохранены. Свои локальные процессы остановлены.

Оператор/receipt: `/home/edem/apps/daryadarcy-staging/release-library-20261026.wk7n26`.
Временный operator.env удалён. На Mac `.local-artifacts/four-blockers-20261026`
вне Git: receipt/permissions-after/HTTP/browser/PDF QA и закрытая backup copy.
Следующий docs-only commit не требует новой выкладки этих же байтов.

## Что требуется от владельца

1. Подготовить live Prodamus: активный `PRODAMUS_PAYFORM_URL`, `PRODAMUS_SECRET`,
   `PRODAMUS_SUBSCRIPTION_ID`, `PRODAMUS_SUBSCRIPTION_SECRET`; тариф 790 ₽/месяц
   с автопродлением (`CLUB_PRICE=790`). Webhook `/api/prodamus/webhook`, подпись,
   success/return и recurring cancellation сверить с кабинетом и существующим
   серверным контрактом до включения. После активации отдельно принимаются
   реальная первая оплата/выдача/письмо/повтор webhook/продление/отмена.
   Сейчас NORMAL disabled/TEST сохранён. Секреты только закрытым файлом вне Git.
2. После открытия новых PDF отозвать только старые публичные Yandex shares:
   [рецепты](https://disk.yandex.ru/i/nUoIS8gQ5VkClA),
   [Петербург](https://disk.yandex.ru/d/BM0uzv2cWZeM0Q).
   Бесплатную Лошадку и стилизации не закрывать. Сервер не управляет этими shares;
   новые приватные копии уже проверены. Скачанное ранее отозвать невозможно.
3. Для VK повторить физическую приёмку, в первую очередь `/video/62` и `/video/65`:
   запуск, звук, seek, fullscreen. Не считать HTTP200/oEmbed/iframe load доказательством
   воспроизведения. Если ошибка есть и в обычном Safari, нужен экспорт/проверка
   доступности именно этих видео у владельца VK; источники не подменялись.

Полный договор этим выпуском не объявляется закрытым: live recurring, внешний
Yandex revoke, полная VK/device приёмка и ранее отложенные большие загрузки/пилот
не подменяются локальными тестами. Framework audit из раздела выше также открыт.
