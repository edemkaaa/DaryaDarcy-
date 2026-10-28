# Выпуск SQL test isolation — 28 октября 2026

Статус: source **5cfb8d9** отправлен в staging и выпущен на
https://daryadarcy.dev.reeskeen.ru. Обновлены только API и Prodamus TEST.
Web-контейнер прежний: e16bcd1, frontend d36e1b7. БД не переключалась,
новых миграций и изменений настроек нет.

## Состав и локальная проверка

Перед push выполнен fresh fetch: новых incoming-коммитов нет. Отправлены
5a8d21f (отказ URI query/fragment в local-only maintenance/test guards) и
5cfb8d9 (unit/mysql Vitest projects, безопасный CI service loopback, тесты и
актуализированный snapshot уже существующих guest-процедур).
Frontend, бизнес-контракты API и зависимости не менялись.

Полный локальный SQL-прогон:1485passed/299skipped, unit:3568passed/77skipped.
Mixed-набор без ручного serial CLI-флага:186passed/5skipped; прежних13
конфликтов SQL fault fixtures нет. Пропуски не выдаются за приёмку опциональных
сценариев. Перед выпуском повторно прошли31целевая проверка, API105,
backend/TEST builds и документация; типы/границы проверены в локальном срезе.

GitLab API с имеющимися Git credentials ответил403. Наличие/результат настоящего
удалённого pipeline **не подтверждены**; локальный прогон его не заменяет.
Новый CI-код находится в staging, повторно реализовывать изоляцию не нужно.

## Сохранность и переключение

Свежий backup:602673B gzip,2454693B SQL,41таблица.
SHA256: `bbe76b75a94323ae23cfab8e381d9fad01abe16b14e895b8ec8c88df3803fc7f`.
Журнал45миграций сверен по hash/created_at с текущими исходниками; pending=[];
DDL не применялся.

Копия восстановлена в своей MySQL8.4 с network=none, без приложения/worker.
Совпали все строки, схема, индексы, ledger и credential digest трёх админов.
Свой tmpfs-контейнер удалён с проверкой ID/owner/network/mounts;
OOM=false/restart0. Чужие контейнеры/volumes/образы не удалялись.

Два небольших образа собраны на сервере из прежних образов без сети и установки
зависимостей. SHA обоих bundles проверен настоящим Linux Node внутри образов.
Resolved Compose до/после совпадает, кроме API/TEST image pins и пути TEST bundle.
DATABASE_URL, JWT secret, SMTP, flags и лимиты сохранены. Дополнительная проверка
остановилась на повторной записи уже созданного служебного new-config.json;
заменена на проверку равенства существующего файла до переключения приложения.

| Сервис | Выпущенный image ID |
| --- | --- |
| API | `sha256:f235d1b96308b229e59bf7722b1277e0e0ace9d09cfededebcee6a09862d24e5` |
| Prodamus TEST | `sha256:72522e13bf03f06e3efabfed18df25f58946c419ad10f8cbb5b8bfdfb71b1f81` |

После переключения сверены все41таблица, схема/индексы,45ledger и три admin
credential digests. Из сравнения users исключены только штатные timestamps
updatedAt/lastSignedIn. Остальные контейнеры, web и rollback images сохранены.
S3, исходные файлы и доступ к старым URL этим выпуском не менялись.

## Проверки на стенде

- До переключения:26candidate API checks и9compression checks.
- После:47live API checks и9compression checks. Проверены guest/admin доступ,
  paginated admin/feed/club/comments/saved, ревизии/409, валидация/отказы,
  каталог22VK и сохранение строгого режима OFF.
- Внешний HTTPS:37проверок, включая загрузку12страниц/manifest,16статических
  JS/CSS по SHA прежнего web build, capabilities/health/guest session/season,
  22открытые VK-карточки с thumbnailUrl и четыре прежних защищённых пути404/no-store.
  Воспроизведение всех VK-роликов этим прогоном не проверялось.

Писем, платежей, новых аккаунтов, публикаций и S3-записей эти проверки не создают.
LIVE/guest recovery/strict/retirement/автоочистка не включались.

Закрытые backup/config/операторские доказательства — в каталоге
`ci-sql-release-20261028-526f718b` родительского `.local-artifacts` и
`/home/edem/apps/daryadarcy-staging` на сервере. Каталог700, секретные файлы600.
Code-only rollback: после проверки отсутствия более позднего config drift
сохранённый `release.py rollback` возвращает прежние API/TEST pins, не БД.
**Не восстанавливать рабочую БД поверх новых записей.** Откат здорового выпуска
не запускался.

[Единый handoff](../development/frontend-audit-handoff-2026-10-27.md).
