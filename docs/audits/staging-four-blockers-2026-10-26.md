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

## Выпуск

На момент локального коммита ещё не выполнен. Backup/импорт/реальный S3,
миграции и live VK описывать как завершённые только после проверок.
