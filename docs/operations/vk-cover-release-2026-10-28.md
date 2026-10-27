# VK-обложки и объединённый выпуск — 28 октября 2026

По разрешению владельца обновлён именно `https://daryadarcy.dev.reeskeen.ru`.
Перед push новых incoming-коммитов не было. Staging fast-forward
`d36e1b7 → e16bcd1b5039be58491447ee45bee38ea612961f`; сохранены frontend d36e1b7,
локальные backend-правки и generated API105. Ручных изменений компонентов и
дизайна фронта не потребовалось. Следующий коммит отчёта меняет только docs.

## Причина и исправление

У поста954/media30 не было poster/фотографий: браузер показывал заглушку,
а не пытался загрузить изображение. Подписанные адреса VK-картинок дополнительно
отвечали то200, то404/429. API в isolated-сети вообще не мог разрешить DNS VK.
Изменение User-Agent проблему не устранило; одного извлечения URL недостаточно.

Backend при сохранении VK-видео проверяет совпадение owner/id и получает
доступный thumbnail, с ограниченным fallback на первый кадр самого ролика.
Провайдерский JavaScript не исполняется, редиректы запрещены. Только принятые
GET-направления доступны через существующий gateway с проверкой upstream TLS;
общий интернет API не открыт, порты на хосте не опубликованы.

Полученная картинка проходит штатную безопасную подготовку public cover и
сохраняется как новая WebP-копия в `covers/vk-v1/<sourceHash>/<bytesHash>.webp`.
Файл неизменяемый: HEAD сверяет размер/MIME/хеши, PUT использует If-None-Match:*,
потеря ACK восстанавливается повторным HEAD. TTL год с immutable. Нет overwrite,
DELETE, bucket-policy/ACL изменений старых объектов или автоочистки.
Ручные обложки и private video asset bindings сохраняются.

Сетевые операции имеют общий срок5с,2workers/8ссылок/1МиБ metadata/4МиБ image;
декодирование дополнительно ограничено штатным preparePhoto. Отказ VK/S3
не превращает сохранение поста в ошибку и не сохраняет временный URL.
Фронт получает существующий `media[].posterUrl` после save/refetch;
мгновенный preview несохранённой ссылки не добавлен.

## Проверки и сохранность

- 165backend tests/10files прошли на отдельной MySQL, включая native HTTP/JWT,
  создание/редактирование/повтор, S3 ACK/integrity и ограничения proxy.
  120frontend logic tests/7files, root/frontend/E2E types, API105, boundaries830,
  lint, backend/TEST builds и production Next29routes прошли.
- Один прогон прервался на длительной паузе Mac; он не засчитан. Повтор выявил
  отключённый performance_schema в собственной fixture-БД; включение штатного
  сбора блокировок исправило окружение, после чего165tests прошли без skip.
- Native Linux: 26web checks, API candidate26/live47, compression9 и проверки
  edit revisions/ошибок. 37внешних HTTPS checks, SHA16JS/CSS совпал со сборкой;
  каталог22VK-карточек и четыре прежних запрета private,no-store сохранены.
- Свежий backup41таблицы/45ledger:602443B gzip/2454345B распаковано, SHA256
  `6d3bd8ab2a63e2783ae7d7613dcac3f5f738d614733214c518c2f2b0d15b7694`.
  Реальное восстановление в отдельный network-none MySQL подтвердило строки,
  схему, индексы и3admin credential digests; тестовая БД удалена. Рабочая БД
  не переключалась и не восстанавливалась, миграций/pending нет.
- После выпуска все41таблица совпали с baseline, кроме обычных auth activity.
  Затем отдельной параметризованной CAS-транзакцией изменён только
  `post_media.id=30,postId=954.posterUrl`: прежний NULL → проверенная копия.
  Сверены source identity и все21media-строка; остальные поля/строки и counts,
  схема/индексы/45ledger/3admin входа сохранены. Сам пост не пересохранялся,
  уведомлений, писем и платежей не было.
- Настоящий S3/isolated API дважды вернул один content-addressed URL: WebP
  309522B,1280×720, анонимный200/image-webp, TTL31536000 immutable; SHA байтов
  совпал с именем ключа. Исходный JPEG545781B и видео остались прежними.
- В браузере с существующей admin-сессией обложка видна **до Play**:
  img.complete=true/naturalWidth1280/naturalHeight720. Повторный reload также
  успешен, warn/error logs пусты. Это проверка обложки, не новая приёмка playback
  всех22роликов и не физического iPhone.

Native audit: high0/critical0, moderate1 —
[qs.stringify comma](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw).
Прямых вызовов qs.stringify/comma в приложении не найдено; зависимости этим
выпуском не обновлялись. Замечание сохранено отдельно, аудит не назван пустым.

## Образы и границы выпуска

| Сервис | Образ revision e16bcd1 |
| --- | --- |
| API | `sha256:2a5cb39d91f812963e404e161b4cf0a8198a9861d119c7f96d3d5b74ecc745f4` |
| TEST | `sha256:8f2a69782f0450cb30a9660bb4a6b36e9282a5e4b7f16cbdc769f816b20fc246` |
| Web | `sha256:ec5b14d2084e76a940e6c49c438bdf6d99fd4be47a024d5498fc8f5a1679bf32` |

Web BUILD_ID `U4vqA_qCSRRGI7ievmwaf`; фактические API/TEST bundle SHA совпали
с manifest. Образы собраны без установки пакетов/обновления баз; Linux SWC/
Next16.4.1/Sharp0.35.5 проверены. В settings изменены только image pins,
TEST bundle path и приватный VK preview gateway. У S3 gateway выполнен reload
конфигурации; контейнер/старый S3 TLS passthrough сохранены. Остальные сервисы
и все чужие контейнеры, БД, исходные файлы, backup и образы отката сохранены.
LIVE/guest recovery/strict/legacy-retirement flags не включались.

Закрытые артефакты: сервер
`/home/edem/apps/daryadarcy-staging/vk-covers-release-20261027-cd97c5df`,
Mac `.local-artifacts/vk-covers-release-20261027-cd97c5df` родительского workspace.
Backup/config/операторские материалы вне Git, родитель700/секретные файлы600.

Code-only rollback: после проверки отсутствия более позднего выпуска/config
drift запустить сохранённый `release.py rollback`. Он возвращает только прежние
API/TEST/web pins и gateway config, выполняет reload edge. **Не восстанавливать
рабочую БД поверх новых записей.** Привязку обложки и новую копию не удалять:
они совместимы с прежним контрактом. Откат на здоровом выпуске не запускался.

[Единый документ фронтендеру](../development/frontend-audit-handoff-2026-10-27.md).
