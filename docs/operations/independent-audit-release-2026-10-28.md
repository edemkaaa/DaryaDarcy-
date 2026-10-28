# Выпуск исправлений независимого аудита: 28 октября 2026

Статус: source **5efedbe** отправлен обычным fast-forward в staging и выпущен
на https://daryadarcy.dev.reeskeen.ru. Обновлены API, Prodamus TEST и web.
Fresh fetch перед push: incoming0, сохранён frontend d32c78f.

## Состав

- I-01: profileRevision/expectedRevision, CAS и защита поздних ACK; формы профиля
  и generated contract выпускаются вместе. Подготовленная0045 применена.
- B-02: legacy checkout5/15мин на аккаунт и30/15мин IP до service/SQL, batch
  учитывает каждую процедуру.429/Retry-After. Process-local, текущий один worker.
- I-02: единый MP3/M4A/WAV/OGG/Opus/WebM/FLAC allowlist; AAC в M4A,
  rawAAC/AIFF отвергаются до добавления вложения. Исходники не перекодируются.
- F-01/F-02: чужой guest journal не блокирует свою покупку и не раскрывает proof;
  окончание paid срока обновляет доступ в открытой вкладке.
- I-03: один public origin web/API/media, внутренний proxy сохранён.
- B-01 исключён владельцем: квоты/очистка аватаров не добавлялись.

TEST-оплата сохранена. Guest LIVE recovery и строгий режим не включались.
Серверные flags/секреты/SMTP/лимиты/параметры БД прежние. В web сохранены
TEST=true, NORMAL=true, VK=true, PRIVATE_LIBRARY=false; новый guest UI flag=false.
Дизайн, исходные медиа и S3/policy не менялись.

## Бэкап, миграция и сохранность

Свежий backup41таблица: 602674B gzip/2454693B SQL.
SHA256: `136d64873712605e748c2ca9cd0622e49a5f4b5abccc6ee3d1f1735dda67a3b5`.
Первые45ledger hash/created_at сверены с каноническими исходниками; pending
содержал только0045. Резервная копия восстановлена в отдельную, ранее
несуществовавшую БД daryadarcy_restore_audit_6dfd2930 в существующем MySQL.
До исполнения подтверждено отсутствие routines/triggers/events, единственные
CREATE DATABASE/USE переписаны только на собственное имя; пользовательские
строки не редактировались. Схема, индексы, строки и три admin credential digests
совпали. На копии применена0045 и проверено сохранение старых полей/входов.
Собственная БД удалена; приложение на неё не переключалось.

Затем в рабочей БД выполнена только additive0045: новая profileRevision int
NOT NULL DEFAULT0 и одна каноническая запись журнала. Advisory lock проверяется
CHECK constraint до DDL. Ledger46 hash/timestamps сверены полностью. Сравнение
прежней проекции всех41таблицы, индексов и admin digests прошло; из users
исключены только штатные auth timestamps и отдельно проверенный новый столбец.
Ни удаления пользователей/контента, ни смены паролей/sessionVersion не было.
Рабочая БД не восстанавливалась и не переключалась.

Локальный Docker не отвечал; его штатный разрешённый restart также завершился
таймаутом. Поэтому приёмка выполнена на отдельной одноразовой БД сервера без
нового MySQL-процесса, с проверкой RAM и безопасным удалением только этой копии.
Неопределённый локальный create fixture сохранён в закрытом cleanup-marker:
при восстановлении Docker проверить точное имя/label/network/tmpfs перед удалением.
Чужие образы/volumes/БД не удалялись; остальные серверные сервисы сохранены.

## Проверки

- Перед push повтор:78целевых unit tests, API105, backend/TEST builds.
  Ранее полный локальный срез:3611unit/1491SQL/63Chromium, профиль30повторно.
- Next production29routes собран с настройками действующего стенда;
  все15Prodamus TEST browser-сценариев прошли на синтетических ответах.
- Linux: native Web26проверок (Next16.4.1/SWC/Sharp0.35.5), SHA двух bundles;
  candidate API36 + compression9; live API51 + compression9.
- Проверены REST profileRevision без sessionVersion/passwordHash,400 без
  expectedRevision,409 на устаревшую версию и unchanged ACK пустого patch.
  Лимит5+1 проверен в отдельном candidate процессе неверным email: без заказов.
- Внешний HTTPS37:12страниц,16JS/CSS по SHA новой сборки, session/capabilities/
  health/launch,22VK-карточки с обложками и4прежних private no-store запрета.
  Это не новая приёмка playback22роликов или настоящей оплаты/почты/S3.
- В существующей браузерной сессии открылись профиль и админка:
  933поста/931опубликованный/2черновика; Клуб загрузил публикации, вход не потерян.
  Новые пользовательские данные не создавались.

Первая candidate-проверка была остановлена EACCES подключённого тестового файла;
после проверки code-only SHA ему даны права чтения внутри контейнера при
сохранённом700 родителя/600 env. Временная смена UID тоже была отклонена из-за
недоступности модулей; возвращён штатный непривилегированный node. Эти неуспешные
запуски не засчитаны, проверки/API-код не ослаблены. После исправления окружения
candidate/live прошли. Краткий разрыв SSH разобран по сохранённым markers:
сборка/репетиция завершились, повторный перенос данных не выполнялся.

## Образы и откат

Все три runtime images имеют revision `5efedbed1e1d93398ef1c2aa65b92f50a17be5cb`.
Web BUILD_ID `gyKES5vC9DeItpqmfp3PF`, SHA внешних16ресурсов совпал с manifest.
Сборка из прежних образов без сети/установки зависимостей; изменены только
API/TEST/web pins и путь TEST bundle. Resolved Compose полностью сверен.
Все остальные контейнеры и образы отката сохранены, сервисы healthy/OOMfalse/
restart0. Старые архивы и резервные копии не удалялись.

Code-only rollback: сохранённый release.py rollback после проверки отсутствия
более позднего config drift возвращает прежние три image pins. Новую колонку и
ledger0045 сохранять; **не восстанавливать БД поверх новых пользовательских записей**.
На здоровом выпуске rollback не запускался. Удалённый CI pipeline отдельно не подтверждён.

Закрытые артефакты: родительский .local-artifacts/audit-fixes-release-20261028-6dfd2930 и серверный
/home/edem/apps/daryadarcy-staging/audit-fixes-release-20261028-6dfd2930, directory700/config+backup600.
[Единый handoff](../development/frontend-audit-handoff-2026-10-27.md).
