# Фронтенд: файлы и блоки

Справочник извлечён из путей, комментариев и объявлений. Он не подтверждает ручной разбор каждого блока или готовность выпуска.

[Общая карта](index.md)

## [apps/frontend/.env.example](../../../apps/frontend/.env.example)

Шаблон настроек без рабочих секретов. Значения примеров не доказывают готовность внешних интеграций.

## [apps/frontend/AGENTS.md](../../../apps/frontend/AGENTS.md)

AGENTS.md. Инструкция или навигация по проекту.

## [apps/frontend/CLAUDE.md](../../../apps/frontend/CLAUDE.md)

CLAUDE.md. Инструкция или навигация по проекту.

## [apps/frontend/eslint.config.mjs](../../../apps/frontend/eslint.config.mjs)

Модуль eslint.config.mjs; объявления и смысловые границы перечислены ниже.

## [apps/frontend/image-variants.json](../../../apps/frontend/image-variants.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [apps/frontend/next.config.d.mts](../../../apps/frontend/next.config.d.mts)

Модуль next.config.d.mts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `config` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/next.config.mjs](../../../apps/frontend/next.config.mjs)

Модуль next.config.mjs; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `target` | 1 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/package.json](../../../apps/frontend/package.json)

Зависимости и команды соответствующего workspace; источник допустимых способов запуска.

## [apps/frontend/playwright.acceptance.config.ts](../../../apps/frontend/playwright.acceptance.config.ts)

Проверяем выбранные сценарии в мобильных профилях Chromium/WebKit; эмуляция не подтверждает работу физического iPhone или установленной PWA.

## [apps/frontend/playwright.cache-audit.config.ts](../../../apps/frontend/playwright.cache-audit.config.ts)

Две локальные точки запуска разделяют Next и wire-прокси аудита; запрет внешнего DNS не позволяет проверке незаметно скачать настоящие медиа.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `root` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `buildRoot` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/playwright.catalog.config.ts](../../../apps/frontend/playwright.catalog.config.ts)

Тестовые ожидания каталога должны совпадать со сборочными VK/thumbnail-флагами; конфигурация сама frontend не пересобирает.

## [apps/frontend/playwright.config.ts](../../../apps/frontend/playwright.config.ts)

Базовая браузерная проверка использует один worker и уже собранный обычный frontend; каталог и платежные профили имеют отдельные конфигурации.

## [apps/frontend/playwright.guest-checkout.config.ts](../../../apps/frontend/playwright.guest-checkout.config.ts)

Выбираем только guest/NORMAL recovery и отключаем TEST-ожидания; нужны соответствующие флаги уже собранного клиента.

## [apps/frontend/playwright.music.config.ts](../../../apps/frontend/playwright.music.config.ts)

От базовой мобильной приёмки оставляем только переключение фоновой музыки и отдельные артефакты.

## [apps/frontend/playwright.prodamus-test.config.ts](../../../apps/frontend/playwright.prodamus-test.config.ts)

Тестовые ожидания соответствуют Prodamus TEST; recovery-ожидания отключены, чтобы сценарий не подменился LIVE-покупкой.

## [apps/frontend/playwright.real-checkout.config.ts](../../../apps/frontend/playwright.real-checkout.config.ts)

Адрес берётся из специально подготовленного checkout fixture; собственный webServer не запускаем и прекращаем прогон после первого отказа.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `file` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixture` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/playwright.real-editors.config.ts](../../../apps/frontend/playwright.real-editors.config.ts)

Изолированный runner передаёт адрес настоящего временного API/frontend через fixture; конфигурация не использует рабочий стенд по умолчанию.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `file` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixture` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/playwright.real-recovery.config.ts](../../../apps/frontend/playwright.real-recovery.config.ts)

Проверки восстановления работают только с явно подготовленной временной средой; результат и trace отделены от обычного UI-прогона.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `file` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `fixture` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/private-library-assets.json](../../../apps/frontend/private-library-assets.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [apps/frontend/README.md](../../../apps/frontend/README.md)

Фронтенд Daryadarcy. Инструкция или навигация по проекту.

## [apps/frontend/src/app/(application)/(main)/club/page.tsx](../../../apps/frontend/src/app/(application)/(main)/club/page.tsx)

Вход маршрута /club передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 8 | Отдаём экран Клуба внутри Suspense: чтение параметров возврата не должно блокировать всю оболочку приложения. |

## [apps/frontend/src/app/(application)/(main)/feed/page.tsx](../../../apps/frontend/src/app/(application)/(main)/feed/page.tsx)

Вход маршрута /feed передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Подключаем экран ленты под метаданными маршрута; фильтры и страницы данных принадлежат feature-компоненту. |

## [apps/frontend/src/app/(application)/(main)/interactive/page.tsx](../../../apps/frontend/src/app/(application)/(main)/interactive/page.tsx)

Вход маршрута /interactive передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Открываем обзор интерактива; он сам выбирает переход к новому тесту или сохранённому результату. |

## [apps/frontend/src/app/(application)/(main)/layout.tsx](../../../apps/frontend/src/app/(application)/(main)/layout.tsx)

Оболочка этой группы маршрутов задаёт общие провайдеры и навигацию, не меняя публичные URL вложенных страниц.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Layout` | 4 | Оставляем общий main-сегмент прозрачным: состояние вкладок удерживается вышестоящим TabShell. |

## [apps/frontend/src/app/(application)/(main)/library/page.tsx](../../../apps/frontend/src/app/(application)/(main)/library/page.tsx)

Вход маршрута /library передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Подключаем витрину Библиотеки; чтение конкретных защищённых материалов остаётся внутри её сценариев. |

## [apps/frontend/src/app/(application)/(main)/loading.tsx](../../../apps/frontend/src/app/(application)/(main)/loading.tsx)

Ожидание этого сегмента использует общую заглушку, пока Next готовит вложенный маршрут.

## [apps/frontend/src/app/(application)/(main)/page.tsx](../../../apps/frontend/src/app/(application)/(main)/page.tsx)

Вход маршрута / передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `revalidate` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Передаём серверную дату первого кадра главной; после гидратации экран сам уточняет календарное состояние. |

## [apps/frontend/src/app/(application)/(main)/profile/page.tsx](../../../apps/frontend/src/app/(application)/(main)/profile/page.tsx)

Вход маршрута /profile передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 9 | Подключаем личный профиль без поисковой индексации; эта обёртка не выдаёт права на приватные данные. |

## [apps/frontend/src/app/(application)/(main)/shop/\[id\]/page.tsx](../../../apps/frontend/src/app/(application)/(main)/shop/%5Bid%5D/page.tsx)

Вход маршрута /shop/[id] передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Props` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `generateMetadata` | 10 | Метаданные берём из того же локального каталога, что проверяет Page, не выполняя отдельный запрос товара. |
| `Page` | 19 | Ждём параметры Next и отклоняем отсутствующий товар до клиентского рендера; каталог здесь тот же, что у витрины. |

## [apps/frontend/src/app/(application)/(main)/shop/page.tsx](../../../apps/frontend/src/app/(application)/(main)/shop/page.tsx)

Вход маршрута /shop передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Показываем статическую витрину; оформление заказа делегируется карточке выбранного товара. |

## [apps/frontend/src/app/(application)/(main)/videos/page.tsx](../../../apps/frontend/src/app/(application)/(main)/videos/page.tsx)

Вход маршрута /videos передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Подключаем список видео; новый или совместимый каталог выбирается feature-компонентом по настройке сборки. |

## [apps/frontend/src/app/(application)/admin/page.tsx](../../../apps/frontend/src/app/(application)/admin/page.tsx)

Вход маршрута /admin передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 9 | Подключаем административный экран без индексации; проверка роли выполняется его контекстом и серверным API. |

## [apps/frontend/src/app/(application)/error.tsx](../../../apps/frontend/src/app/(application)/error.tsx)

Модуль error.tsx; объявления и смысловые границы перечислены ниже.

## [apps/frontend/src/app/(application)/layout.tsx](../../../apps/frontend/src/app/(application)/layout.tsx)

Оболочка этой группы маршрутов задаёт общие провайдеры и навигацию, не меняя публичные URL вложенных страниц.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ApplicationLayout` | 7 | Общие провайдеры и фоновые эффекты включаем только для application-группы; установка пароля остаётся снаружи. |

## [apps/frontend/src/app/(application)/legal/\[slug\]/page.tsx](../../../apps/frontend/src/app/(application)/legal/%5Bslug%5D/page.tsx)

Вход маршрута /legal/[slug] передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Props` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `generateStaticParams` | 8 | Перечисляем только известные документы сборки, чтобы Next мог заранее подготовить их маршруты. |
| `generateMetadata` | 12 | Заголовок документа выбирается из общей карты по slug; для неизвестного ключа остаётся нейтральное название. |
| `Page` | 17 | Проверяем slug как собственный ключ набора документов, чтобы произвольное свойство объекта не стало юридической страницей. |

## [apps/frontend/src/app/(application)/legal/page.tsx](../../../apps/frontend/src/app/(application)/legal/page.tsx)

Вход маршрута /legal передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Отдаём обзор юридических документов; отдельные тексты открываются собственными маршрутами. |

## [apps/frontend/src/app/(application)/library/about-me/page.tsx](../../../apps/frontend/src/app/(application)/library/about-me/page.tsx)

Вход маршрута /library/about-me передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Показываем страницу автора под отдельным названием вкладки браузера. |

## [apps/frontend/src/app/(application)/library/aesthetics-guide/page.tsx](../../../apps/frontend/src/app/(application)/library/aesthetics-guide/page.tsx)

Вход маршрута /library/aesthetics-guide передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Подключаем гайд эстетик; сам экран проверяет доступ и загрузку расширенных материалов. |

## [apps/frontend/src/app/(application)/library/article/\[id\]/page.tsx](../../../apps/frontend/src/app/(application)/library/article/%5Bid%5D/page.tsx)

Вход маршрута /library/article/[id] передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Передаём полученный параметр статье; разбор допустимого ID и состояния доступа оставляем общему экрану материала. |

## [apps/frontend/src/app/(application)/library/patterns/page.tsx](../../../apps/frontend/src/app/(application)/library/patterns/page.tsx)

Вход маршрута /library/patterns передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Подключаем страницу выкроек, где бесплатная и клубные выдачи различаются явно. |

## [apps/frontend/src/app/(application)/loading.tsx](../../../apps/frontend/src/app/(application)/loading.tsx)

Ожидание этого сегмента использует общую заглушку, пока Next готовит вложенный маршрут.

## [apps/frontend/src/app/(application)/login/page.tsx](../../../apps/frontend/src/app/(application)/login/page.tsx)

Вход маршрута /login передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 9 | Читаем асинхронные searchParams и передаём намерение возврата вместе с признаком догидратационной отправки формы. |

## [apps/frontend/src/app/(application)/login/submit/route.ts](../../../apps/frontend/src/app/(application)/login/submit/route.ts)

Серверный вход обычной HTML-формы обрабатывает отправку до клиентской гидратации и возвращает контролируемый переход. Авторизацию выполняет существующий JSON API.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `POST` | 3 | Прерываем обычную отправку HTML-формы до гидратации через 303; credentials не читаются, не отражаются и не отправляются дальше. |

## [apps/frontend/src/app/(application)/oauth/callback/page.tsx](../../../apps/frontend/src/app/(application)/oauth/callback/page.tsx)

Вход маршрута /oauth/callback передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Page` | 4 | Старый callback ведёт к актуальному входу; токены из адреса здесь не извлекаются и не устанавливают сессию. |

## [apps/frontend/src/app/(application)/post/\[id\]/page.tsx](../../../apps/frontend/src/app/(application)/post/%5Bid%5D/page.tsx)

Вход маршрута /post/[id] передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Передаём адрес поста экрану, который умеет разбирать публичный UUID и совместимый числовой ID. |

## [apps/frontend/src/app/(application)/privacy/page.tsx](../../../apps/frontend/src/app/(application)/privacy/page.tsx)

Вход маршрута /privacy передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Подключаем статическую политику конфиденциальности под самостоятельным маршрутом. |

## [apps/frontend/src/app/(application)/quiz/page.tsx](../../../apps/frontend/src/app/(application)/quiz/page.tsx)

Вход маршрута /quiz передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Начинаем обычный поток теста; восстановление незавершённого прохода решает его владелец состояния. |

## [apps/frontend/src/app/(application)/quiz/result/page.tsx](../../../apps/frontend/src/app/(application)/quiz/result/page.tsx)

Вход маршрута /quiz/result передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Запрашиваем режим сохранённого результата, не создавая новый проход теста автоматически. |

## [apps/frontend/src/app/(application)/video/\[id\]/page.tsx](../../../apps/frontend/src/app/(application)/video/%5Bid%5D/page.tsx)

Вход маршрута /video/[id] передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 6 | Передаём ID странице ролика; серверный источник воспроизведения запрашивается уже в её жизненном цикле. |

## [apps/frontend/src/app/error.tsx](../../../apps/frontend/src/app/error.tsx)

Модуль error.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ErrorPage` | 6 | Предлагаем повтор границы Next через reset; отдельного сетевого повтора или сброса пользовательских данных здесь нет. |

## [apps/frontend/src/app/layout.tsx](../../../apps/frontend/src/app/layout.tsx)

Корневая серверная оболочка задаёт метаданные и базовые ресурсы документа; браузерные состояния подключаются провайдерами ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `viewport` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `RootLayout` | 29 | Дожидаемся request-time рендера ради nonce, затем отдаём общий документ; интерактивные провайдеры подключают вложенные layout. |

## [apps/frontend/src/app/loading.tsx](../../../apps/frontend/src/app/loading.tsx)

Общий экспорт заглушки маршрута сохраняет одинаковое ожидание для лениво загружаемых страниц.

## [apps/frontend/src/app/not-found.tsx](../../../apps/frontend/src/app/not-found.tsx)

Неизвестный адрес получает отдельное состояние отсутствия и явный переход, а не пустое содержимое приложения.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `NotFound` | 5 | Для отсутствующего маршрута даём явный выход на главную без попытки угадать прежний URL. |

## [apps/frontend/src/app/password/page.tsx](../../../apps/frontend/src/app/password/page.tsx)

Вход маршрута /password передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `metadata` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Page` | 13 | Установка пароля работает без общих фоновых эффектов приложения; referrer и индексация ограничены метаданными страницы. |

## [apps/frontend/src/app/providers.tsx](../../../apps/frontend/src/app/providers.tsx)

Модуль providers.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Providers` | 20 | Создаём клиентов один раз и вкладываем контексты в порядке зависимостей: подписка и фоновые операции читают уже установленную сессию. |

## [apps/frontend/src/app/tab-loading.tsx](../../../apps/frontend/src/app/tab-loading.tsx)

Загрузка вкладки не рисует приблизительную копию будущего баннера, чтобы его появление не дублировало оформление.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `TabLoading` | 7 | Во время загрузки модуля показываем только общую заглушку маршрута: сам экран позже создаст свой баннер и эффекты. |

## [apps/frontend/src/app/tab-screens.tsx](../../../apps/frontend/src/app/tab-screens.tsx)

Модуль tab-screens.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ScreenErrorBoundary` | 17 | Класс. Подробности и ограничения — в исходнике. |
| `ScreenErrorBoundary.getDerivedStateFromError` | 23 | Ошибка помечает конкретную retained-панель; остальные вкладки продолжают использовать свои экземпляры. |
| `ScreenErrorBoundary.render` | 27 | Локальный reset возвращает только boundary этой панели, не пересоздавая глобальные сессию и кеш. |
| `screens` | 38 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `TabPath` | 61 | Контракт типов. Подробности и ограничения — в исходнике. |
| `isTabPath` | 63 | Проверяем собственный ключ набора ленивых экранов: остальные адреса рисуются обычным changing subtree Next. |
| `TabScreens` | 67 | Монтируем только посещённые панели и сохраняем их DOM; active/hidden/inert отделяют жизнь экрана от его видимости и фокуса. |

## [apps/frontend/src/app/tab-shell.module.scss](../../../apps/frontend/src/app/tab-shell.module.scss)

Оформление компонента: Общая оболочка вкладок отделяет шапку и меню от сменяемого содержимого, сохраняя контекст текущего маршрута.

## [apps/frontend/src/app/tab-shell.tsx](../../../apps/frontend/src/app/tab-shell.tsx)

Модуль tab-shell.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `TabShell` | 18 | Выбираем оболочку по маршруту и клубным правам; отмена подписки живёт выше профиля, чтобы переход не терял неизвестный результат. |

## [apps/frontend/src/app/tab-styles.ts](../../../apps/frontend/src/app/tab-styles.ts)

Стили сохранённых вкладок подключаются заранее, хотя JavaScript экранов остаётся ленивым: первый кадр не должен быть без оформления.

## [apps/frontend/src/domain/content/article-blocks.ts](../../../apps/frontend/src/domain/content/article-blocks.ts)

Проверка и преобразование блоков статьи отделены от визуального редактора и транспортных вызовов.

## [apps/frontend/src/domain/content/article-content.module.scss](../../../apps/frontend/src/domain/content/article-content.module.scss)

Оформление компонента: Блоки статьи отображаются по типу.

## [apps/frontend/src/domain/content/article-content.tsx](../../../apps/frontend/src/domain/content/article-content.tsx)

Модуль article-content.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ArticleContent` | 18 | Отображаем переданные блоки и обложку без исполнения HTML; открытие изображений делегируем владельцу просмотра. |
| `ArticleBlockView` | 62 | Выбираем разметку по типу блока: текстовые inlines, отдельные изображения, внешнее действие или карусель; размеры фото уточняются onLoad. |

## [apps/frontend/src/domain/content/article-cover-journal.ts](../../../apps/frontend/src/domain/content/article-cover-journal.ts)

У публичной обложки отдельный журнал загрузки: получение файла и сохранение ссылки в статье могут завершиться независимо.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `keySchema` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `uploadSchema` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `snapshotSchema` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `packedSchema` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ArticleCoverSnapshot` | 53 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ArticleCoverUpload` | 54 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ArticleCoverRecord` | 55 | Контракт типов. Подробности и ограничения — в исходнике. |
| `restoreRecord` | 60 | Восстанавливаем исходные File и snapshot обложки только своего владельца, проверяя соответствие локальным ссылкам статьи. |
| `requirePublicCoverReceipt` | 77 | Публичная cover-квитанция не может применять аватар: ready требует avatarApplied=false и isCurrent=null. |
| `storageError` | 98 | Сбой durable-журнала загрузки сохраняет необходимость проверки вместо отправки нового баннера. |
| `ArticleCoverJournal` | 104 | One immutable cover intent per account, separate from article publication. |
| `ArticleCoverJournal.constructor` | 106 | Один слот обложки принадлежит аккаунту и живёт отдельно от публикации статьи. |
| `ArticleCoverJournal.assertOwner` | 108 | Смена персонального владельца блокирует продолжение старой cover-операции. |
| `ArticleCoverJournal.transaction` | 113 | Ограничиваем IndexedDB-операцию дедлайном и ждём commit, проверяя владельца до работы и после завершения. |
| `ArticleCoverJournal.load` | 196 | Читаем и валидируем текущий immutable cover intent, не выполняя сетевой upload. |
| `ArticleCoverJournal.prepare` | 202 | До сети сохраняем точный upload-payload, snapshot и байты вложений; занятый слот возвращаем без замены. |
| `ArticleCoverJournal.requireCurrent` | 244 | Перечитываем durable-ключ перед продолжением, чтобы другая вкладка не была незаметно вытеснена. |
| `ArticleCoverJournal.clear` | 255 | Удаляем только тот же owner/key после завершения, сохраняя отличающийся intent другой вкладки. |

## [apps/frontend/src/domain/content/article-creation-journal.ts](../../../apps/frontend/src/domain/content/article-creation-journal.ts)

Журнал создания статьи хранит неизменяемую полезную нагрузку и ключ операции, чтобы восстановление не создавало другую статью.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `payloadSchema` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `keySchema` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `recordSchema` | 41 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `articleDraftSchema` | 98 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ArticleCreationPayload` | 102 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ArticleCreationRecord` | 103 | Контракт типов. Подробности и ограничения — в исходнике. |
| `parseArticleCreationRecord` | 106 | Проверяем strict write-payload, владельца и фазу файлов: upload содержит локальные ссылки, write — только готовые подтверждённые URL. |
| `restoreRecord` | 141 | Поддерживаем старый формат и восстанавливаем бинарную версию File перед полной проверкой intent. |
| `storeRecord` | 180 | Выносим чтение File в ArrayBuffer до IndexedDB-транзакции, сохраняя метаданные и квитанции. |
| `matches` | 196 | Для media-intent сравниваем owner/key/revision/editingId; простую immutable-операцию сверяем целиком. |
| `parseArticleCreationStatus` | 209 | Принимаем только notRecorded, created или deleted с валидным articleId; удалённую запись не создаём повторно. |
| `storageError` | 236 | Сбой или нарушение фазы журнала запрещает новый сетевой intent без восстановления исходного. |
| `ArticleCreationJournal` | 242 | A read/write IndexedDB transaction claims one account slot across tabs. |
| `ArticleCreationJournal.constructor` | 244 | Журнал занимает один account-slot для незавершённого создания или файловой записи статьи. |
| `ArticleCreationJournal.assertOwner` | 246 | Проверяем текущую личность до и после асинхронной подготовки данных. |
| `ArticleCreationJournal.transaction` | 251 | Сериализуем один account-slot транзакцией IndexedDB с дедлайном; успех означает завершённый commit. |
| `ArticleCreationJournal.load` | 334 | Читаем текущую операцию без её повторной отправки или изменения ключа. |
| `ArticleCreationJournal.prepare` | 340 | Снимаем immutable payload до ожидания storage; пустой слот атомарно занимает новый key, занятый возвращает прежнюю операцию. |
| `ArticleCreationJournal.requireCurrent` | 378 | Перечитываем ключ и локальную ревизию перед следующим шагом восстановления. |
| `ArticleCreationJournal.recordConflict` | 386 | Сохраняем только подтверждённый конфликт write существующей статьи, увеличивая ревизию durable-intent. |
| `ArticleCreationJournal.checkpoint` | 411 | Продвигаем только upload-фазу того же intent; переход к write разрешает лишь точную замену локальных файлов их квитанциями. |
| `ArticleCreationJournal.clear` | 454 | Удаляем только совпадающую durable-операцию; более новая запись другой вкладки остаётся нетронутой. |

## [apps/frontend/src/domain/content/article-draft-journal.ts](../../../apps/frontend/src/domain/content/article-draft-journal.ts)

Редактируемый черновик статьи хранится отдельно от уже отправленной операции; ревизия локальной записи выявляет конфликт вкладок.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `snapshotSchema` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ArticleDraftSnapshot` | 15 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ArticleDraftRecord` | 16 | Контракт типов. Подробности и ограничения — в исходнике. |
| `DamagedArticleDraft` | 23 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ArticleDraftInspection` | 24 | Контракт типов. Подробности и ограничения — в исходнике. |
| `storageError` | 29 | Отказ локального хранилища требует сохранить открытый редактор, а не продолжить без recoverable snapshot. |
| `parse` | 34 | Проверяем владельца, ревизию, поля и используемые File; лишний или потерянный исходник считается повреждением. |
| `ArticleDraftJournal` | 53 | Drafts are separate per account/article; revisions protect concurrent tabs. |
| `ArticleDraftJournal.constructor` | 55 | Экземпляр журнала обслуживает только черновики одного аккаунта. |
| `ArticleDraftJournal.key` | 57 | Разделяем новый черновик и редакторы существующих статей в пространстве владельца. |
| `ArticleDraftJournal.parseEntry` | 61 | Физический ключ должен совпадать с editingId внутри записи, иначе черновик нельзя подменять между статьями. |
| `ArticleDraftJournal.assertOwner` | 67 | После смены аккаунта прежний редактор теряет право на чтение и запись локального слота. |
| `ArticleDraftJournal.transaction` | 72 | Открываем ограниченную IndexedDB-транзакцию; поддерживаем чтение одного слота либо cursor только префикса владельца. |
| `ArticleDraftJournal.inspect` | 187 | Возвращаем пригодные и повреждённые слоты отдельно, не скрывая потерянный черновик как отсутствие данных. |
| `ArticleDraftJournal.load` | 201 | Совместимый путь возвращает только проверенные записи из полной инспекции. |
| `ArticleDraftJournal.archiveDamaged` | 205 | Атомарно архивируем исходную повреждённую копию с File-байтами; уже восстановленную другой вкладкой запись не удаляем. |
| `ArticleDraftJournal.save` | 235 | Создаём новую локальную ревизию только при совпадении ожидаемой старой, сохраняя вместе snapshot и реально используемые файлы. |
| `ArticleDraftJournal.clear` | 261 | Удаляем только ожидаемую ревизию конкретной статьи, защищая новый ввод другой вкладки. |
| `ArticleDraftJournal.requireRevision` | 273 | Отсутствие и существование слота различаются; несовпадение expected требует явного повторного чтения. |

## [apps/frontend/src/domain/content/article-file-save.ts](../../../apps/frontend/src/domain/content/article-file-save.ts)

Подготовленные закрытые файлы статьи загружаем и фиксируем поэтапно до записи итоговых блоков.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `recoverArticleFileUploads` | 14 | Восстанавливаем только файлы существующего upload-intent; каждый ACK checkpoint сохраняется до продолжения, статью не публикуем. |
| `sealArticleFileWrite` | 35 | До внешнего write замораживаем блоки с разрешёнными URL в durable-журнале; изменённая стадия не может быть повторно запечатана. |

## [apps/frontend/src/domain/content/edit-revision.ts](../../../apps/frontend/src/domain/content/edit-revision.ts)

Ожидаемая ревизия относится к прочитанной версии материала и передаётся серверу при сохранении изменений.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `editBaseSchema` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ContentEditBase` | 11 | Контракт типов. Подробности и ограничения — в исходнике. |
| `readEditRevision` | 14 | Проверяем revision на границе ответа; undefined сохраняет совместимость со старым выпуском, пустая строка недопустима. |
| `captureEditBase` | 23 | Сохраняем исходную ревизию и независимую копию редактируемых полей для последующей сверки. |
| `withExpectedRevision` | 34 | Добавляем optimistic revision только когда она действительно известна, не выдумывая базовую версию. |
| `postKeys` | 44 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `articleKeys` | 56 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `editableSnapshot` | 58 | Выбираем только поля, которые detail реально подтверждает; для поста разворачиваем media в видео и остальные вложения. |
| `normalize` | 80 | Стабилизируем порядок ключей и ISO-даты перед сравнением; массивы сохраняют семантический порядок. |
| `matchesEditableWrite` | 99 | Признаём commit только по доказуемым полям detail; privateAssetIds/posters не подтверждаются старым контрактом автоматически. |

## [apps/frontend/src/domain/content/post-text-sanitize.ts](../../../apps/frontend/src/domain/content/post-text-sanitize.ts)

Перед отображением нормализуем старый текст и разметку постов; данные из API не вставляются как произвольный HTML.

## [apps/frontend/src/domain/content/private-article-files.ts](../../../apps/frontend/src/domain/content/private-article-files.ts)

Локальные ссылки связывают блоки статьи с исходными файлами; перед сохранением выбираем только используемые вложения.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PrivateArticleFile` | 8 | Контракт типов. Подробности и ограничения — в исходнике. |
| `articleFileReference` | 12 | Локальная ссылка связывает блок со стабильным ключом исходника до появления готового серверного адреса. |
| `mapArticleFiles` | 15 | Обходим только файловые поля photo/png/link/carousel, сохраняя остальные блоки и их порядок. |
| `selectArticleFiles` | 42 | Проверяем уникальность ключей и соответствие назначения файлу блока; возвращаем только используемые исходники. |
| `resolveArticleFiles` | 67 | Заменяем локальные ссылки только готовыми квитанциями совпадающего назначения; неподтверждённый файл блокирует write. |
| `restoreArticleFileReferences` | 85 | При возврате write в черновик восстанавливаем local-content ссылки, сохраняя редактируемые исходные File. |

## [apps/frontend/src/domain/content/rich-text-anchors.ts](../../../apps/frontend/src/domain/content/rich-text-anchors.ts)

Модуль rich-text-anchors.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Selection` | 3 | Текстовые якоря помогают найти прежнее выделение после правок; неоднозначные совпадения не следует считать точной позицией. |
| `selectionOccurrence` | 8 | Считаем номер данного вхождения выделенного текста, учитывая также перекрывающиеся совпадения. |
| `rangeForOccurrence` | 26 | Находим тот же номер вхождения якоря в текущем тексте; отсутствие совпадения возвращаем явно как null. |
| `rangesOverlap` | 46 | Сравниваем полуоткрытые диапазоны: соприкасающиеся края не считаются пересечением. |

## [apps/frontend/src/domain/content/rich-text-edit.ts](../../../apps/frontend/src/domain/content/rich-text-edit.ts)

Преобразования форматирования работают с текстом и диапазонами, сохраняя привязки ссылок и выделений.

## [apps/frontend/src/domain/content/rich-text-ranges.ts](../../../apps/frontend/src/domain/content/rich-text-ranges.ts)

Операции с диапазонами описывают форматирование текста независимо от конкретного поля ввода.

## [apps/frontend/src/domain/content/rich-text-renderer.module.scss](../../../apps/frontend/src/domain/content/rich-text-renderer.module.scss)

Оформление компонента: Разметку выводим React-элементами.

## [apps/frontend/src/domain/content/rich-text-renderer.tsx](../../../apps/frontend/src/domain/content/rich-text-renderer.tsx)

Модуль rich-text-renderer.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `RichTextRendererProps` | 16 | Контракт типов. Подробности и ограничения — в исходнике. |
| `RichTextRenderer` | 26 | Санитизируем сохранённые блоки перед React-рендером; при их отсутствии используем plain text, сохраняя переносы и ограничение строк. |
| `renderInlines` | 120 | Собираем форматированные фрагменты React-элементами; адрес ссылки проверяется независимо от безопасно экранированной подписи. |
| `renderPlainText` | 158 | Выделяем emoji для системного шрифта, сохраняя текст без HTML-интерпретации и лишних обёрток для обычной строки. |

## [apps/frontend/src/domain/content/rich-text-save.ts](../../../apps/frontend/src/domain/content/rich-text-save.ts)

При сохранении текст и форматированные диапазоны приводим к одному согласованному представлению.

## [apps/frontend/src/domain/content/types.ts](../../../apps/frontend/src/domain/content/types.ts)

Общие типы форматированных блоков задают представление текста между редактором, сериализацией и показом.

## [apps/frontend/src/domain/launch/public-configuration.ts](../../../apps/frontend/src/domain/launch/public-configuration.ts)

Общий запрос хранит полный публичный ответ настроек; каждый потребитель проверяет только нужную ему часть.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PUBLIC_LAUNCH_KEY` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `publicConfigurationOptions` | 8 | Один публичный query хранит полный неизвестный ответ; каждый select валидирует свою часть без вытеснения остальных настроек. |

## [apps/frontend/src/domain/launch/settings.ts](../../../apps/frontend/src/domain/launch/settings.ts)

Парсеры настроек проверяют даты, ссылки и ревизии на границе API, прежде чем их использует интерфейс.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `SEASONS` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SEASON_NAMES` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PublicAppearance` | 17 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ManagerOrderSettings` | 22 | Контракт типов. Подробности и ограничения — в исходнике. |
| `record` | 28 | Принимаем только объект настроек; массивы и пустые значения считаем нарушением API-контракта. |
| `season` | 34 | Допускаем один из четырёх ключей сезона без неявного fallback. |
| `validAnnualDate` | 39 | Проверяем реальную дату ММ-ДД в невисокосном году; нормализация Date не должна принять 31 февраля. |
| `validSeasonUrl` | 47 | Сезонный ресурс допускает null или абсолютный HTTPS без встроенных учётных данных. |
| `isSeasonSharingPage` | 58 | Распознаём известные страницы публикации Яндекс Диска, чтобы редактор не принял HTML-страницу за изображение. Уже сохранённые ссылки читаются совместимо; запрет страниц публикации относится к редактированию. |
| `appearance` | 68 | Нормализуем одну сезонную привязку только после проверки даты начала и обоих URL. |
| `revision` | 84 | Ревизия настроек должна укладываться в неотрицательный SQL int, иначе optimistic concurrency недостоверна. |
| `parsePublicAppearance` | 94 | Выделяем и валидируем публичное оформление из полного ответа настроек. |
| `parseManagerOrderSettings` | 103 | Проверяем текущего получателя и поддерживаемый способ заказа, прежде чем строить новое письмо. |
| `parseLaunchSnapshot` | 123 | Проверяем административный snapshot: московскую зону, режим, четыре разные даты и все сезонные привязки. |
| `sameLaunchConfiguration` | 153 | Сравниваем нормализованные допустимые конфигурации; порядок полей входного объекта не должен создавать ложный конфликт. |
| `untilMoscowMidnight` | 163 | Вычисляем задержку до московской полуночи; сам выбор сезона остаётся серверным. |

## [apps/frontend/src/domain/launch/use-club-appearance.ts](../../../apps/frontend/src/domain/launch/use-club-appearance.ts)

Модуль use-club-appearance.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CLUB_APPEARANCE_KEY` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `useClubAppearance` | 15 | Читаем общее оформление только активному экрану и перечитываем при возврате, восстановлении сети и московской полуночи. |

## [apps/frontend/src/domain/launch/use-manager-order-settings.ts](../../../apps/frontend/src/domain/launch/use-manager-order-settings.ts)

Модуль use-manager-order-settings.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `useManagerOrderSettings` | 11 | Для нового заказа используем только успешное актуальное чтение получателя; старые данные при ошибке намеренно не возвращаем. |

## [apps/frontend/src/domain/library/aesthetic-visuals.ts](../../../apps/frontend/src/domain/library/aesthetic-visuals.ts)

Привязки иллюстраций эстетики проверяем перед отображением, сохраняя разделение обложек и закрытых материалов.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `aestheticMaterialKey` | 6 | Приводим ключ эстетики к согласованному namespace закрытого материала. |
| `resolveAestheticImages` | 10 | Сопоставляем разрешённые слоты картинок только с аутентифицированными привязками своего материала; публичного fallback нет. |

## [apps/frontend/src/domain/library/private-library.ts](../../../apps/frontend/src/domain/library/private-library.ts)

Модуль private-library.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `privateReadOptions` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `useCancelHiddenRead` | 26 | После отключения observers отменяем только неиспользуемое чтение скрытого экрана, сохраняя общий запрос другим активным потребителям. |
| `readAestheticGuide` | 51 | Читаем защищённый гайд и проверяем schema вместе с запрошенным ключом, прежде чем вернуть его в кеш. |
| `useAestheticGuides` | 66 | Разделяем кеш по ID пользователя; подтверждённые данные доступны только пока есть клубные права и запрос востребован. Во время перепроверки сохраняем подтверждённый DOM до ответа; отказ или ошибка скрывают данные. |
| `bindingSchema` | 95 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `bindingsPageSchema` | 106 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PatternBinding` | 115 | Контракт типов. Подробности и ограничения — в исходнике. |
| `patternKeys` | 116 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PATTERN_READ_BUDGET` | 117 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `readPatternBindings` | 121 | Собираем четыре согласованные выкройки с ограничениями страниц и времени, отвергая повтор курсора и неожиданные привязки. |
| `usePatternBindings` | 181 | Выдаём только успешные привязки текущего владельца с клубным доступом, отменяя ненужное чтение скрытого раздела. |

## [apps/frontend/src/domain/pen-pals/types.ts](../../../apps/frontend/src/domain/pen-pals/types.ts)

Модуль types.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PEN_PAL_INTERESTS` | 3 | Типы почтового отделения описывают анкету и связи участников; наличие типа само по себе не включает функцию. |
| `PenPalInterest` | 18 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PEN_PAL_INTEREST_SET` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PEN_PAL_CONSENT_VERSION` | 21 | Bump when legal copy for pen pals consent changes. |
| `PEN_PAL_ADULT_CONSENT_LABEL` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PEN_PAL_CONFIRM_DAYS` | 25 | Calendar days for mutual confirm after match suggestion. |

## [apps/frontend/src/domain/post/club-tags.ts](../../../apps/frontend/src/domain/post/club-tags.ts)

Клубные рубрики и правила обсуждений берём из общего пакета; локально добавляем подписи для отображения.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `clubTagLabel` | 10 | Сначала используем общую подпись клубной рубрики, затем словарь тем постов; неизвестный тег сохраняем как есть. |

## [apps/frontend/src/domain/post/comment-count-label.ts](../../../apps/frontend/src/domain/post/comment-count-label.ts)

Модуль comment-count-label.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `commentCountLabel` | 4 | Нормализуем счётчик к неотрицательному целому и выбираем русское склонение с исключением 11–14. |
| `COMMENT_CHAR_LIMIT` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/domain/post/draft.ts](../../../apps/frontend/src/domain/post/draft.ts)

Снимок поста отделяет редактируемые поля от сетевого транспорта; сравнение снимков используется при восстановлении и конфликтах.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PostDraft` | 5 | Контракт типов. Подробности и ограничения — в исходнике. |
| `serializePostDraft` | 18 | В общей точке сохранения проверяем выбранную дату и размер текста; оба редактора отправляют один нормализованный payload. |
| `postDraftSnapshot` | 31 | Снимок допускает ещё не заполненную дату расписания, нормализует richText и сериализует только подходящую статусу дату. |

## [apps/frontend/src/domain/post/inspiration-titles.ts](../../../apps/frontend/src/domain/post/inspiration-titles.ts)

Модуль inspiration-titles.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `DESCRIPTION_SEPARATORS` | 3 | Списки названий и источников приводим к читабельному виду без изменения самих материалов. |
| `stripInspirationDescription` | 5 | Срезаем описание по последнему согласованному разделителю тире, не оставляя пустую подпись вместо исходного текста. |
| `formatInspirationList` | 20 | Собираем краткие названия источников в одну строку после одинаковой очистки описаний. |

## [apps/frontend/src/domain/post/post-date.ts](../../../apps/frontend/src/domain/post/post-date.ts)

Модуль post-date.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `postDisplayDate` | 3 | Дата публикации для пользовательских списков выбирается отдельно от технической даты создания записи. |

## [apps/frontend/src/domain/post/post-interaction-cache.ts](../../../apps/frontend/src/domain/post/post-interaction-cache.ts)

Обновляем представления одного поста во всех известных списках, сохраняя структуру страниц и остальных карточек.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `postLists` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `savedLists` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `matches` | 16 | Проверяем путь tRPC query, чтобы обновлять только согласованные списки публикаций. |
| `record` | 21 | Отличаем объект записи от массива и null перед обходом поддерживаемых envelopes. |
| `updatePost` | 27 | Рекурсивно меняем только pages/posts/items; нетронутые ветви сохраняют ссылку, null-count удаляет нужную карточку. |
| `updateCachedPostLikeCount` | 57 | Копируем подтверждённый сервером счётчик в уже загруженные карточки без полного повторного запроса списка. |
| `removeCachedSavedPost` | 72 | Удаляем снятый bookmark из известных страниц сохранённого, сохраняя keyset-курсоры. |
| `removeUnavailableCachedPost` | 83 | Подтверждённое отсутствие скрывает карточку во всех поддерживаемых кешах, а не оставляет удалённый контент на экране. |

## [apps/frontend/src/domain/post/post-interaction-data.ts](../../../apps/frontend/src/domain/post/post-interaction-data.ts)

Подготовка набора ID ограничивает объём запроса отметок и отбрасывает неподходящие значения до транспорта.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PostInteractions` | 4 | Контракт типов. Подробности и ограничения — в исходнике. |
| `interactionBatches` | 7 | Убираем дубли и недопустимые ID, затем формируем упорядоченные сетевые пачки не больше 50 элементов. |
| `requirePostInteractions` | 18 | Принимаем likedIds/savedIds только из запрошенного множества; некорректный ответ не должен изменить чужие карточки. |

## [apps/frontend/src/domain/post/post-interaction-reader.ts](../../../apps/frontend/src/domain/post/post-interaction-reader.ts)

Чтения отметок отдельных карточек объединяем в ограниченные запросы и сохраняем версию чтения для проверки восстановления.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PostInteractionSnapshot` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Group` | 12 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Entry` | 13 | Контракт типов. Подробности и ограничения — в исходнике. |
| `createPostInteractionReader` | 23 | Коротким окном объединяем потребности карточек в wire batches; отдельные подписчики сохраняют свои сигналы и версии свежего чтения. Отдельная кеш-запись принадлежит одному посту. |

## [apps/frontend/src/domain/post/post-interaction-status.tsx](../../../apps/frontend/src/domain/post/post-interaction-status.tsx)

Модуль post-interaction-status.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PostInteractionStatus` | 5 | Сообщаем ошибку отметок с действием читающего восстановления; кнопка не повторяет toggle. |

## [apps/frontend/src/domain/post/post-interactions-context.tsx](../../../apps/frontend/src/domain/post/post-interactions-context.tsx)

Модуль post-interactions-context.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `InteractionFailure` | 15 | Контракт типов. Подробности и ограничения — в исходнике. |
| `useInteractionState` | 18 | Храним batch-reader, scopes, optimistic overrides и ошибки выше карточек; cleanup отзывает все задачи владельца. |
| `Context` | 51 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `InteractionStateProvider` | 56 | Один экземпляр состояния взаимодействий обслуживает все карточки текущей личности. |
| `PostInteractionsProvider` | 62 | Смена пользователя пересоздаёт провайдер, а обычная навигация сохраняет текущие операции. |
| `usePostInteractionState` | 77 | Возвращаем общее состояние только внутри провайдера взаимодействий, не создавая независимый кеш карточки. |

## [apps/frontend/src/domain/post/post-media-photos.ts](../../../apps/frontend/src/domain/post/post-media-photos.ts)

Модуль post-media-photos.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `mediaBasename` | 5 | Извлекаем декодированное имя последнего сегмента без query для сопоставления legacy-файла и его миниатюры. |
| `isThumbUrl` | 9 | Распознаём историческую пометку _thumb в имени, а не по размерам изображения. |
| `thumbForVideo` | 18 | Ищем миниатюру с тем же basename ролика, чтобы не присвоить обложку соседнего видео. |
| `splitVideoPhotos` | 33 | Отделяем legacy-превью от галереи; неоднозначный fallback разрешён только явным параметром вызывающего кода. |

## [apps/frontend/src/domain/post/post-tags.ts](../../../apps/frontend/src/domain/post/post-tags.ts)

Модуль post-tags.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PostTag` | 3 | Отображаемые подписи тегов не меняют их значения для фильтрации и API. |
| `CLUB_RUBRIC_TAGS` | 9 | Four club section tabs — shown first, with a stronger chip. |
| `SEASON_TAGS` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `TOPIC_TAGS` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FEED_TAGS` | 44 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CLUB_TAGS` | 45 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ALL_POST_TAGS` | 50 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LABEL_BY_SLUG` | 51 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `postTagLabel` | 55 | Отображаем согласованную русскую подпись известного slug, сохраняя неизвестный пользовательский тег. |
| `postHasTag` | 60 | Сопоставляем slug и русские подписи без учёта регистра; пустой фильтр ничего не выбирает. |
| `tagsForTarget` | 73 | Предлагаем редактору набор тегов целевого раздела, не меняя уже сохранённые значения поста. |

## [apps/frontend/src/domain/post/private-comment-journal.ts](../../../apps/frontend/src/domain/post/private-comment-journal.ts)

Локальный журнал комментария ограничен аккаунтом и постом; сохранённая версия защищает от перезаписи другим редактором.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `StoredFile` | 8 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Stored` | 16 | Контракт типов. Подробности и ограничения — в исходнике. |
| `failed` | 21 | Недоступный или повреждённый локальный журнал запрещает новую неподтверждаемую отправку. |
| `changed` | 26 | Конфликт ревизии требует перечитать обсуждение, а не заменить сохранённый intent. |
| `pack` | 31 | Файлы сохраняем явными ArrayBuffer с метаданными: это переносимый для WebKit формат IndexedDB. |
| `unpack` | 48 | Проверяем обёртку и бинарные метаданные, восстанавливаем File и повторно валидируем весь intent. |
| `sameIntent` | 87 | Сравниваем неизменные поля и байты каждого файла, а не только имя или размер. |
| `advances` | 120 | Разрешаем только продвижение прежнего intent: write, savedId и ready-квитанция не могут откатиться. |
| `PrivateCommentJournal` | 138 | One account/post slot. File bytes are explicit buffers, never session tokens or S3 keys. |
| `PrivateCommentJournal.constructor` | 141 | Ключ хранения принадлежит одной паре аккаунт/пост; ревизия появится после load или prepare. |
| `PrivateCommentJournal.assertOwner` | 146 | Проверяем текущего владельца и соответствие поста перед локальной транзакцией и после асинхронной подготовки. |
| `PrivateCommentJournal.transaction` | 157 | Оборачиваем IndexedDB в ограниченную по времени транзакцию; resolve происходит только после oncomplete, сбой abort закрывает соединение. |
| `PrivateCommentJournal.load` | 236 | Читаем и проверяем текущую запись, запоминая её ревизию для следующего checkpoint. |
| `PrivateCommentJournal.prepare` | 253 | Атомарно занимаем пустой слот либо возвращаем уже существующее намерение другой вкладки без перезаписи. |
| `PrivateCommentJournal.checkpoint` | 284 | Сохраняем только допустимое продвижение при совпадении ожидаемой ревизии; новые байты читаем до открытия транзакции. |
| `PrivateCommentJournal.clear` | 308 | Удаляем только ту же ревизию совместимого intent, чтобы закрытие старого редактора не стёрло чужую отправку. |

## [apps/frontend/src/domain/post/private-comment-save.ts](../../../apps/frontend/src/domain/post/private-comment-save.ts)

Отправка комментария объединяет текст и фото под одним намерением; сохранённый ключ позволяет восстановить ответ без второго комментария.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PrivateCommentPhoto` | 12 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CommentDraft` | 13 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PrivateCommentRecord` | 17 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PrivateCommentApi` | 29 | Контракт типов. Подробности и ограничения — в исходнике. |
| `positive` | 44 | Проверяем безопасный положительный ID для владельца, поста, родителя и ACK. |
| `error` | 47 | Повреждение сохранённого intent не разрешает создать новый ключ и потенциальный дубль комментария. |
| `payload` | 52 | Формируем неизменный write-payload из готовых фото и того же idempotency key. |
| `requirePrivateCommentRecord` | 64 | Проверяем строгую структуру журнала, владельца и фазы; после write текст, родитель, файлы и сериализованный payload не могут расходиться. |
| `preparePrivateComment` | 137 | Создаём intent комментария с фото; пустой набор здесь не переводится молча в другой сценарий. |
| `prepareTextComment` | 146 | Создаём тот же восстанавливаемый протокол для текстового комментария без файлов. |
| `prepareComment` | 153 | Фиксируем новый ключ и нормализованный текст до сети, копируя метаданные выбранных файлов в отдельный intent. |
| `savePrivateComment` | 174 | Сначала durable-checkpoint, затем загрузки и замороженный write; подтверждённый savedId сохраняется до возврата вызывающему коду. |

## [apps/frontend/src/domain/post/private-photo-upload.ts](../../../apps/frontend/src/domain/post/private-photo-upload.ts)

Закрытые фотографии поста проходят проверку локального файла и серверного подтверждения, прежде чем попасть в сохранённый пост.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `prefix` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PrivatePostPhoto` | 11 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PrivatePostPhotoApi` | 12 | Контракт типов. Подробности и ограничения — в исходнике. |
| `privatePostPhotoReference` | 23 | Создаём локальную ссылку по ключу намерения, пока серверный URL ещё не подтверждён. |
| `validatePrivatePostPhoto` | 27 | Проверяем исходник именно по назначению postPhoto, а не по более широкому документному контракту. |
| `requirePrivatePostPhotoReceipt` | 31 | Сверяем квитанцию с конкретным исходным файлом и назначением фото поста. |
| `selectPrivatePostPhotos` | 35 | Разрешаем локальные ссылки в порядке поста, отвергая повторные ключи, повтор использования и потерянный исходник. |
| `resolvePrivatePostPhotos` | 57 | Заменяем local-photo только готовой канонической квитанцией; уже существующие серверные ссылки сохраняем. |
| `uploadPrivatePostPhoto` | 75 | Вызываем общий восстановимый private-content протокол; отсутствие API не переводит фото в публичную загрузку. Ссылки постов сохраняют прежний формат; upload/status общий со статьями. |

## [apps/frontend/src/domain/post/private-upload.ts](../../../apps/frontend/src/domain/post/private-upload.ts)

Загрузка закрытого вложения сохраняет исходное намерение и использует прежний ключ при восстановлении неизвестного результата.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PrivateUploadInput` | 8 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PrivateUploadReceipt` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PrivateUploadIntent` | 17 | Контракт типов. Подробности и ограничения — в исходнике. |
| `requirePrivateReceipt` | 23 | Проверяем квитанцию закрытого вложения, включая тип и лимит размера; публичный URL или objectKey в таком ответе запрещены. |

## [apps/frontend/src/domain/post/private-video-upload.ts](../../../apps/frontend/src/domain/post/private-video-upload.ts)

Крупный видеофайл и его квитанция проходят отдельный путь восстановления; повтор не должен становиться новой загрузкой.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PrivatePostVideo` | 14 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PrivatePostVideoApi` | 22 | Контракт типов. Подробности и ограничения — в исходнике. |
| `privatePostVideoReference` | 34 | Локальное видео адресуется ключом intent, а не временным object URL. |
| `validatePrivatePostVideo` | 37 | Проверяем исходный File, предельный размер и формат сохранённой задержки; отдельный постер валидируем как закрытое фото. |
| `requirePrivateVideoReceipt` | 59 | Квитанция должна описывать выбранный файл без изменения размера и имени и один из поддерживаемых MIME видео. |
| `selectPrivatePostVideos` | 88 | Разрешаем ссылки local-video в исходные файлы без дублей и отсутствующих ключей. |
| `uploadPrivatePostVideo` | 110 | После attempted сначала читаем статус прежнего ключа; raw File отправляем повторно только этим ключом и с сохранённым cooldown 429. |

## [apps/frontend/src/domain/post/recovery-store.ts](../../../apps/frontend/src/domain/post/recovery-store.ts)

IndexedDB хранит снимок редактора вместе с фазой записи и файлами; ключ включает владельца и слот редактора.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PendingPostUpload` | 20 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PostEditorSnapshot` | 26 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PostRecoveryRecord` | 34 | Контракт типов. Подробности и ограничения — в исходнике. |
| `DATABASE` | 43 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `STORE` | 44 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FileData` | 45 | Контракт типов. Подробности и ограничения — в исходнике. |
| `StoredAttachment` | 51 | Контракт типов. Подробности и ограничения — в исходнике. |
| `StoredPhoto` | 52 | Контракт типов. Подробности и ограничения — в исходнике. |
| `StoredVideo` | 53 | Контракт типов. Подробности и ограничения — в исходнике. |
| `StoredRecord` | 57 | Контракт типов. Подробности и ограничения — в исходнике. |
| `storageError` | 71 | Сбой сохранения черновика требует оставить редактор открытым, а не продолжить без durable-снимка. |
| `restoreFile` | 77 | Восстанавливаем File только из проверенных бинарных метаданных хранилища. |
| `validPhotos` | 92 | Сверяем выбранные фотографии, локальные ссылки и использованные coordinator объекты, сохраняя их общую идентичность. |
| `validVideos` | 127 | Проверяем исходные видео, постеры и квитанции, а также соответствие файлов, уже начатых координатором. |
| `transaction` | 169 | Читаем/пишем IndexedDB с дедлайном; Promise завершается после фактического commit транзакции, не после отдельного запроса. Бинарные исходники упакованы в ArrayBuffer для WebKit-контекстов, не умеющих сохранять Blob/File. |
| `validRecord` | 237 | Проверяем восстановленный snapshot, статусы, ключи и согласованность файлов; непригодный журнал не считается пустым черновиком. |
| `PostRecoveryJournal` | 369 | Revision comparison prevents another tab from overwriting a restored intent. |
| `PostRecoveryJournal.fileData` | 376 | Кешируем чтение неизменяемых File через WeakMap, чтобы текстовые checkpoint не перечитывали большие видео. |
| `PostRecoveryJournal.constructor` | 391 | Один журнал владеет слотом редактора конкретного аккаунта; очередь сериализует его локальные checkpoint. |
| `PostRecoveryJournal.key` | 396 | Формируем физический ключ IndexedDB из аккаунта и слота редактора. |
| `PostRecoveryJournal.assertOwner` | 400 | Локальный черновик нельзя читать или сохранять после смены personal-data владельца. |
| `PostRecoveryJournal.load` | 406 | Читаем старый или бинарный формат, восстанавливая alias-ссылки на общие файлы; до успешной проверки запись запрещена. |
| `PostRecoveryJournal.write` | 499 | Снимаем согласованную копию сейчас, затем сериализуем в очередь; optimistic revision не даёт другой вкладке затереть intent. |
| `PostRecoveryJournal.clear` | 665 | Закрываем очередь новым записям и удаляем только совпадающую ревизию после уже поставленных checkpoint. |

## [apps/frontend/src/domain/post/resolve-post-video.ts](../../../apps/frontend/src/domain/post/resolve-post-video.ts)

Модуль resolve-post-video.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `VIDEO_URL_RE` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PostMediaLike` | 8 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ResolvedPostVideo` | 14 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PostVideoSlide` | 21 | Контракт типов. Подробности и ограничения — в исходнике. |
| `isVideoMediaUrl` | 27 | Распознаём старые прямые файлы видео по расширению пути без query. |
| `resolvePostVideos` | 31 | Сначала сохраняем порядок video-вложений, затем добавляем отсутствующие legacy URL; приватное видео использует только собственный постер. |
| `resolvePostVideo` | 75 | Совместимым вызывающим возвращаем первое видео и тот же очищенный набор фотографий, не меняя правила общей обработки. |

## [apps/frontend/src/domain/post/save-post.ts](../../../apps/frontend/src/domain/post/save-post.ts)

Координатор сохраняет пост по этапам: файлы, запись и проверка результата. Контрольная точка удерживает исходные данные для восстановления.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PostPayload` | 35 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Payload` | 36 | Контракт типов. Подробности и ограничения — в исходнике. |
| `UploadedAttachment` | 37 | Контракт типов. Подробности и ограничения — в исходнике. |
| `SavePayload` | 40 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CreatePayload` | 46 | Контракт типов. Подробности и ограничения — в исходнике. |
| `UpdatePayload` | 47 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PostAttachment` | 48 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PostSaveApi` | 56 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PostSaveSnapshot` | 87 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PostSaveError` | 100 | Класс. Подробности и ограничения — в исходнике. |
| `PostSaveError.constructor` | 103 | Сохраняем признак неизвестного исхода и HTTP-статус исходной ошибки для безопасного решения редактора о повторе. |
| `PostSaveCoordinator` | 115 | Upload without binding files, then commit the whole post once. Never replay an unknown write. |
| `PostSaveCoordinator.constructor` | 132 | Фиксируем исходную редактируемую базу отдельной копией и её ревизию; новый пост начинается без ID. |
| `PostSaveCoordinator.snapshot` | 143 | Экспортируем фазу записи, ключ create и все квитанции, чтобы durable-журнал мог восстановить ту же операцию. |
| `PostSaveCoordinator.restore` | 160 | Восстанавливаем ровно старую базовую ревизию и фазу; незавершённая операция остаётся uncertain, а не готовой к новому save. |
| `PostSaveCoordinator.setCheckpoint` | 179 | Подключаем надёжное сохранение всего coordinator snapshot перед каждой внешней записью. |
| `PostSaveCoordinator.compareUpdate` | 184 | Читаем тот же пост и сверяем отправленные редактируемые поля; совпадение распознаёт commit после потери ответа без нового update. |
| `PostSaveCoordinator.acceptComparedRevision` | 215 | Новая база принимается только после явной сверки другого revision или подтверждённого конфликта; старый GET сам по себе не разрешает повтор. |
| `PostSaveCoordinator.remember` | 243 | Меняем фазу до checkpoint, чтобы после закрытия браузера журнал знал, какой запрос мог уже уйти. |
| `PostSaveCoordinator.recoverUploads` | 250 | Восстанавливаем только незавершённые закрытые файлы и постеры; итоговая запись поста остаётся отдельным явным действием. |
| `PostSaveCoordinator.uploadPrivate` | 294 | Сопоставляем квитанцию с исходным вложением, сохраняем ключ до POST и проверяем прежний status перед восстановлением. |
| `PostSaveCoordinator.recoverCreation` | 367 | Повторяем точный сохранённый create-payload прежним ключом; содержимое текущей формы не заменяет неизвестную запись. |
| `PostSaveCoordinator.assertCanClose` | 400 | Неподтверждённая запись поста не допускает обычного закрытия с потерей связи между черновиком и возможным commit. |
| `PostSaveCoordinator.save` | 408 | Проверяем доступность загрузок, готовим и подтверждаем файлы, затем один раз create/update с ревизией; успешный ACK делает координатор терминальным. |
| `PostSaveCoordinator.assertCanSave` | 662 | Закрываем повтор после завершения или неопределённого результата; иначе тот же coordinator мог бы привязать вложения второй раз. |
| `PostSaveCoordinator.withCreationKey` | 676 | Одинаковая definite-retry нагрузка сохраняет ключ create; новый ключ появляется только для нового подтверждённо допустимого intent. |
| `PostSaveCoordinator.assertUpdate` | 693 | Успешный транспорт подтверждает update только при явном success=true в теле ответа. |

## [apps/frontend/src/domain/post/text-limit.ts](../../../apps/frontend/src/domain/post/text-limit.ts)

Ограничение текста применяется к содержимому редактора, чтобы счётчик и проверка перед сохранением считали одинаково.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `POST_TEXT_MAX_BYTES` | 2 | Ограничение текста применяется к содержимому редактора, чтобы счётчик и проверка перед сохранением считали одинаково. |
| `assertPostTextSize` | 5 | Проверяем именно байты UTF-8 перед сохранением: число символов не соответствует ёмкости SQL TEXT. |

## [apps/frontend/src/domain/post/use-post-interactions.ts](../../../apps/frontend/src/domain/post/use-post-interactions.ts)

Модуль use-post-interactions.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `InteractionKind` | 28 | Контракт типов. Подробности и ограничения — в исходнике. |
| `usePostInteractions` | 30 | Согласуем пер-постовый кеш чтения и общие записи владельца; неизвестный исход toggle блокирует повтор до нового подтверждённого чтения. |

## [apps/frontend/src/domain/product/catalog.ts](../../../apps/frontend/src/domain/product/catalog.ts)

Каталог товаров хранится в сборке приложения; его изменение не является записью заказа или платёжной операцией.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ShelfProduct` | 3 | Каталог товаров хранится в сборке приложения; его изменение не является записью заказа или платёжной операцией. |
| `SHELF_PRODUCTS` | 18 | Полка хранит краткую презентацию товара; это редакционные данные сборки, а не синхронизация заказов. |
| `Product` | 96 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PRODUCT_DETAILS` | 121 | Детальная карточка содержит галереи, отзывы и исходные ссылки; тексты и цены здесь не определяют серверную оплату. |
| `PRODUCT_CATALOG` | 388 | Объединяем полку и подробности по общему ID, чтобы списки и детали использовали одну идентичность товара. |
| `getProduct` | 393 | Ищем детальную карточку по стабильному ID; отсутствие товара возвращается как undefined для проверки маршрутом. |

## [apps/frontend/src/domain/product/manager-order-email.ts](../../../apps/frontend/src/domain/product/manager-order-email.ts)

Подготавливаем письмо менеджеру с товаром и ссылкой; создание mailto не означает, что покупатель уже отправил заказ.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `managerOrderEmail` | 8 | Собираем mailto с проверенным получателем и канонической ссылкой товара на текущем origin; открытие письма ещё не подтверждает его отправку. |

## [apps/frontend/src/domain/profile/avatar-upload-journal.ts](../../../apps/frontend/src/domain/profile/avatar-upload-journal.ts)

Журнал аватара хранит исходную операцию загрузки и её подтверждение, чтобы потеря ответа не требовала нового файла.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `intentSchema` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `AvatarUploadIntent` | 20 | Контракт типов. Подробности и ограничения — в исходнике. |
| `receiptSchema` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `requireAvatarReceipt` | 38 | Валидируем состояния missing/pending/ready; готовый аватар обязан сообщать, применён ли он и является ли текущим. |
| `key` | 45 | Изолируем восстановление аватара аккаунтом, не сохраняя его в общем ключе устройства. |
| `storage` | 47 | Доступ к журналу разрешён только текущему personal-data владельцу. |
| `CorruptAvatarIntentError` | 53 | Класс. Подробности и ограничения — в исходнике. |
| `CorruptAvatarIntentError.constructor` | 56 | Сохраняем исходные повреждённые байты и, если возможно, прежний ключ для читающей проверки до удаления журнала. |
| `readAvatarIntent` | 81 | Читаем строгий intent своего аккаунта; повреждение возвращаем отдельной ошибкой с исходным содержимым, а не как пустой слот. |
| `discardCorruptAvatarIntent` | 93 | Удаляем только явно выбранную всё ещё повреждённую копию; исправленный или изменившийся журнал сохраняем. |
| `saveAvatarIntent` | 115 | Сохраняем точные подготовленные байты и ключ, не заменяя отличающееся старое намерение. |
| `removeAvatarIntent` | 124 | Удаляем только совпадающий idempotencyKey, чтобы поздний результат не стёр загрузку другой вкладки. |
| `avatarIntentUri` | 132 | Восстанавливаем локальный просмотр из сохранённых MIME и Base64 без сетевой загрузки. |

## [apps/frontend/src/domain/profile/profile-draft-review.module.scss](../../../apps/frontend/src/domain/profile/profile-draft-review.module.scss)

Оформление компонента: Сравнение локального черновика с актуальным профилем оставляет решение о замене данных пользователю.

## [apps/frontend/src/domain/profile/profile-draft-review.tsx](../../../apps/frontend/src/domain/profile/profile-draft-review.tsx)

Модуль profile-draft-review.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ProfileDraftReview` | 8 | Показываем текущую серверную базу рядом с локальным вводом; принять черновик можно только с известной ревизией. |

## [apps/frontend/src/domain/profile/profile-draft.ts](../../../apps/frontend/src/domain/profile/profile-draft.ts)

Снимки редактирования профиля привязаны к владельцу и базовой ревизии, а не к одному общему браузерному ключу.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CLUB_PROFILE_DRAFT_KEY` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PROFILE_NAME_DRAFT_KEY` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CLUB_PROFILE_PENDING_KEY` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PROFILE_NAME_PENDING_KEY` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LEGACY_PROFILE_NAME_KEY` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LEGACY_PROFILE_GENDER_KEY` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `gender` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `snapshot` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `values` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `draft` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ProfileSnapshot` | 30 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ProfileDraftValues` | 31 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ProfileDraft` | 32 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ProfileInput` | 33 | Контракт типов. Подробности и ограничения — в исходнике. |
| `profileSnapshot` | 36 | Фиксируем базовые редактируемые поля и ревизию; отсутствие revision сохраняем явно, не подставляя новую серверную базу. |
| `restoreProfileDraft` | 49 | Восстанавливаем только своего владельца; legacy-ввод сохраняем для явной сверки с revision=null, а неизвестную версию не затираем. |

## [apps/frontend/src/domain/profile/use-profile-avatar.ts](../../../apps/frontend/src/domain/profile/use-profile-avatar.ts)

Модуль use-profile-avatar.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uncertainMessage` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `storageMessage` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `State` | 34 | Контракт типов. Подробности и ограничения — в исходнике. |
| `useProfileAvatar` | 45 | Разделяем подготовку, загрузку и факт применения аватара; каждый поздний результат проверяет владельца и scope. Повтор сначала читает квитанцию и использует исходные байты с тем же ключом. |

## [apps/frontend/src/domain/profile/use-profile-update.ts](../../../apps/frontend/src/domain/profile/use-profile-update.ts)

Модуль use-profile-update.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PendingProfile` | 26 | Контракт типов. Подробности и ограничения — в исходнике. |
| `useProfileUpdate` | 29 | Отделяем редактируемый черновик от неподтверждённого write; все сохранения используют исходную ревизию и владельца. Неизвестный write сверяется свежим чтением. |

## [apps/frontend/src/domain/quiz/content/castlecore-result.ts](../../../apps/frontend/src/domain/quiz/content/castlecore-result.ts)

Тексты результата этой эстетики отделены от расчёта теста; открытая часть результата не должна служить источником закрытого гайда.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CASTLECORE_RESULT` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/domain/quiz/content/cottagecore-result.ts](../../../apps/frontend/src/domain/quiz/content/cottagecore-result.ts)

Тексты результата этой эстетики отделены от расчёта теста; открытая часть результата не должна служить источником закрытого гайда.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CottagecoreResultContent` | 3 | Тексты результата этой эстетики отделены от расчёта теста; открытая часть результата не должна служить источником закрытого гайда. |
| `COTTAGECORE_RESULT` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/domain/quiz/content/darkacademia-result.ts](../../../apps/frontend/src/domain/quiz/content/darkacademia-result.ts)

Тексты результата этой эстетики отделены от расчёта теста; открытая часть результата не должна служить источником закрытого гайда.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `DARK_ACADEMIA_RESULT` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/domain/quiz/content/fairycore-result.ts](../../../apps/frontend/src/domain/quiz/content/fairycore-result.ts)

Тексты результата этой эстетики отделены от расчёта теста; открытая часть результата не должна служить источником закрытого гайда.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `FAIRYCORE_RESULT` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/domain/quiz/content/goblincore-result.ts](../../../apps/frontend/src/domain/quiz/content/goblincore-result.ts)

Тексты результата этой эстетики отделены от расчёта теста; открытая часть результата не должна служить источником закрытого гайда.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `GOBLINCORE_RESULT` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/domain/quiz/content/lightacademia-result.ts](../../../apps/frontend/src/domain/quiz/content/lightacademia-result.ts)

Тексты результата этой эстетики отделены от расчёта теста; открытая часть результата не должна служить источником закрытого гайда.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `LIGHT_ACADEMIA_RESULT` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/domain/quiz/content/witchcore-result.ts](../../../apps/frontend/src/domain/quiz/content/witchcore-result.ts)

Тексты результата этой эстетики отделены от расчёта теста; открытая часть результата не должна служить источником закрытого гайда.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `WITCHCORE_RESULT` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/domain/quiz/quiz-data.ts](../../../apps/frontend/src/domain/quiz/quiz-data.ts)

Модуль quiz-data.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `AestheticKey` | 4 | Вопросы, варианты и подсчёт составляют общую модель теста; конкретная сетка задаётся данными каждого вопроса. |
| `QuestionType` | 12 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ScoreEntry` | 13 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Answer` | 17 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Question` | 24 | Контракт типов. Подробности и ограничения — в исходнике. |
| `AestheticResult` | 35 | Контракт типов. Подробности и ограничения — в исходнике. |
| `QuizResult` | 51 | Контракт типов. Подробности и ограничения — в исходнике. |
| `IMAGES` | 59 | Статические адреса бесплатного теста сгруппированы по визуальным вопросам; соответствие ключей баллам задаётся ниже в answers. |
| `QUESTIONS` | 118 | Порядок вопросов и ID ответов входят в fingerprint сохранённого прогресса; последний вопрос имеет повышенный вес 3 вместо 2. |
| `AESTHETIC_RESULTS` | 612 | Открытые описания результата доступны без подписки; они отделены от закрытых материалов полноценного гайда. |
| `createEmptyScores` | 767 | Создаём независимый набор нулевых баллов для каждого расчёта, не изменяя данные вопросов или предыдущего запуска. |
| `calculateResult` | 779 | Суммируем только известные ответы своих вопросов; разница лидеров до трёх баллов даёт смешанный результат, равенства сохраняют порядок ключей. |
| `AESTHETIC_NAMES` | 812 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/domain/quiz/quiz-progress.ts](../../../apps/frontend/src/domain/quiz/quiz-progress.ts)

Формат прогресса содержит ответы и метаданные запуска; проверка не допускает восстановления произвольного состояния вопросов.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `QUIZ_PROGRESS_KEY` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `questions` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `serializeQuizProgress` | 11 | Сохраняем ответы вместе с fingerprint набора вопросов; version=2 дополнительно несёт ID запуска и локальную ревизию. |
| `parseQuizProgress` | 25 | Принимаем только ограниченную запись текущего набора вопросов с допустимыми ответами и заполненной пройденной частью. |

## [apps/frontend/src/domain/quiz/quiz-state.ts](../../../apps/frontend/src/domain/quiz/quiz-state.ts)

Модуль quiz-state.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `QuizPhase` | 10 | Контракт типов. Подробности и ограничения — в исходнике. |
| `QuizState` | 11 | Контракт типов. Подробности и ограничения — в исходнике. |
| `initialState` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `QuizAction` | 25 | Контракт типов. Подробности и ограничения — в исходнике. |
| `quizReducer` | 48 | Чисто переключаем welcome/question/result и выбранные ответы; переход после последнего вопроса вычисляет результат общей моделью. |
| `QuizContextValue` | 85 | Контракт типов. Подробности и ограничения — в исходнике. |
| `QuizContext` | 89 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `useQuiz` | 91 | Получаем состояние общего запуска и dispatch, не создавая второй независимый reducer на экране. |

## [apps/frontend/src/domain/quiz/quiz-storage-lock.ts](../../../apps/frontend/src/domain/quiz/quiz-storage-lock.ts)

Межвкладочная блокировка координирует запись теста одного владельца; она не заменяет проверку актуальной версии данных.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `withQuizStorageLock` | 3 | Сериализуем синхронную read/compare/write работу одного владельца через Web Locks или readwrite IndexedDB fallback. |

## [apps/frontend/src/domain/quiz/saved-result.ts](../../../apps/frontend/src/domain/quiz/saved-result.ts)

Сохранённый результат теста читаем как недоверенные локальные данные и сверяем с известными эстетиками.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `key` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `score` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `saved` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `parseSavedQuizResult` | 37 | Восстанавливаем только проверенные ключи эстетик и баллы; подписи и тексты заново берём из текущей модели, а не из localStorage. |

## [apps/frontend/src/domain/session/admin-action-journal.ts](../../../apps/frontend/src/domain/session/admin-action-journal.ts)

Журнал связывает административную операцию с владельцем и ключом; восстановление читает её квитанцию до новой записи.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `schema` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `AdminActionIntent` | 34 | Контракт типов. Подробности и ограничения — в исходнике. |
| `adminActionStorageKey` | 36 | Привязываем журнал команд к действующему администратору и версии формата. |
| `AdminActionJournalError` | 38 | Класс. Подробности и ограничения — в исходнике. |
| `storageError` | 40 | Недоступное или повреждённое хранилище запрещает новую команду без восстанавливаемого ключа. |
| `changedError` | 45 | Изменившийся журнал нельзя заменить новым намерением, пока исход прежней операции не выяснен. |
| `AdminActionJournal` | 51 | One durable intent per actor; only navigation-safe metadata, never email or tokens. |
| `AdminActionJournal.constructor` | 53 | Фиксируем владельца, API и уведомление о checkpoint; сам конструктор не читает сеть или storage. |
| `AdminActionJournal.assertOwner` | 59 | Проверяем отмену и персонального владельца до чтения/записи, чтобы другая сессия не продолжила старое действие. |
| `AdminActionJournal.read` | 64 | Читаем ограниченный strict-формат журнала только своего владельца; повреждение не трактуем как отсутствие намерения. |
| `AdminActionJournal.persist` | 82 | Сохраняем проверенный intent и читаем его обратно до checkpoint; сбой хранения прерывает сетевую команду. |
| `AdminActionJournal.locked` | 101 | Web Lock сериализует вкладки владельца; предел 5 секунд относится к ожиданию lock, работа внутри использует исходный signal. |
| `AdminActionJournal.current` | 130 | Сверяем прочитанный журнал с известным ключом/операцией; потеря уже известного intent считается конфликтом. |
| `AdminActionJournal.inspect` | 142 | Читаем статус прежнего ключа без отправки; подтверждённый outcome не может исчезнуть или поменяться. |
| `AdminActionJournal.send` | 164 | Фиксируем attempted до write и соблюдаем cooldown писем; бизнес-отказ проверяем читающим статусом на наличие durable-квитанции. |
| `AdminActionJournal.check` | 203 | Под lock перечитываем журнал и статус, не повторяя запись или отправку письма. |
| `AdminActionJournal.start` | 210 | Новое намерение допустимо только после явного подтверждения прежнего завершённого ключа; появившуюся в другой вкладке операцию сначала возвращаем владельцу. |
| `AdminActionJournal.replay` | 245 | Повторяем только прежний ключ после чтения статуса; уже завершённый outcome возвращаем без новой записи. |

## [apps/frontend/src/domain/session/background-check-notice.tsx](../../../apps/frontend/src/domain/session/background-check-notice.tsx)

Модуль background-check-notice.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BackgroundCheckNotice` | 8 | Регистрируем независимые фоновые ошибки сессии и подписки с приоритетами, оставляя подтверждённый контент на экране. |

## [apps/frontend/src/domain/session/consent-texts.ts](../../../apps/frontend/src/domain/session/consent-texts.ts)

Версии и формулировки согласий берём из общего пакета, чтобы форма и отправляемое значение относились к одному документу.

## [apps/frontend/src/domain/session/phone.ts](../../../apps/frontend/src/domain/session/phone.ts)

Форматирование номера для интерфейса отделено от серверной проверки и подтверждения владения телефоном.

## [apps/frontend/src/domain/session/session-context.tsx](../../../apps/frontend/src/domain/session/session-context.tsx)

Модуль session-context.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `SESSION_EVENT_KEY` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LOGOUT_PENDING_KEY` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `RESUME_CHECK_COOLDOWN_MS` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `logoutIsPending` | 33 | Читаем общий маркер незавершённого выхода; недоступное localStorage не мешает памяти текущего контроллера. |
| `SessionContext` | 40 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Context` | 64 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `AuthProvider` | 66 | Связываем контроллер с cookie API, QueryClient, владельцем storage и событиями вкладок; scope меняет React-идентичность персональных экранов. |
| `useAuth` | 203 | Возвращаем уже управляемую провайдером сессию; совместимый autoFetch здесь не создаёт отдельного запроса. |

## [apps/frontend/src/domain/session/session-controller.ts](../../../apps/frontend/src/domain/session/session-controller.ts)

Контроллер разделяет проверку, вход и выход; номер операции не позволяет позднему ответу вернуть прежний аккаунт.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `SessionStatus` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `SessionState` | 16 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Dependencies` | 23 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ConfirmedProfilePatch` | 30 | Контракт типов. Подробности и ограничения — в исходнике. |
| `SessionController` | 35 | Owns ordering of identity operations independently of screen mounting and query refetches. |
| `SessionController.constructor` | 50 | Получаем побочные действия извне: контроллер упорядочивает сессию без зависимости от React и QueryClient. |
| `SessionController.publish` | 61 | Сначала заменяем состояние, затем уведомляем слушателей о согласованном snapshot. |
| `SessionController.begin` | 67 | Отзываем предыдущий сетевой сигнал и выдаём номер поколения, которым проверяются все поздние ответы. |
| `SessionController.commit` | 73 | Подтверждаем личность вместе с ролью; смена владельца сбрасывает приватные данные, scope пересоздаёт связанные экраны. |

## [apps/frontend/src/domain/session/session-status.tsx](../../../apps/frontend/src/domain/session/session-status.tsx)

Модуль session-status.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `SessionStatus` | 8 | Различаем повтор проверки и повтор незавершённого выхода; ошибку сессии не подменяем предложением входа гостю. |

## [apps/frontend/src/domain/session/storage.ts](../../../apps/frontend/src/domain/session/storage.ts)

Модуль storage.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `User` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `clearPersonalCache` | 15 | Удаляем известные старые персональные ключи; scoped-журналы нового формата управляют своей очисткой отдельно. |

## [apps/frontend/src/domain/session/use-confirmed-action.ts](../../../apps/frontend/src/domain/session/use-confirmed-action.ts)

Модуль use-confirmed-action.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `UnknownAction` | 10 | Контракт типов. Подробности и ограничения — в исходнике. |
| `useConfirmedAction` | 17 | Сериализуем запись в пределах сессии и экрана; неизвестный исход блокирует следующую команду до отдельного чтения или явного отказа. |

## [apps/frontend/src/domain/session/use-session-operation.ts](../../../apps/frontend/src/domain/session/use-session-operation.ts)

Модуль use-session-operation.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `useSessionOperation` | 12 | Один scope принадлежит экземпляру hook, активности, ключу объекта и пользователю; их смена отзывает право позднего ответа менять экран. |
| `checkOperationAccessError` | 40 | Ошибка доступа прямого отменяемого вызова инициирует общую перепроверку сессии так же, как tRPC middleware. |

## [apps/frontend/src/domain/subscription/subscription-context.tsx](../../../apps/frontend/src/domain/subscription/subscription-context.tsx)

Модуль subscription-context.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `SubscriptionStatus` | 17 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ClubContextType` | 23 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ClubContext` | 38 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ClubProvider` | 40 | Разделяем платную подписку и служебный доступ; подтверждённое состояние переживает временный фоновой сбой, но срок локально не продлевается. |
| `useClub` | 160 | Получаем единый статус прав из провайдера; экран не создаёт собственную трактовку подписки. |

## [apps/frontend/src/domain/subscription/subscription-status.tsx](../../../apps/frontend/src/domain/subscription/subscription-status.tsx)

Модуль subscription-status.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `SubscriptionStatus` | 7 | Отображаем проверку и ошибку прав отдельно от подтверждённого отсутствия подписки; повтор читает сервер заново. |

## [apps/frontend/src/features/admin/admin-action-recovery-notice.tsx](../../../apps/frontend/src/features/admin/admin-action-recovery-notice.tsx)

Модуль admin-action-recovery-notice.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `AdminActionRecoveryNotice` | 6 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/admin-fab.content.ts](../../../apps/frontend/src/features/admin/admin-fab.content.ts)

Ресурсы и подписи быстрого меню администратора отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ACCENT` | 3 | Ресурсы и подписи быстрого меню администратора отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `CREAM_BG` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/admin-fab.module.scss](../../../apps/frontend/src/features/admin/admin-fab.module.scss)

Оформление компонента: Быстрые административные действия доступны из общего плавающего меню и передают создание материалов отдельным редакторам.

## [apps/frontend/src/features/admin/admin-fab.tsx](../../../apps/frontend/src/features/admin/admin-fab.tsx)

Модуль admin-fab.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CreatePostModal` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Target` | 15 | Контракт типов. Подробности и ограничения — в исходнике. |
| `AdminFABProps` | 16 | Контракт типов. Подробности и ограничения — в исходнике. |
| `AdminFAB` | 19 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/admin-post-editor.tsx](../../../apps/frontend/src/features/admin/admin-post-editor.tsx)

Модуль admin-post-editor.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `formForPost` | 72 | Функция. Подробности и ограничения — в исходнике. |
| `AdminPostEditorProps` | 101 | Контракт типов. Подробности и ограничения — в исходнике. |
| `AdminPostEditor` | 109 | A different account must never inherit the previous editor's File/coordinator state. |
| `AdminPostEditorBody` | 122 | Own the editor state so typing never renders the admin lists or tabs. |

## [apps/frontend/src/features/admin/admin-screen.content.ts](../../../apps/frontend/src/features/admin/admin-screen.content.ts)

Ресурсы и подписи общей админки отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CREAM_BG` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_DARK` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_LIGHT` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `GREEN_ACCENT` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ALL_TAGS` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PostFormData` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `EMPTY_FORM` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/admin-screen.layout.ts](../../../apps/frontend/src/features/admin/admin-screen.layout.ts)

Геометрия общей админки рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getAdminScreenLayout` | 4 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/admin-screen.module.scss](../../../apps/frontend/src/features/admin/admin-screen.module.scss)

Оформление компонента: Административные вкладки включают только нужные чтения.

## [apps/frontend/src/features/admin/admin-screen.tsx](../../../apps/frontend/src/features/admin/admin-screen.tsx)

Модуль admin-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `AdminScreen` | 64 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/article-catalog.tsx](../../../apps/frontend/src/features/admin/article-catalog.tsx)

Модуль article-catalog.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ArticleCatalogProps` | 12 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ArticleCatalog` | 22 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/article-draft-restoration.ts](../../../apps/frontend/src/features/admin/article-draft-restoration.ts)

Восстановление черновика статьи возвращает поля, файлы и базовую ревизию как один согласованный снимок.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ArticleRestoreForm` | 11 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ArticleDraftRestorationDependencies` | 31 | Контракт типов. Подробности и ограничения — в исходнике. |
| `createArticleDraftRestoration` | 45 | Restore each durable source separately; file URLs are attached by the editor effect. |

## [apps/frontend/src/features/admin/article-editor-exit.ts](../../../apps/frontend/src/features/admin/article-editor-exit.ts)

Уход из редактора различает локальный черновик и отправленную операцию; очистка одного не отменяет запись на сервере.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ArticleEditorExitDependencies` | 13 | Контракт типов. Подробности и ограничения — в исходнике. |
| `createArticleEditorExit` | 27 | Keep completion, cancellation and explicit discard as distinct ordered paths. |

## [apps/frontend/src/features/admin/article-revision-actions.ts](../../../apps/frontend/src/features/admin/article-revision-actions.ts)

Сверка ревизий отделяет просмотр сервера от решения заменить локальный ввод; подтверждённое сохранение очищает только свою операцию.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ArticleRevisionDependencies` | 28 | Контракт типов. Подробности и ограничения — в исходнике. |
| `createArticleRevisionActions` | 68 | Compare without replaying; acceptance durably prepares a later explicit save. |

## [apps/frontend/src/features/admin/articles-admin.content.ts](../../../apps/frontend/src/features/admin/articles-admin.content.ts)

Ресурсы и подписи редактора статей отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BROWN` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_LIGHT` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ACCENT` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ADD_BLOCKS` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BLOCK_LABELS` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/articles-admin.module.scss](../../../apps/frontend/src/features/admin/articles-admin.module.scss)

Оформление компонента: Редактор статей отделяет черновик, создание, загрузку файлов и ревизию серверного материала.

## [apps/frontend/src/features/admin/articles-admin.tsx](../../../apps/frontend/src/features/admin/articles-admin.tsx)

Модуль articles-admin.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Access` | 79 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ArticlesAdmin` | 80 | Функция. Подробности и ограничения — в исходнике. |
| `ArticleEditor` | 86 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/calendar-tracker.content.ts](../../../apps/frontend/src/features/admin/calendar-tracker.content.ts)

Ресурсы и подписи календаря публикаций отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CREAM_BG` | 2 | Ресурсы и подписи календаря публикаций отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `BROWN_DARK` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_LIGHT` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ACCENT` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `OLIVE` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `WEEKDAYS` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `MONTHS_RU` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/calendar-tracker.module.scss](../../../apps/frontend/src/features/admin/calendar-tracker.module.scss)

Оформление компонента: Календарь запрашивает отдельные дневные агрегаты и отложенные записи, не загружая весь каталог постов.

## [apps/frontend/src/features/admin/calendar-tracker.tsx](../../../apps/frontend/src/features/admin/calendar-tracker.tsx)

Модуль calendar-tracker.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ScheduledPost` | 20 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CalendarDay` | 21 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CalendarTrackerProps` | 22 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CalendarTracker` | 27 | Функция. Подробности и ограничения — в исходнике. |
| `MonthGrid` | 265 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/create-post-modal.content.ts](../../../apps/frontend/src/features/admin/create-post-modal.content.ts)

Ресурсы и подписи быстрого редактора постов отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CREAM_BG` | 3 | Ресурсы и подписи быстрого редактора постов отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `BROWN_DARK` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_LIGHT` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ACCENT` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `OLIVE` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/create-post-modal.module.scss](../../../apps/frontend/src/features/admin/create-post-modal.module.scss)

Оформление компонента: Быстрый редактор использует общий координатор поста, сохраняя свой слот черновика и выбранные вложения.

## [apps/frontend/src/features/admin/create-post-modal.tsx](../../../apps/frontend/src/features/admin/create-post-modal.tsx)

Модуль create-post-modal.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PostTarget` | 56 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PostStatus` | 57 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CreatePostModalProps` | 58 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CreatePostModal` | 83 | Функция. Подробности и ограничения — в исходнике. |
| `CreatePostModalBody` | 94 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/edit-comparison.tsx](../../../apps/frontend/src/features/admin/edit-comparison.tsx)

Модуль edit-comparison.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `labels` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `display` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `EditComparison` | 65 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/editor-range-change.ts](../../../apps/frontend/src/features/admin/editor-range-change.ts)

Изменение выделения передаётся форматирующим инструментам в координатах текста, а не DOM-разметки.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `TextEditHint` | 2 | Изменение выделения передаётся форматирующим инструментам в координатах текста, а не DOM-разметки. |
| `Range` | 3 | Контракт типов. Подробности и ограничения — в исходнике. |
| `resolveChange` | 6 | Prefer the actual native edit over a text diff, which is ambiguous for repeats. |
| `adjustEditorRanges` | 51 | Функция. Подробности и ограничения — в исходнике. |
| `createEditorRangeAdjuster` | 63 | Find the edit once for all formatting ranges, and skip unformatted text. |

## [apps/frontend/src/features/admin/highlighted-text-input.tsx](../../../apps/frontend/src/features/admin/highlighted-text-input.tsx)

Модуль highlighted-text-input.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `LinkRange` | 14 | Контракт типов. Подробности и ограничения — в исходнике. |
| `HighlightedTextInput` | 17 | Keep native mobile typing/selection; paint links beneath the transparent text. |

## [apps/frontend/src/features/admin/media/private-video-upload.ts](../../../apps/frontend/src/features/admin/media/private-video-upload.ts)

Модуль private-video-upload.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uploadAdminPrivateVideo` | 19 | No base64/public URL/retry: the save coordinator owns this stable-key intent. |

## [apps/frontend/src/features/admin/media/video-upload.ts](../../../apps/frontend/src/features/admin/media/video-upload.ts)

Модуль video-upload.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `UPLOAD_TIMEOUT_MS` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `uploadAdminVideoBlob` | 18 | Функция. Подробности и ограничения — в исходнике. |
| `uploadAdminVideoFromUri` | 92 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/member-access-email.tsx](../../../apps/frontend/src/features/admin/member-access-email.tsx)

Модуль member-access-email.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `MemberAccessEmail` | 11 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/photo-editor-tiles.module.scss](../../../apps/frontend/src/features/admin/photo-editor-tiles.module.scss)

Плитки редактора фотографий отделяют изображение от действий выбора, удаления и перестановки.

## [apps/frontend/src/features/admin/photo-editor.content.ts](../../../apps/frontend/src/features/admin/photo-editor.content.ts)

Ресурсы и подписи редактора фотографий отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `GAP` | 2 | Ресурсы и подписи редактора фотографий отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `LONG_PRESS_MS` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `WEB_NO_CALLOUT` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/photo-editor.module.scss](../../../apps/frontend/src/features/admin/photo-editor.module.scss)

Оформление компонента: Редактирование выбранных фотографий сохраняет исходный набор до явного применения результата.

## [apps/frontend/src/features/admin/photo-editor.tsx](../../../apps/frontend/src/features/admin/photo-editor.tsx)

Модуль photo-editor.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `TileRect` | 28 | Контракт типов. Подробности и ограничения — в исходнике. |
| `webBlockImageMenu` | 34 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PhotoEditorProps` | 49 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PhotoEditor` | 57 | Функция. Подробности и ограничения — в исходнике. |
| `PhotoControls` | 404 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/post-attachments-field.module.scss](../../../apps/frontend/src/features/admin/post-attachments-field.module.scss)

Оформление компонента: Поля вложений показывают отдельно локальные файлы и уже сохранённые элементы, передавая изменения владельцу редактора.

## [apps/frontend/src/features/admin/post-attachments-field.tsx](../../../apps/frontend/src/features/admin/post-attachments-field.tsx)

Модуль post-attachments-field.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ListProps` | 10 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PostAttachmentsList` | 15 | Функция. Подробности и ограничения — в исходнике. |
| `PostAttachmentsField` | 54 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/post-editor-api.ts](../../../apps/frontend/src/features/admin/post-editor-api.ts)

Общий транспорт двух редакторов не владеет их черновиками; каждый вызов получает сигнал соответствующей операции.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `createPostEditorApi` | 11 | Shared transport only; each editor keeps its own session and recovery state. |

## [apps/frontend/src/features/admin/post-editor-tags.tsx](../../../apps/frontend/src/features/admin/post-editor-tags.tsx)

Модуль post-editor-tags.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `variants` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PostEditorTags` | 45 | Text/caret updates must not rebuild all the tag buttons. |

## [apps/frontend/src/features/admin/post-management.content.ts](../../../apps/frontend/src/features/admin/post-management.content.ts)

Ресурсы и подписи действий над постом отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CREAM_BG` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_DARK` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_LIGHT` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `GREEN_ACCENT` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ALL_TAGS` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/post-management.module.scss](../../../apps/frontend/src/features/admin/post-management.module.scss)

Оформление компонента: Действия над постом из карточки читают серверную версию и используют общий редактор, сохраняя состояние списка владельцу экрана.

## [apps/frontend/src/features/admin/post-management.tsx](../../../apps/frontend/src/features/admin/post-management.tsx)

Модуль post-management.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CreatePostModal` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PostData` | 26 | Контракт типов. Подробности и ограничения — в исходнике. |
| `MenuAction` | 49 | Контракт типов. Подробности и ограничения — в исходнике. |
| `tagDraftKey` | 50 | Функция. Подробности и ограничения — в исходнике. |
| `ActionSheet` | 52 | Функция. Подробности и ограничения — в исходнике. |
| `TagSelectionModal` | 169 | Функция. Подробности и ограничения — в исходнике. |
| `usePostManagement` | 385 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/post-recovery-notice.tsx](../../../apps/frontend/src/features/admin/post-recovery-notice.tsx)

Модуль post-recovery-notice.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PostRecoveryNotice` | 11 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/post-upload-status.tsx](../../../apps/frontend/src/features/admin/post-upload-status.tsx)

Модуль post-upload-status.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PostUploadStatus` | 10 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/recover-article-creation.ts](../../../apps/frontend/src/features/admin/recover-article-creation.ts)

Восстановление сначала проверяет исходную операцию создания и её файлы, чтобы не создавать вторую статью после потери ответа.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ArticleRecoveryDependencies` | 24 | Контракт типов. Подробности и ограничения — в исходнике. |
| `recoverArticleCreation` | 48 | Check before replay; retain the original operation until completion is confirmed. |

## [apps/frontend/src/features/admin/rich-text-field.content.ts](../../../apps/frontend/src/features/admin/rich-text-field.content.ts)

Ресурсы и подписи поля форматированного текста отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BROWN_DARK` | 3 | Ресурсы и подписи поля форматированного текста отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `BROWN_LIGHT` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ACCENT` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM_BG` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/rich-text-field.module.scss](../../../apps/frontend/src/features/admin/rich-text-field.module.scss)

Оформление компонента: Поле форматированного текста хранит текст и диапазоны, согласуя выделение с кнопками и предпросмотром.

## [apps/frontend/src/features/admin/rich-text-field.tsx](../../../apps/frontend/src/features/admin/rich-text-field.tsx)

Модуль rich-text-field.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `RichTextFieldHandle` | 21 | Контракт типов. Подробности и ограничения — в исходнике. |
| `RichTextFieldProps` | 25 | Контракт типов. Подробности и ограничения — в исходнике. |
| `RichTextField` | 33 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/schedule-datetime.content.ts](../../../apps/frontend/src/features/admin/schedule-datetime.content.ts)

Ресурсы и подписи выбора времени публикации отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BROWN` | 3 | Ресурсы и подписи выбора времени публикации отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `ACCENT` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/schedule-datetime.module.scss](../../../apps/frontend/src/features/admin/schedule-datetime.module.scss)

Оформление компонента: Выбор отложенного времени преобразует локальные поля даты в значение редактора и показывает состояние планирования.

## [apps/frontend/src/features/admin/schedule-datetime.tsx](../../../apps/frontend/src/features/admin/schedule-datetime.tsx)

Модуль schedule-datetime.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `pad` | 7 | Функция. Подробности и ограничения — в исходнике. |
| `toDatetimeLocalValue` | 12 | Функция. Подробности и ограничения — в исходнике. |
| `atHour` | 17 | Функция. Подробности и ограничения — в исходнике. |
| `ScheduleDatetimeProps` | 24 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ScheduleDatetime` | 30 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/season-settings.tsx](../../../apps/frontend/src/features/admin/season-settings.tsx)

Модуль season-settings.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `readSettings` | 37 | Функция. Подробности и ограничения — в исходнике. |
| `validationMessage` | 41 | Функция. Подробности и ограничения — в исходнике. |
| `SeasonEditor` | 66 | Функция. Подробности и ограничения — в исходнике. |
| `sameLaunchConfigurationSafe` | 392 | Функция. Подробности и ограничения — в исходнике. |
| `SeasonSettings` | 404 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/stats-dashboard.content.ts](../../../apps/frontend/src/features/admin/stats-dashboard.content.ts)

Ресурсы и подписи статистики отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CREAM_BG` | 3 | Ресурсы и подписи статистики отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `BROWN_DARK` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_LIGHT` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ACCENT` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/stats-dashboard.module.scss](../../../apps/frontend/src/features/admin/stats-dashboard.module.scss)

Оформление компонента: Статистика админки загружается своим запросом вместо вычисления по полному набору постов в браузере.

## [apps/frontend/src/features/admin/stats-dashboard.tsx](../../../apps/frontend/src/features/admin/stats-dashboard.tsx)

Модуль stats-dashboard.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `StatsDashboard` | 10 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/use-access-email-resend.ts](../../../apps/frontend/src/features/admin/use-access-email-resend.ts)

Модуль use-access-email-resend.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `AccessEmailMember` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `AccessEmailResult` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `canResendAccessEmail` | 12 | Функция. Подробности и ограничения — в исходнике. |
| `useAccessEmailResend` | 24 | Kept above the members tab: a fresh list cannot verify email enqueueing. |

## [apps/frontend/src/features/admin/use-admin-action-recovery.ts](../../../apps/frontend/src/features/admin/use-admin-action-recovery.ts)

Модуль use-admin-action-recovery.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `State` | 26 | Контракт типов. Подробности и ограничения — в исходнике. |
| `adminReceiptKey` | 34 | Функция. Подробности и ограничения — в исходнике. |
| `useAdminActionRecovery` | 37 | Функция. Подробности и ограничения — в исходнике. |
| `AdminActionRecovery` | 235 | Контракт типов. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/use-article-catalog.ts](../../../apps/frontend/src/features/admin/use-article-catalog.ts)

Модуль use-article-catalog.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `useArticleCatalog` | 9 | Функция. Подробности и ограничения — в исходнике. |
| `ArticleCatalogState` | 63 | Контракт типов. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/use-article-cover.ts](../../../apps/frontend/src/features/admin/use-article-cover.ts)

Модуль use-article-cover.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `useArticleCover` | 20 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/use-article-creation-journal.ts](../../../apps/frontend/src/features/admin/use-article-creation-journal.ts)

Модуль use-article-creation-journal.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `useArticleCreationJournal` | 10 | Own journal loading and its retry state for the editor's mounted account. |

## [apps/frontend/src/features/admin/use-article-draft.ts](../../../apps/frontend/src/features/admin/use-article-draft.ts)

Модуль use-article-draft.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `useArticleDraft` | 15 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/use-article-files.ts](../../../apps/frontend/src/features/admin/use-article-files.ts)

Модуль use-article-files.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `empty` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `documentTypes` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `useArticleFiles` | 21 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/use-post-attachments.ts](../../../apps/frontend/src/features/admin/use-post-attachments.ts)

Модуль use-post-attachments.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ExistingMedia` | 19 | Контракт типов. Подробности и ограничения — в исходнике. |
| `DOCUMENT_TYPES` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `usePostAttachments` | 33 | Both editors keep File objects until the shared save coordinator reads them. |

## [apps/frontend/src/features/admin/use-post-edit-comparison.tsx](../../../apps/frontend/src/features/admin/use-post-edit-comparison.tsx)

Модуль use-post-edit-comparison.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `usePostEditComparison` | 15 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/use-post-recovery.ts](../../../apps/frontend/src/features/admin/use-post-recovery.ts)

Модуль use-post-recovery.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `usePostRecovery` | 22 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/use-post-upload-selection.ts](../../../apps/frontend/src/features/admin/use-post-upload-selection.ts)

Модуль use-post-upload-selection.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PendingUpload` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `unresolved` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `usePostUploadSelection` | 12 | A selected file is not an empty media list, even when its upload failed. |

## [apps/frontend/src/features/admin/use-private-post-photos.ts](../../../apps/frontend/src/features/admin/use-private-post-photos.ts)

Модуль use-private-post-photos.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `empty` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PhotoScope` | 14 | Контракт типов. Подробности и ограничения — в исходнике. |
| `usePrivatePostPhotos` | 21 | Blob URLs belong to this editor/account only; durable records contain File bytes, never URLs. |

## [apps/frontend/src/features/admin/use-private-post-videos.ts](../../../apps/frontend/src/features/admin/use-private-post-videos.ts)

Модуль use-private-post-videos.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `preparePrivatePostVideo` | 15 | Функция. Подробности и ограничения — в исходнике. |
| `empty` | 47 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `VideoScope` | 48 | Контракт типов. Подробности и ограничения — в исходнике. |
| `usePrivatePostVideos` | 57 | Only optional preview URLs are temporary. Original File/key pairs go to the journal. |

## [apps/frontend/src/features/admin/use-rich-text-formatting.ts](../../../apps/frontend/src/features/admin/use-rich-text-formatting.ts)

Модуль use-rich-text-formatting.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `countLinks` | 24 | Функция. Подробности и ограничения — в исходнике. |
| `Selection` | 44 | Контракт типов. Подробности и ограничения — в исходнике. |
| `useRichTextFormatting` | 48 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/vk-catalog-admin.tsx](../../../apps/frontend/src/features/admin/vk-catalog-admin.tsx)

Модуль vk-catalog-admin.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `VkCatalogAdmin` | 35 | Функция. Подробности и ограничения — в исходнике. |
| `Editor` | 41 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/vk-editor-draft.ts](../../../apps/frontend/src/features/admin/vk-editor-draft.ts)

Черновик каталожного VK-ролика хранит базовую ревизию и исходные поля для сравнения после конфликта или потери ответа.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `detail` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `payloadSchema` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `schema` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `VkEditorDraft` | 64 | Контракт типов. Подробности и ограничения — в исходнике. |
| `VkEditorPayload` | 65 | Контракт типов. Подробности и ограничения — в исходнике. |
| `vkEditorDraftKey` | 74 | Функция. Подробности и ограничения — в исходнике. |
| `emptyVkEditorDraft` | 76 | Функция. Подробности и ограничения — в исходнике. |
| `VkEditorDraftStore` | 98 | Tab-local storage survives reload without allowing another tab to replace this draft. |
| `VkEditorDraftStore.constructor` | 99 | Настройка зависимостей. Подробности и ограничения — в исходнике. |
| `VkEditorDraftStore.assertOwner` | 102 | Метод. Подробности и ограничения — в исходнике. |
| `VkEditorDraftStore.read` | 108 | Метод. Подробности и ограничения — в исходнике. |
| `VkEditorDraftStore.save` | 125 | Метод. Подробности и ограничения — в исходнике. |
| `draftFromVkDetail` | 145 | Функция. Подробности и ограничения — в исходнике. |
| `vkEditorPayload` | 163 | Функция. Подробности и ограничения — в исходнике. |
| `reviewVkDraft` | 203 | Reading a newer version never silently changes the version being edited. |
| `reconcileVkDraft` | 212 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/admin/vk-video-field.module.scss](../../../apps/frontend/src/features/admin/vk-video-field.module.scss)

Оформление компонента: Добавление VK-ссылки проверяет экспортируемый адрес и дубли.

## [apps/frontend/src/features/admin/vk-video-field.tsx](../../../apps/frontend/src/features/admin/vk-video-field.tsx)

Модуль vk-video-field.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `VkVideoField` | 11 | Uses the existing videos[] draft/write path; adding a link never uploads a file. |
| `VkVideoPreviewButton` | 123 | Функция. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/auth/login-screen.content.ts](../../../apps/frontend/src/features/auth/login-screen.content.ts)

Ресурсы и подписи формы email-входа отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 2 | Ресурсы и подписи формы email-входа отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `BROWN` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `OLIVE` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/auth/login-screen.module.scss](../../../apps/frontend/src/features/auth/login-screen.module.scss)

Оформление компонента: Вход, регистрация и запрос восстановления используют разные REST-действия.

## [apps/frontend/src/features/auth/login-screen.tsx](../../../apps/frontend/src/features/auth/login-screen.tsx)

Модуль login-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Mode` | 41 | Контракт типов. Подробности и ограничения — в исходнике. |
| `LoginScreen` | 43 | Управляем email-входом, регистрацией и запросом письма раздельно; до готовности JS и окончания предыдущего запроса повтор заблокирован. |

## [apps/frontend/src/features/auth/password-screen.module.scss](../../../apps/frontend/src/features/auth/password-screen.module.scss)

Оформление компонента: Экран установки пароля использует одноразовый токен письма и проверяет результат до перехода к обычному входу.

## [apps/frontend/src/features/auth/password-screen.tsx](../../../apps/frontend/src/features/auth/password-screen.tsx)

Модуль password-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Phase` | 20 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PasswordScreen` | 23 | Одноразовый proof живёт только в ref, сразу удаляется из адреса; неизвестный результат не повторяем автоматически. |

## [apps/frontend/src/features/auth/sms-code-form.content.ts](../../../apps/frontend/src/features/auth/sms-code-form.content.ts)

Ресурсы и подписи формы SMS-входа отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BROWN` | 2 | Ресурсы и подписи формы SMS-входа отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `BROWN_MUTED` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `OLIVE` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/auth/sms-code-form.module.scss](../../../apps/frontend/src/features/auth/sms-code-form.module.scss)

Оформление компонента: Условный SMS-вход хранит номер, код и задержку повтора отдельно от email-формы.

## [apps/frontend/src/features/auth/sms-code-form.tsx](../../../apps/frontend/src/features/auth/sms-code-form.tsx)

Модуль sms-code-form.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Props` | 19 | Контракт типов. Подробности и ограничения — в исходнике. |
| `SmsCodeForm` | 24 | Совместимая SMS-форма отделяет отправку кода от подтверждения; видимость функции управляется capabilities родительского экрана. |

## [apps/frontend/src/features/club/checkout-form.tsx](../../../apps/frontend/src/features/club/checkout-form.tsx)

Модуль checkout-form.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ClubCheckoutAttempt` | 18 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ClubTestCheckoutForm` | 23 | Покупку TEST запускаем только после проверки прежнего намерения; сессия, видимость и выбранный получатель ограничивают право на поздний redirect. |
| `submit` | 86 | Сначала сбрасываем показанное доказательство и резервируем ключ, затем проверяем ответ и актуальность экрана до перехода к провайдеру. |

## [apps/frontend/src/features/club/checkout-intent.ts](../../../apps/frontend/src/features/club/checkout-intent.ts)

Намерение покупки сохраняет исходные параметры и ключ до сетевого вызова; восстановление не должно менять получателя или режим оплаты.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `storageKey` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `lockWaitMs` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `selectionSchema` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `recordSchema` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `messages` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CheckoutIntentError` | 37 | Класс. Подробности и ограничения — в исходнике. |
| `CheckoutIntentError.constructor` | 39 | Сохраняем машинную причину ошибки вместе с безопасным сообщением без подробностей browser storage. |
| `ClubCheckoutSelection` | 45 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ClubCheckoutIntent` | 50 | Контракт типов. Подробности и ограничения — в исходнике. |
| `NextClubCheckoutRequest` | 55 | Контракт типов. Подробности и ограничения — в исходнике. |
| `fingerprintSelection` | 61 | Нормализованную почту и план связываем хешем с TEST-режимом; требуем HTTPS, Web Locks и криптографию до подготовки покупки. |
| `persistIntent` | 85 | Сначала записываем новый ключ и проверяем чтением; ключ предыдущей покупки повторно не используем. |
| `parseSavedIntent` | 101 | Ограничиваем размер и строго проверяем запись, не затирая повреждённое свидетельство новой покупкой. |
| `readSavedClubCheckoutIntent` | 111 | Читаем снимок ключа без ротации и удаления; наличие записи означает лишь возможность проверить исходную покупку. |
| `getClubCheckoutIntent` | 130 | Под общей блокировкой вкладок возвращаем прежний ключ только для той же почты и плана либо надёжно резервируем первый. Ни timeout, ни возврат URL не разрешают заменять ключ незавершённой покупки. |
| `reserveNextClubCheckoutIntent` | 181 | Смену ключа разрешаем после свежего терминального результата сервера под той же межвкладочной блокировкой. |

## [apps/frontend/src/features/club/checkout-mode.tsx](../../../apps/frontend/src/features/club/checkout-mode.tsx)

Модуль checkout-mode.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ClubCheckoutMode` | 14 | Выбираем оболочку платежа по сборочным флагам; неверная комбинация отключает оплату вместо случайного выбора провайдера. |
| `TestCheckoutScreen` | 35 | Передаём в тестовый результат состояние подтверждённой сессии и почту аккаунта, не выводя доступ из самого возврата оплаты. |

## [apps/frontend/src/features/club/checkout-polling.ts](../../../apps/frontend/src/features/club/checkout-polling.ts)

Опрос результата имеет ограниченный жизненный цикл и не создаёт новую оплату при ожидании подтверждения.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ReturnResult` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PollOptions` | 10 | Контракт типов. Подробности и ограничения — в исходнике. |
| `waitForNextCheck` | 16 | Ждём пять секунд после завершения проверки; отмена снимает таймер и не допускает перекрывающихся запросов. |
| `pollClubTestCheckout` | 33 | Проверяем один сохранённый ключ до шести раз и только пока сервер сообщает pending; общий бюджет ограничен 30 секундами. |

## [apps/frontend/src/features/club/checkout-result-controller.ts](../../../apps/frontend/src/features/club/checkout-result-controller.ts)

Контроллер результата связывает возврат, опрос и состояние доступа; поздние ответы относятся к своему запуску проверки.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ClubCheckoutResultState` | 10 | Контракт типов. Подробности и ограничения — в исходнике. |
| `clubCheckoutRetryAt` | 20 | Из 429 строим допустимое время следующей проверки; непроверенный или чрезмерный Retry-After заменяем минутой. |
| `createClubCheckoutResultController` | 37 | Сериализуем кампании проверки и отделяем паузу от ошибки и результата; dispose прекращает публикацию состояния. |

## [apps/frontend/src/features/club/checkout-result.tsx](../../../apps/frontend/src/features/club/checkout-result.tsx)

Модуль checkout-result.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `statusText` | 17 | Переводим серверное состояние покупки и фазу проверки в сообщение, не приравнивая возврат или unknown к оплате. |
| `ClubTestCheckoutResult` | 47 | Сохраняем один контроллер на жизнь экрана, чтобы скрытие вкладки не сбрасывало паузу 429 и не создавало новую оплату. |

## [apps/frontend/src/features/club/checkout-state.ts](../../../apps/frontend/src/features/club/checkout-state.ts)

Общие состояния оплаты отделяют ожидание провайдера, отказ и подтверждённый доступ от отображения формы.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `returnResultSchema` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `parseClubCheckoutState` | 9 | Принимаем только известное серверное состояние тестовой покупки; параметры URL и browser storage не доказывают оплату. |

## [apps/frontend/src/features/club/club-comments.content.ts](../../../apps/frontend/src/features/club/club-comments.content.ts)

Ресурсы и подписи обсуждения поста отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BROWN` | 2 | Ресурсы и подписи обсуждения поста отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `BROWN_MUTED` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `OLIVE` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/club/club-comments.module.scss](../../../apps/frontend/src/features/club/club-comments.module.scss)

Оформление компонента: Обсуждение принадлежит аккаунту и посту.

## [apps/frontend/src/features/club/club-comments.tsx](../../../apps/frontend/src/features/club/club-comments.tsx)

Модуль club-comments.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ClubCommentsProps` | 59 | Контракт типов. Подробности и ограничения — в исходнике. |
| `MenuAction` | 65 | Контракт типов. Подробности и ограничения — в исходнике. |
| `authorInitial` | 67 | Получаем первый символ отображаемого имени для аватара-заглушки, не используя приватные данные профиля. |
| `CommentAvatar` | 72 | Выбираем фото автора либо текстовый инициал; это представление уже полученных публичных полей комментария. |
| `linkify` | 101 | Выделяем HTTP(S)/www-фрагменты, нормализуем и проверяем внешние URL; остальное остаётся безопасным React-текстом. |
| `confirmDelete` | 124 | Удаление передаётся обработчику только после явного подтверждения браузера. |
| `CommentMenu` | 132 | Показываем разрешённые родителем действия владельца, модератора или жалобы; окончательную авторизацию выполняет API. |
| `ClubComments` | 211 | Пересоздаём обсуждение при смене аккаунта или поста, изолируя текст, файлы, меню и незавершённые действия. |
| `CommentThread` | 218 | Координируем страницы и ветки обсуждения с подтверждёнными действиями; свежий ввод и сохранённая keyed-отправка имеют разные жизненные циклы. |

## [apps/frontend/src/features/club/club-post-card.module.scss](../../../apps/frontend/src/features/club/club-post-card.module.scss)

Оформление компонента: Карточка объединяет текст, медиа и обсуждение.

## [apps/frontend/src/features/club/club-post-card.tsx](../../../apps/frontend/src/features/club/club-post-card.tsx)

Модуль club-post-card.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ClubPostCard` | 33 | Собираем клубную карточку из проверенных данных: текст и статья имеют разные переходы, видео отделены от аудио и документов. |

## [apps/frontend/src/features/club/club-post-photos.module.scss](../../../apps/frontend/src/features/club/club-post-photos.module.scss)

Оформление компонента: Фото и видео клубной карточки показываются в согласованной последовательности с отдельным открытием просмотра.

## [apps/frontend/src/features/club/club-post-photos.tsx](../../../apps/frontend/src/features/club/club-post-photos.tsx)

Модуль club-post-photos.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ClubPhoto` | 32 | Размер одной ячейки уточняем по реально показанной картинке; активное ближайшее окно управляет ранней загрузкой без отдельного скачивания оригинала. |
| `ClubPhotoCarousel` | 102 | Для наборов свыше девяти фото используем постраничное листание; смена ширины сохраняет выбранный индекс и соседнюю предзагрузку. |
| `ClubPostPhotos` | 179 | Выбираем одиночный кадр, сетку или карусель и располагаем видео отдельно; пара горизонтальных фото учитывает измеренные пропорции. |

## [apps/frontend/src/features/club/club-screen.content.ts](../../../apps/frontend/src/features/club/club-screen.content.ts)

Ресурсы и подписи страницы Клуба отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CLUB_BANNER_URL` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `OLIVE` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LETTER_CAROUSEL_IMAGES` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `EXCLUSIVE_CAROUSEL_IMAGES` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `GIVEAWAY_CAROUSEL_IMAGES` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `COMMUNITY_CAROUSEL_IMAGES` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PODBORKI_CAROUSEL_IMAGES` | 34 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `REVIEWS_CAROUSEL_IMAGES` | 41 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `REVIEWS_SLIDES` | 49 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Benefit` | 62 | Контракт типов. Подробности и ограничения — в исходнике. |
| `BENEFITS` | 67 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ClubPost` | 97 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CLUB_POSTS` | 105 | Старые демонстрационные карточки отделены от живой ленты ClubSubscribed, которая читает публикации только из API. |
| `TYPE_ICONS` | 137 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `TYPE_LABELS` | 143 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getClubScreenContent` | 151 | Передаём ширину viewport в размеры рекламных каруселей клуба. |

## [apps/frontend/src/features/club/club-screen.layout.ts](../../../apps/frontend/src/features/club/club-screen.layout.ts)

Геометрия страницы Клуба рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getClubScreenLayout` | 7 | Ширина разных рекламных каруселей согласуется с их snapInterval на странице подписки. |

## [apps/frontend/src/features/club/club-screen.module.scss](../../../apps/frontend/src/features/club/club-screen.module.scss)

Оформление компонента: Вход в раздел клуба выбирает экран по подтверждённой сессии, подписке и доступному режиму оплаты.

## [apps/frontend/src/features/club/club-screen.tsx](../../../apps/frontend/src/features/club/club-screen.tsx)

Модуль club-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ClubScreen` | 52 | Оборачиваем раздел в выбранный платежный режим до показа клуба или формы подписки. |
| `LegacyClubScreen` | 61 | Ждём подтверждения сессии и доступа; отдельное намерение checkout позволяет действующей участнице открыть продление. |

## [apps/frontend/src/features/club/club-subscribed.content.ts](../../../apps/frontend/src/features/club/club-subscribed.content.ts)

Ресурсы и подписи активного Клуба отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SEASONAL_TARTANS` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SEASONAL_BANNERS` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `OLIVE` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SAGE` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ClubTab` | 24 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ClubTabItem` | 25 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CLUB_TABS` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `STICKER_LIKE` | 56 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `STICKER_SAVE` | 58 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `MAILBOX_URI` | 60 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PEN_PALS_ENABLED` | 63 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ClubPost` | 64 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PROFILE_COMPLETED_KEY` | 100 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getClubSubscribedContent` | 103 | Передаём ширину viewport в расчёт баннера активного клуба. |

## [apps/frontend/src/features/club/club-subscribed.layout.ts](../../../apps/frontend/src/features/club/club-subscribed.layout.ts)

Геометрия активного Клуба рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getClubSubscribedLayout` | 7 | Сохраняем пропорции уже подготовленного баннера; до известных размеров используем прежнюю высоту-запас. |

## [apps/frontend/src/features/club/club-subscribed.module.scss](../../../apps/frontend/src/features/club/club-subscribed.module.scss)

Оформление компонента: Активный клуб связывает оформление, рубрики и ограниченные страницы постов.

## [apps/frontend/src/features/club/club-subscribed.tsx](../../../apps/frontend/src/features/club/club-subscribed.tsx)

Модуль club-subscribed.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ClubSubscribed` | 70 | Соединяем scoped-ленту, оформление и внутренние рубрики; календарный порядок и фильтрация остаются серверными до пагинации. |

## [apps/frontend/src/features/club/club-testimonials.content.ts](../../../apps/frontend/src/features/club/club-testimonials.content.ts)

Ресурсы и подписи отзывов о Клубе отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ClubTestimonial` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `COMMUNITY_TESTIMONIALS` | 18 | Цитаты связаны с существующими скриншотами по индексу; подпись автора добавляется только для видимого в оригинале имени. |
| `CLUB_TESTIMONIALS` | 43 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/club/club-testimonials.module.scss](../../../apps/frontend/src/features/club/club-testimonials.module.scss)

Оформление компонента: Отзывы представлены отдельным блоком страницы клуба и не участвуют в проверке подписки.

## [apps/frontend/src/features/club/club-testimonials.tsx](../../../apps/frontend/src/features/club/club-testimonials.tsx)

Модуль club-testimonials.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ClubTestimonials` | 13 | Показываем публичные цитаты с переходом к исходным скриншотам; положение ленты и просмотр оригинала имеют отдельное состояние. |
| `move` | 29 | Прокручиваем к измеренному началу карточки и учитываем системное уменьшение анимации. |

## [apps/frontend/src/features/club/comment-photo-previews.ts](../../../apps/frontend/src/features/club/comment-photo-previews.ts)

Временные object URL принадлежат выбранным фотографиям комментария и освобождаются при удалении или завершении выбора.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CommentPhotoPreviews` | 4 | Контракт типов. Подробности и ограничения — в исходнике. |
| `commentPhotoReference` | 6 | Строим локальную ссылку выбора из ключа операции, не выдавая её за адрес сохранённого файла. |
| `syncCommentPhotoPreviews` | 10 | Сохраняем object URL только пока ключ ссылается на тот же File; заменённые и удалённые фотографии освобождаем. |
| `releaseCommentPhotoPreviews` | 27 | Освобождаем все object URL набора при завершении его жизненного цикла. |

## [apps/frontend/src/features/club/comment-replies.tsx](../../../apps/frontend/src/features/club/comment-replies.tsx)

Модуль comment-replies.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PagedComment` | 14 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Props` | 15 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CommentReplies` | 27 | Не загружаем ответы до явного раскрытия; отдельный keyed родитель владеет своей цепочкой страниц. |
| `ReplyGroup` | 41 | Читаем ответы одного родителя в account-scope; 404 ветки не трактуем как потерю доступа ко всему посту. |

## [apps/frontend/src/features/club/guest-contact-fields.tsx](../../../apps/frontend/src/features/club/guest-contact-fields.tsx)

Модуль guest-contact-fields.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `GuestContactFields` | 10 | Связываем контакты с состоянием покупки; маска телефона сохраняет позицию курсора, а readOnly защищает исходный контакт сохранённого заказа. |

## [apps/frontend/src/features/club/guest-normal-checkout.ts](../../../apps/frontend/src/features/club/guest-normal-checkout.ts)

Гостевой NORMAL-заказ восстанавливается по исходному намерению; URL возврата не считается подтверждением покупки.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `GUEST_CHECKOUT_STORAGE_KEY` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `selectionSchema` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `intentSchema` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `GuestCheckoutIntent` | 45 | Контракт типов. Подробности и ограничения — в исходнике. |
| `GuestCheckoutSelection` | 46 | Контракт типов. Подробности и ограничения — в исходнике. |
| `GuestCheckoutActor` | 47 | Контракт типов. Подробности и ограничения — в исходнике. |
| `unavailable` | 50 | Сообщаем об утрате возможности проверить локальную покупку, сохраняя запрет на автоматическое создание другой. |
| `changed` | 55 | Отмечаем несовпадение ключа или снимка вместо восстановления по одному email. |
| `GuestCheckoutRecipientError` | 59 | Класс. Подробности и ограничения — в исходнике. |
| `GuestCheckoutRecipientError.constructor` | 61 | Помечаем отдельный случай покупки другого получателя, чтобы интерфейс мог предложить правильный вход. |
| `differentRecipient` | 69 | Создаём типизированную ошибку чужого получателя для ветвей журнала. |
| `GuestCheckoutJournal` | 72 | One durable guest intent. Its secret is never a login credential or payment proof. |
| `GuestCheckoutJournal.constructor` | 74 | Закрепляем экземпляр за гостем либо подтверждённым аккаунтом восстановления. |
| `GuestCheckoutJournal.assertActor` | 77 | Не продолжаем операцию после отмены или смены текущего владельца browser storage. |
| `GuestCheckoutJournal.assertRecipient` | 83 | Для вошедшего пользователя сверяем владельца и нормализованную почту, не присваивая ему чужую гостевую покупку. |
| `GuestCheckoutJournal.read` | 90 | Строго читаем ограниченную запись и отдельно проверяем получателя; повреждение не считается пустым журналом. |
| `GuestCheckoutJournal.persist` | 107 | Записываем только проверенное намерение текущего получателя и подтверждаем сохранение обратным чтением. |
| `GuestCheckoutJournal.locked` | 123 | Все изменения гостевого журнала координируем между вкладками, ограничивая ожидание Web Lock пятью секундами. |
| `GuestCheckoutJournal.reserve` | 152 | Новое гостевое намерение содержит проверенные контакты, UUID и случайный секрет восстановления; аккаунт после входа не создаёт его заново. |
| `GuestCheckoutJournal.requireCurrent` | 194 | Сравниваем весь неизменяемый набор покупки, включая секрет, контакт и владельца, перед продолжением сети. |
| `GuestCheckoutJournal.assertReady` | 210 | Сохраняем серверную паузу 429 и запрещаем обход её новым нажатием или вкладкой. |
| `GuestCheckoutJournal.prepare` | 221 | Повторяем прежнюю гостевую покупку лишь с теми же контактами и планом; первый ключ сохраняется до отправки. |
| `GuestCheckoutJournal.remember` | 241 | Принимаем orderId один раз; аккаунт привязывается только после серверной проверки секрета исходной покупки. |
| `GuestCheckoutJournal.rememberRateLimit` | 263 | Сохраняем максимальную паузу 429 в журнале, чтобы повторная вкладка не обнулила ограничение. |
| `GuestCheckoutJournal.next` | 288 | После свежего терминального статуса создаём следующий гостевой ключ либо явно возвращаем управление покупке аккаунта. |
| `proof` | 322 | Передаём серверу пару ключа идемпотентности и секрета; она восстанавливает покупку, но не авторизует пользователя. |
| `readStatus` | 327 | Читаем состояние гостевого NORMAL по секрету, не создавая новый заказ. |
| `checkGuestCheckout` | 340 | Проверяем исходную покупку и сохраняем orderId и паузу, сверяя журнал после ответа. |
| `createGuestCheckout` | 359 | Создаём или восстанавливаем ссылку с неизменными ключами и контактами; сетевой повтор не меняет получателя. |

## [apps/frontend/src/features/club/legacy-checkout-journal.ts](../../../apps/frontend/src/features/club/legacy-checkout-journal.ts)

Старый протокол сохраняет признак неизвестного результата; пока он не проверен, автоматический новый checkout не запускается.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `schema` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LegacyCheckoutIntent` | 15 | Контракт типов. Подробности и ограничения — в исходнике. |
| `LegacyCheckoutJournalError` | 16 | Класс. Подробности и ограничения — в исходнике. |
| `LegacyCheckoutJournal` | 20 | Local coordination only. The existing createCheckout API has no replay key. Never present this ID as server idempotency or an order/payment receipt. |
| `LegacyCheckoutJournal.constructor` | 22 | Фиксируем владельца и старый протокол; этот журнал координирует вкладки, но не добавляет идемпотентность серверу. |
| `LegacyCheckoutJournal.storageKey` | 27 | Разделяем записи гостя и аккаунтов, а также legacy и Prodamus TEST. |
| `LegacyCheckoutJournal.assertOwner` | 31 | Отсекаем запросы, продолжившиеся после отмены или смены владельца сессии. |
| `LegacyCheckoutJournal.read` | 39 | Проверяем ограниченную запись вместе с владельцем и режимом; повреждение не трактуем как отсутствие покупки. |
| `LegacyCheckoutJournal.persist` | 56 | Подтверждаем запись обратным чтением и повторно проверяем владельца после browser storage. |
| `LegacyCheckoutJournal.submit` | 70 | До сети сохраняем unknown под Web Lock; только декодированный бизнес-отказ меняет его на rejected, успешный ответ на acknowledged. |

## [apps/frontend/src/features/club/normal-checkout.ts](../../../apps/frontend/src/features/club/normal-checkout.ts)

Контракт NORMAL отделяет проверку сохранённого заказа от создания нового; статус подписки не заменяет квитанцию покупки.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `key` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `orderId` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `succeeded` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `failed` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `statusSchema` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `resultSchema` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `intentSchema` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `NormalCheckoutIntent` | 42 | Контракт типов. Подробности и ограничения — в исходнике. |
| `NormalCheckoutStatus` | 43 | Контракт типов. Подробности и ограничения — в исходнике. |
| `NormalCheckoutResult` | 44 | Контракт типов. Подробности и ограничения — в исходнике. |
| `parseNormalCheckoutStatus` | 46 | Проверяем статус боевой покупки отдельно от результата создания; дата окончания приходит через tRPC как Date. |
| `parseNormalCheckoutResult` | 54 | Проверяем ответ создания и дополнительно ограничиваем платёжный URL для pending. |
| `unreadable` | 64 | Возвращаем безопасное сообщение о недоступном хранилище, не предлагая начать новую покупку. |
| `changed` | 69 | Отделяем смену намерения другой вкладкой от подтверждённого результата оплаты. |
| `NormalCheckoutJournal` | 75 | One account's NORMAL intent; URL, email and payment proof are never persisted. |
| `NormalCheckoutJournal.constructor` | 77 | Закрепляем журнал NORMAL за одним идентификатором аккаунта. |
| `NormalCheckoutJournal.storageKey` | 79 | Разделяем локальные свидетельства покупки по владельцу. |
| `NormalCheckoutJournal.assertOwner` | 83 | Проверяем и сигнал операции, и актуального владельца персонального storage. |
| `NormalCheckoutJournal.read` | 88 | Строго читаем ограниченный снимок; повреждённая запись блокирует новый заказ вместо незаметного сброса. |
| `NormalCheckoutJournal.persist` | 103 | Сериализуем проверенное намерение и подтверждаем его обратным чтением. |
| `NormalCheckoutJournal.locked` | 116 | Координируем вкладки через Web Locks с ограничением ожидания; проверяем владельца до и после работы. |
| `NormalCheckoutJournal.newIntent` | 149 | Проверяем обязательный телефон нового заказа и создаём отличный от предыдущего UUID до сетевого вызова. |
| `NormalCheckoutJournal.requireCurrent` | 170 | Перед продолжением сравниваем ключ, план и контакт с актуальной записью, не присваивая результат другому намерению. |
| `NormalCheckoutJournal.prepare` | 186 | Повторно используем существующее намерение; новую месячную покупку готовим только при его отсутствии. |
| `NormalCheckoutJournal.rememberOrder` | 197 | Привязываем первый серверный orderId к намерению и отклоняем последующие несовпадающие идентификаторы. |
| `NormalCheckoutJournal.next` | 215 | Создаём следующий ключ лишь после свежего succeeded/failed по прежнему заказу под той же блокировкой. |
| `checkNormalCheckout` | 242 | Запрашиваем статус исходного ключа и сохраняем проверенную привязку заказа без создания оплаты. |
| `createNormalCheckout` | 260 | Отправляем сохранённый ключ и контакты в payload NORMAL; TEST-заголовок здесь не используется. |

## [apps/frontend/src/features/club/payment-mode.ts](../../../apps/frontend/src/features/club/payment-mode.ts)

Режим оплаты выбирается из переменных клиентской сборки; он не заменяет соответствующую настройку API.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ClubPaymentMode` | 2 | Режим оплаты выбирается из переменных клиентской сборки; он не заменяет соответствующую настройку API. |
| `getClubPaymentMode` | 9 | Проверяем обе настройки TEST; неизвестное значение или одновременное включение двух провайдеров даёт unavailable. URL и browser storage не выбирают TEST. |
| `isNormalCheckoutRecoveryEnabled` | 26 | Включаем восстановление покупки аккаунта только с отдельным флагом и исключительно в LIVE-режиме. Выпуск требует схемы 0030 и готового серверного пути. |
| `isGuestCheckoutRecoveryEnabled` | 34 | Отделяем гостевое восстановление LIVE от тестовой оплаты и восстановления авторизованного пользователя. |
| `requireProdamusTestUrl` | 42 | Проверяем origin, демо-параметры, сумму и форму заказа перед открытием ссылки, чтобы TEST-интерфейс не начал боевую оплату. |

## [apps/frontend/src/features/club/pen-pals.content.ts](../../../apps/frontend/src/features/club/pen-pals.content.ts)

Ресурсы и подписи почтового отделения отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BROWN` | 2 | Ресурсы и подписи почтового отделения отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `BROWN_MUTED` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `OLIVE` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SAGE` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/club/pen-pals.module.scss](../../../apps/frontend/src/features/club/pen-pals.module.scss)

Оформление компонента: Интерфейс почтового отделения работает только при доступной возможности.

## [apps/frontend/src/features/club/pen-pals.tsx](../../../apps/frontend/src/features/club/pen-pals.tsx)

Модуль pen-pals.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Screen` | 23 | Контракт типов. Подробности и ограничения — в исходнике. |
| `MatchCard` | 24 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PenPalsProps` | 38 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PenPals` | 42 | Разделяем форму анкеты и результаты подбора; компонент вызывается родителем только при включённой возможности, а права и адреса проверяет сервер. |

## [apps/frontend/src/features/club/prodamus-return-api.ts](../../../apps/frontend/src/features/club/prodamus-return-api.ts)

Возврат от провайдера запускает проверку серверного результата, а не выдаёт доступ по параметрам браузерного адреса.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `referencePattern` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `resultSchema` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ProdamusReturnResult` | 30 | Контракт типов. Подробности и ограничения — в исходнике. |
| `pollProdamusReturnResult` | 33 | Ограничиваем проверку возврата шестью последовательными запросами и общим бюджетом; опрашиваем повторно только pending. |
| `readProdamusReturnToken` | 64 | Извлекаем только ограниченный по длине токен ожидаемой формы; подпись и срок проверяет сервер. |
| `readProdamusReturnResult` | 74 | Читаем результат без cookie и перенаправлений; ни вход, ни повторная отправка письма этим маршрутом не выполняются. Этот вызов не подтверждает платёж и не обращается к провайдеру. |

## [apps/frontend/src/features/club/prodamus-return-dialog.module.scss](../../../apps/frontend/src/features/club/prodamus-return-dialog.module.scss)

Оформление компонента: Окно возврата показывает серверную проверку оплаты и остаётся доступным для явного повтора результата.

## [apps/frontend/src/features/club/prodamus-return-dialog.tsx](../../../apps/frontend/src/features/club/prodamus-return-dialog.tsx)

Модуль prodamus-return-dialog.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `View` | 18 | Контракт типов. Подробности и ограничения — в исходнике. |
| `checking` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ProdamusReturnDialog` | 29 | Забираем ограниченную ссылку результата из fragment и проверяем её сервером; подтверждённый платёж не создаёт сессию. |

## [apps/frontend/src/features/club/profile-setup.content.ts](../../../apps/frontend/src/features/club/profile-setup.content.ts)

Ресурсы и подписи подготовки профиля отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BROWN` | 2 | Ресурсы и подписи подготовки профиля отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `BROWN_MUTED` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `OLIVE` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/club/profile-setup.module.scss](../../../apps/frontend/src/features/club/profile-setup.module.scss)

Оформление компонента: Подготовка профиля для клуба сохраняет ввод через общий механизм сверки профиля, а не через локальную подмену пользователя.

## [apps/frontend/src/features/club/profile-setup.tsx](../../../apps/frontend/src/features/club/profile-setup.tsx)

Модуль profile-setup.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Gender` | 37 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ProfileSetupProps` | 38 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CropperImage` | 41 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ProfileSetup` | 47 | Первичную анкету восстанавливаем из черновика текущего владельца; изменения сессии в фоне не перетирают ввод. |

## [apps/frontend/src/features/club/support-phone.ts](../../../apps/frontend/src/features/club/support-phone.ts)

Подпись контактного телефона поддержки формируется отдельно от номера, который покупатель вводит при оплате.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `formatSupportPhone` | 5 | Форматируем введённые цифры под российский номер, ограничивая видимую часть десятью цифрами после кода страны. |
| `supportPhoneInput` | 20 | Пустое значение остаётся отсутствующим; непустое принимаем только в российском формате и приводим к +7 без разделителей. Обязательность контакта новой покупки проверяется отдельным purchase-контрактом. |

## [apps/frontend/src/features/club/tag-board-drawer.content.ts](../../../apps/frontend/src/features/club/tag-board-drawer.content.ts)

Ресурсы и подписи панели клубных тегов отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PEEK_STRIP_WIDTH` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BOARD_WIDTH_RATIO` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `TAG_BOARD_URI` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `TOPIC_TAG_ROWS` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BOARD_IMG_ASPECT` | 22 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LINEN_TOP_RATIO` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LINEN_BOTTOM_RATIO` | 25 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LINEN_SIDE_RATIO` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getTagBoardDrawerContent` | 29 | Вычисляем положение рамки и внутреннего льняного поля от viewport; темы распределяются по заранее согласованным строкам. |

## [apps/frontend/src/features/club/tag-board-drawer.layout.ts](../../../apps/frontend/src/features/club/tag-board-drawer.layout.ts)

Геометрия панели клубных тегов рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getTagBoardDrawerLayout` | 7 | Ограничиваем прокрутку фильтров видимым остатком экрана, сохраняя исходную геометрию декоративной доски. |

## [apps/frontend/src/features/club/tag-board-drawer.module.scss](../../../apps/frontend/src/features/club/tag-board-drawer.module.scss)

Оформление компонента: Панель тегов меняет фильтр клубного списка, сохраняя выбор рубрики отдельно от содержимого карточек.

## [apps/frontend/src/features/club/tag-board-drawer.tsx](../../../apps/frontend/src/features/club/tag-board-drawer.tsx)

Модуль tag-board-drawer.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `TagBoardDrawerProps` | 31 | Контракт типов. Подробности и ограничения — в исходнике. |
| `TagBoardDrawer` | 36 | Выдвижная панель хранит только открытость; выбранный тег остаётся у владельца списка, а скрытая панель исключена из фокуса. |

## [apps/frontend/src/features/club/test-checkout.ts](../../../apps/frontend/src/features/club/test-checkout.ts)

TEST-покупка использует отдельные параметры и подтверждения, чтобы её нельзя было принять за LIVE-заказ.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `createNextClubTestCheckout` | 15 | Используем явно зарезервированный новый TEST-ключ после завершения предыдущей покупки; сверяем его до и после сети. |
| `createClubTestCheckout` | 40 | Создаём или повторяем TEST-покупку по неизменному сохранённому ключу и выбору, учитывая смену сессии. Разрешение TEST проверяется отдельно от жизненного цикла терминального ключа. |
| `reconcileClubTestCheckout` | 66 | Читаем результат ровно сохранённой TEST-покупки; отсутствие записи возвращает null и не создаёт заказ. |

## [apps/frontend/src/features/club/use-club-payment.ts](../../../apps/frontend/src/features/club/use-club-payment.ts)

Модуль use-club-payment.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `uncertainCheckout` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `pendingAccess` | 34 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `checkingAccess` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `wait` | 40 | Ставим отменяемую паузу между последовательными проверками доступа, не оставляя таймер после отмены. |
| `useClubPayment` | 57 | Выбираем гостевой recovery, NORMAL аккаунта или прежний протокол; все hooks сохраняют одинаковый порядок вызова React. Параметры URL не доказывают оплату. |
| `useLegacyClubPayment` | 123 | Для старого API ведём локальный guard неизвестного результата; он не обещает серверную идемпотентность повторной заявки. |

## [apps/frontend/src/features/club/use-guest-club-payment.ts](../../../apps/frontend/src/features/club/use-guest-club-payment.ts)

Модуль use-guest-club-payment.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PurchaseState` | 26 | Контракт типов. Подробности и ограничения — в исходнике. |
| `describe` | 36 | Поясняем статус исходного гостевого заказа; успешная оплата не выполняет вход и не заменяет проверку текущего доступа. |
| `useGuestClubPayment` | 50 | Восстанавливаем гостевую покупку до и после входа, сохраняя получателя, секрет и паузу между проверками. |

## [apps/frontend/src/features/club/use-normal-club-payment.ts](../../../apps/frontend/src/features/club/use-normal-club-payment.ts)

Модуль use-normal-club-payment.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PurchaseState` | 25 | Контракт типов. Подробности и ограничения — в исходнике. |
| `describePurchase` | 33 | Различаем факт оплаты конкретного заказа и сегодняшний доступ; исторический expiresAt не выдаёт новую подписку. |
| `useNormalClubPayment` | 47 | Управляем NORMAL-покупкой текущего аккаунта через durable journal и отменяем право на redirect при уходе или смене сессии. Состояние подписки не заменяет квитанцию конкретного заказа. |

## [apps/frontend/src/features/club/use-prepared-appearance.ts](../../../apps/frontend/src/features/club/use-prepared-appearance.ts)

Модуль use-prepared-appearance.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `prepareImage` | 9 | Загружаем и декодируем подходящий вариант картинки под отменяемым файловым заданием; отмена снимает источники изображения. |
| `usePreparedAppearance` | 35 | Публикуем фон, баннер и его размеры одной парой только после успешного декодирования; прежние ресурсы удерживаем до замены. |

## [apps/frontend/src/features/club/use-private-comment-files.ts](../../../apps/frontend/src/features/club/use-private-comment-files.ts)

Модуль use-private-comment-files.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `usePrivateCommentFiles` | 31 | Владеем выбранными файлами, object URL и durable journal одного аккаунта/поста; повтор отправки использует прежний текст, исходники и ключ. |

## [apps/frontend/src/features/feed/feed-grid-item.module.scss](../../../apps/frontend/src/features/feed/feed-grid-item.module.scss)

Оформление компонента: Плитка ленты показывает компактное представление поста и сохраняет общий адрес открытия материала.

## [apps/frontend/src/features/feed/feed-grid-item.tsx](../../../apps/frontend/src/features/feed/feed-grid-item.tsx)

Модуль feed-grid-item.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `GridItem` | 15 | Сетка остаётся настоящей ссылкой; доступную подпись берём из очищенного текста, показывая отдельный маркер видео или нескольких фото. |

## [apps/frontend/src/features/feed/feed-screen.content.ts](../../../apps/frontend/src/features/feed/feed-screen.content.ts)

Ресурсы и подписи ленты отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `TagSlug` | 5 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Tag` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `FeedPost` | 10 | Контракт типов. Подробности и ограничения — в исходнике. |
| `GRID_GAP` | 45 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `GRID_COLUMNS` | 46 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `MAX_TEXT_LINES` | 48 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM_BG` | 49 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_DARK` | 50 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_LIGHT` | 51 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `GREEN_ACCENT` | 52 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DEFAULT_TAGS` | 53 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FEED_BANNER_URI` | 57 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getFeedScreenContent` | 61 | Рассчитываем три равных слота сетки с единым межколоночным зазором и пропорцией фото 4:5. |

## [apps/frontend/src/features/feed/feed-screen.layout.ts](../../../apps/frontend/src/features/feed/feed-screen.layout.ts)

Геометрия ленты рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getFeedScreenLayout` | 7 | Передаём вычисленные размеры сетки UI-компоненту без привязки к API или выбранному фильтру. |

## [apps/frontend/src/features/feed/feed-screen.module.scss](../../../apps/frontend/src/features/feed/feed-screen.module.scss)

Оформление компонента: Лента хранит ограниченное окно постов, фильтры и отметки пользователя.

## [apps/frontend/src/features/feed/feed-screen.tsx](../../../apps/frontend/src/features/feed/feed-screen.tsx)

Модуль feed-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ViewMode` | 61 | Контракт типов. Подробности и ограничения — в исходнике. |
| `formatDate` | 63 | Согласуем SSR-дату с последующим локальным календарём браузера без смены порядка API. |
| `normalizeFeedPost` | 82 | Адаптируем API к карточке: фильтруем фото, санитизируем richText и извлекаем источник статьи, сохраняя серверную дату и ID. |
| `FeedScreen` | 118 | Один набор фильтров управляет ограниченным cursor-окном, сеткой и лентой; отметки и retained карточки принадлежат аккаунту. |

## [apps/frontend/src/features/feed/post-card.module.scss](../../../apps/frontend/src/features/feed/post-card.module.scss)

Оформление компонента: Карточка ленты отделяет переход в публикацию, просмотр медиа и действия лайка или сохранения.

## [apps/frontend/src/features/feed/post-card.tsx](../../../apps/frontend/src/features/feed/post-card.tsx)

Модуль post-card.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PostCard` | 28 | Карточка разделяет переход, раскрытие текста и вложенные действия; раскрытый текст удерживает её в окне коллекции. |

## [apps/frontend/src/features/feed/post-screen.content.ts](../../../apps/frontend/src/features/feed/post-screen.content.ts)

Ресурсы и подписи детального поста отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM_BG` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_DARK` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_LIGHT` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `GREEN_ACCENT` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getPostScreenContent` | 13 | Оставляем совместимую точку получения ширины детального поста от общего viewport. |

## [apps/frontend/src/features/feed/post-screen.module.scss](../../../apps/frontend/src/features/feed/post-screen.module.scss)

Оформление компонента: Детальная публикация читает материал по проверенному адресу и связывает его медиа, отметки и обсуждение.

## [apps/frontend/src/features/feed/post-screen.tsx](../../../apps/frontend/src/features/feed/post-screen.tsx)

Модуль post-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `formatDate` | 45 | SSR использует UTC для стабильного текста, после готовности браузера отображаем локальную календарную дату. |
| `PostDetailScreenInner` | 64 | Читаем пост по числовому ID или UUID; подтверждённое отсутствие/отказ скрывает прежние данные и закрывает просмотр фотографий. |
| `PostDetailScreen` | 350 | Изолируем ошибку рендера детали, сохраняя понятный повтор открытия вместо падения всего приложения. |

## [apps/frontend/src/features/home/garden-confetti.content.ts](../../../apps/frontend/src/features/home/garden-confetti.content.ts)

Ресурсы и подписи декоративного эффекта сада отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PETAL_COLORS` | 2 | Ресурсы и подписи декоративного эффекта сада отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `Petal` | 10 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PETALS` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/home/garden-confetti.module.scss](../../../apps/frontend/src/features/home/garden-confetti.module.scss)

Оформление компонента: Декоративный эффект включается владельцем секции и не участвует в навигации или состоянии воспроизведения.

## [apps/frontend/src/features/home/garden-confetti.tsx](../../../apps/frontend/src/features/home/garden-confetti.tsx)

Модуль garden-confetti.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ConfettiPetal` | 16 | Детерминированный лепесток анимирует только progress; задержка и траектория приходят из статических данных. |
| `GardenConfetti` | 55 | Монтируем только декоративный слой активного эффекта; pointer-events не мешают содержимому страницы. |

## [apps/frontend/src/features/home/garden-tour-video.content.ts](../../../apps/frontend/src/features/home/garden-tour-video.content.ts)

Ресурсы и подписи тура по саду отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `GARDEN_VIDEO_URL` | 2 | Ресурсы и подписи тура по саду отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `GARDEN_POSTER_URL` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/home/garden-tour-video.module.scss](../../../apps/frontend/src/features/home/garden-tour-video.module.scss)

Оформление компонента: Тур по саду создаёт проигрыватель после нажатия.

## [apps/frontend/src/features/home/garden-tour-video.tsx](../../../apps/frontend/src/features/home/garden-tour-video.tsx)

Модуль garden-tour-video.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `GardenPoster` | 20 | Постер сам не загружает видео; отдельная кнопка запуска передаёт намерение владельцу. |
| `GardenTourVideo` | 46 | Создаём ManagedVideo после явного выбора и сохраняем controls/playsInline для браузерного воспроизведения. |
| `SectionProps` | 65 | Контракт типов. Подробности и ограничения — в исходнике. |
| `GardenTourSection` | 70 | Согласуем появление секции со scrollY или отложенным fallback, не связывая декоративное раскрытие с успешным запуском видео. |

## [apps/frontend/src/features/home/home-promo-carousel.content.ts](../../../apps/frontend/src/features/home/home-promo-carousel.content.ts)

Ресурсы и подписи промо-карусели главной отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `INTERVAL_MS` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FADE_MS` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getHomePromoCarouselContent` | 12 | Вычисляем размер промо из ширины полотна с постоянными отступами и исходной пропорцией иллюстрации. |

## [apps/frontend/src/features/home/home-promo-carousel.layout.ts](../../../apps/frontend/src/features/home/home-promo-carousel.layout.ts)

Геометрия промо-карусели главной рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getHomePromoCarouselLayout` | 7 | Преобразуем рассчитанные размеры в стили карточки, не меняя данные слайдов или интервалы. |

## [apps/frontend/src/features/home/home-promo-carousel.module.scss](../../../apps/frontend/src/features/home/home-promo-carousel.module.scss)

Оформление компонента: Промо-карусель согласует автоматическую смену слайдов с ручным свайпом и не открывает раздел после завершения drag.

## [apps/frontend/src/features/home/home-promo-carousel.tsx](../../../apps/frontend/src/features/home/home-promo-carousel.tsx)

Модуль home-promo-carousel.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Swipe` | 25 | Контракт типов. Подробности и ограничения — в исходнике. |
| `HomePromoCarousel` | 35 | Один индекс управляет слайдом, маршрутом и точками; автоматическое листание приостанавливаем во время ручного жеста и скрытого экрана. |

## [apps/frontend/src/features/home/home-screen.content.ts](../../../apps/frontend/src/features/home/home-screen.content.ts)

Ресурсы и подписи главной страницы отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CROSSFADE_DURATION` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SLIDE_INTERVAL` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SECTION_CONTENT_COUNTS` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SECTION_LAST_UPDATED` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SECTION_BANNERS` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 82 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM_BG` | 83 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_DARK` | 84 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MID` | 85 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_LIGHT` | 86 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ACCENT_GREEN` | 87 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `HERO_ASPECT` | 88 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getHomeScreenContent` | 91 | Рассчитываем высоту hero от ширины, сохраняя размеры общего полотна приложения. |

## [apps/frontend/src/features/home/home-screen.layout.ts](../../../apps/frontend/src/features/home/home-screen.layout.ts)

Геометрия главной страницы рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getHomeScreenLayout` | 7 | Собираем пропорциональные размеры иллюстраций, пересечений и блика из одной ширины viewport. |

## [apps/frontend/src/features/home/home-screen.module.scss](../../../apps/frontend/src/features/home/home-screen.module.scss)

Оформление компонента: Главная собирает статические разделы, промо и медиа.

## [apps/frontend/src/features/home/home-screen.tsx](../../../apps/frontend/src/features/home/home-screen.tsx)

Модуль home-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `heroImage` | 44 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SeasonData` | 45 | Контракт типов. Подробности и ограничения — в исходнике. |
| `getCurrentSeason` | 52 | Выбираем клиентский сезон главной по номеру месяца; это отдельная модель от серверного календаря оформления Клуба. |
| `isSectionNew` | 102 | Проверяем статическую редакционную дату для значка «Новое»; это не серверный счётчик непрочитанных публикаций. |
| `HomeScreen` | 112 | Инициализируем дату от сервера для SSR, затем обновляем локальный сезон при активации; фоновые анимации сохранённой вкладки приостанавливаются. |

## [apps/frontend/src/features/home/promo-slides.ts](../../../apps/frontend/src/features/home/promo-slides.ts)

Модуль promo-slides.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `HOME_PROMO_SLIDES` | 5 | Home promo carousel: Club → Quiz → Feed. PNG alpha on paper (see HomePromoCarousel). |
| `HomePromoSlide` | 25 | Контракт типов. Подробности и ограничения — в исходнике. |
| `HOME_PROMO_ASPECT` | 27 | 1024×577 source art |

## [apps/frontend/src/features/home/zoom-card.tsx](../../../apps/frontend/src/features/home/zoom-card.tsx)

Модуль zoom-card.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ZoomCard` | 7 | Навигационная карточка остаётся Link с проверенным внутренним маршрутом: клавиатура и открытие в новой вкладке работают нативно. |

## [apps/frontend/src/features/legal/contact-email-footer.module.scss](../../../apps/frontend/src/features/legal/contact-email-footer.module.scss)

Оформление компонента: Контакт поддержки открывается явным mailto-действием.

## [apps/frontend/src/features/legal/contact-email-footer.tsx](../../../apps/frontend/src/features/legal/contact-email-footer.tsx)

Модуль contact-email-footer.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Props` | 8 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ContactEmailFooter` | 14 | Показываем общий адрес поддержки и открываем почтовый клиент явным действием; доставку письма не утверждаем. |

## [apps/frontend/src/features/legal/contact-email-line.module.scss](../../../apps/frontend/src/features/legal/contact-email-line.module.scss)

Оформление компонента: Строка контакта использует общий адрес проекта и сохраняет обычное поведение почтовой ссылки.

## [apps/frontend/src/features/legal/contact-email-line.tsx](../../../apps/frontend/src/features/legal/contact-email-line.tsx)

Модуль contact-email-line.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Props` | 8 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ContactEmailLine` | 15 | Встраиваем единый контакт поддержки с необязательным префиксом, не дублируя сам email по экранам. |

## [apps/frontend/src/features/legal/legal-document-screen.module.scss](../../../apps/frontend/src/features/legal/legal-document-screen.module.scss)

Оформление компонента: Универсальная страница выводит разделы выбранного документа React-элементами и отдельно показывает приложенную иллюстрацию.

## [apps/frontend/src/features/legal/legal-document-screen.tsx](../../../apps/frontend/src/features/legal/legal-document-screen.tsx)

Универсальная страница выводит разделы выбранного документа React-элементами и отдельно показывает приложенную иллюстрацию.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Props` | 8 | Контракт типов. Подробности и ограничения — в исходнике. |
| `LegalDocumentScreen` | 12 | Отображаем статический документ и необязательную иллюстрацию структурированными React-элементами без исполнения HTML. |

## [apps/frontend/src/features/legal/legal-documents-footer.content.ts](../../../apps/frontend/src/features/legal/legal-documents-footer.content.ts)

Ресурсы и подписи ссылок на юридические документы отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `FOLDER_IMAGE` | 2 | Ресурсы и подписи ссылок на юридические документы отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `FOLDER_ASPECT` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FOLDER_WIDTH` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/legal/legal-documents-footer.module.scss](../../../apps/frontend/src/features/legal/legal-documents-footer.module.scss)

Оформление компонента: Футер документов использует общий набор ссылок, чтобы разделы приложения не дублировали маршруты юридических страниц.

## [apps/frontend/src/features/legal/legal-documents-footer.tsx](../../../apps/frontend/src/features/legal/legal-documents-footer.tsx)

Модуль legal-documents-footer.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Props` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `LegalDocumentsFooter` | 14 | Даём единые переходы к обзору документов и политике; внешний стиль меняет только положение футера. |

## [apps/frontend/src/features/legal/legal-documents.ts](../../../apps/frontend/src/features/legal/legal-documents.ts)

Тексты документов и их маршруты представлены данными сборки; контакт берётся из общей публичной настройки.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `LegalDocument` | 3 | Контракт типов. Подробности и ограничения — в исходнике. |
| `OPERATOR` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LEGAL_DOCUMENTS` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LEGAL_HUB_LINKS` | 217 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/legal/legal-screen.module.scss](../../../apps/frontend/src/features/legal/legal-screen.module.scss)

Оформление компонента: Обзор документов содержит обычные внутренние ссылки, сохраняя отдельные страницы политики и условий.

## [apps/frontend/src/features/legal/legal-screen.tsx](../../../apps/frontend/src/features/legal/legal-screen.tsx)

Обзор документов содержит обычные внутренние ссылки, сохраняя отдельные страницы политики и условий.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `LegalHubScreen` | 9 | Строим обзор по согласованному списку slug и отдельной ссылке политики; контент каждой страницы хранится независимо. |

## [apps/frontend/src/features/legal/privacy-screen.content.ts](../../../apps/frontend/src/features/legal/privacy-screen.content.ts)

Ресурсы и подписи политики конфиденциальности отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BROWN` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SECTIONS` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/legal/privacy-screen.module.scss](../../../apps/frontend/src/features/legal/privacy-screen.module.scss)

Оформление компонента: Политика отображается как статический текст.

## [apps/frontend/src/features/legal/privacy-screen.tsx](../../../apps/frontend/src/features/legal/privacy-screen.tsx)

Политика отображается как статический текст; экран не исполняет содержимое документа и не управляет согласиями пользователя.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PrivacyScreen` | 9 | Выводим неизменяемые разделы политики и переход к общему обзору, не смешивая их с фактом принятия согласия пользователем. |

## [apps/frontend/src/features/library/about-screen.content.ts](../../../apps/frontend/src/features/library/about-screen.content.ts)

Ресурсы и подписи страницы об авторе отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BROWN` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PAPER_TEXTURE_URI` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CAROUSEL_IMAGES` | 10 | Общая фотокарусель не совпадает с иллюстрациями глав; оба порядка задаются редакционными массивами ниже. |
| `PART_PHOTOS` | 31 | Фото, заголовки, подзаголовки и тексты глав сопоставляются по одному индексу; при добавлении главы нужно обновить все четыре массива. |
| `PART_TITLES` | 44 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PART_SUBTITLES` | 57 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PART_TEXTS` | 70 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getAboutScreenContent` | 96 | Передаём ширину viewport в расчёт карусели; высота не участвует в ширине её страницы. |

## [apps/frontend/src/features/library/about-screen.layout.ts](../../../apps/frontend/src/features/library/about-screen.layout.ts)

Геометрия страницы об авторе рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getAboutScreenLayout` | 7 | Одна страница фотокарусели занимает полную ширину viewport, совпадая с шагом горизонтального листания. |

## [apps/frontend/src/features/library/about-screen.module.scss](../../../apps/frontend/src/features/library/about-screen.module.scss)

Оформление компонента: Страница об авторе отображает материалы сборки и общие переходы, не выполняя пользовательских записей.

## [apps/frontend/src/features/library/about-screen.tsx](../../../apps/frontend/src/features/library/about-screen.tsx)

Модуль about-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `AboutMeScreen` | 30 | Собираем публичную биографию из синхронных массивов глав; карусель и фотографии глав используют общий просмотрщик. |

## [apps/frontend/src/features/library/aesthetics-screen.content.ts](../../../apps/frontend/src/features/library/aesthetics-screen.content.ts)

Ресурсы и подписи гайда эстетик отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_LIGHT` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `AESTHETIC_ORDER` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `HOUSE_IMAGES` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `MOODBOARDS` | 31 | Эти исходные пути задают идентичность и порядок иллюстраций для сопоставления с защищёнными привязками; экран подставляет URL из API. |
| `OUTFITS` | 82 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `INTERIORS` | 133 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getAestheticsScreenContent` | 185 | Передаём ширину экрана в расчёт баннеров и трёх независимых форматов каруселей. |

## [apps/frontend/src/features/library/aesthetics-screen.layout.ts](../../../apps/frontend/src/features/library/aesthetics-screen.layout.ts)

Геометрия гайда эстетик рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getAestheticsScreenLayout` | 7 | Задаём разные пропорции для образов, мудбордов и интерьеров; все размеры масштабируются от текущей ширины viewport. |

## [apps/frontend/src/features/library/aesthetics-screen.module.scss](../../../apps/frontend/src/features/library/aesthetics-screen.module.scss)

Оформление компонента: Гайд эстетик связывает выбранный раздел с закрытыми текстами и иллюстрациями, сохраняя отдельные состояния чтения.

## [apps/frontend/src/features/library/aesthetics-screen.tsx](../../../apps/frontend/src/features/library/aesthetics-screen.tsx)

Модуль aesthetics-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getTableHeaders` | 42 | Выбираем редакционные названия двух колонок стиля; структура данных остаётся romantic/workwear для всех эстетик. |
| `AestheticsGuideScreen` | 61 | Совмещаем бесплатную аннотацию эстетики с отдельно полученными клубными текстами и иллюстрациями; ошибка одного источника не подменяет его публичной копией. |

## [apps/frontend/src/features/library/article-screen.content.ts](../../../apps/frontend/src/features/library/article-screen.content.ts)

Ресурсы и подписи страницы статьи отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER` | 2 | Ресурсы и подписи страницы статьи отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `BROWN` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/library/article-screen.module.scss](../../../apps/frontend/src/features/library/article-screen.module.scss)

Оформление компонента: Страница статьи сохраняет подтверждённый текст при временном сбое, но скрывает его при отказе доступа или заблокированном ответе.

## [apps/frontend/src/features/library/article-screen.tsx](../../../apps/frontend/src/features/library/article-screen.tsx)

Модуль article-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `LibraryArticleScreen` | 32 | Читаем статью по валидному идентификатору; временный сбой оставляет подтверждённый текст, отказ закрывает текст и просмотр фото. |

## [apps/frontend/src/features/library/guide-navigation.ts](../../../apps/frontend/src/features/library/guide-navigation.ts)

Положение главы измеряем относительно прокручиваемой области: загрузка предыдущих иллюстраций может сдвинуть цель.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `scrollToGuideSection` | 2 | Положение главы измеряем относительно прокручиваемой области: загрузка предыдущих иллюстраций может сдвинуть цель. |

## [apps/frontend/src/features/library/library-files-api.ts](../../../apps/frontend/src/features/library/library-files-api.ts)

Страницы файлов проверяем по MIME, ключам и каноническим URL; повтор курсора или привязки завершает чтение ошибкой.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `LibraryMaterialKey` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `isPrivateLibraryEnabled` | 13 | Читаем сборочный флаг интерфейса; право на скачивание всё равно проверяет сервер. |
| `libraryMaterialKey` | 16 | Принимаем только известные материалы и семь ключей эстетик, пригодные для построения серверного пути. |
| `integer` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `cursor` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `libraryMime` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `file` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `page` | 52 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LibraryFile` | 55 | Контракт типов. Подробности и ограничения — в исходнике. |
| `parseLibraryFiles` | 58 | Проверяем одну страницу и точное соответствие URL материалу: произвольная ссылка или дубль делает весь ответ недействительным. |
| `getLibraryFiles` | 77 | Собираем полный проверенный список с ограничением числа страниц; частичный результат и публичный запасной URL не выдаём. |

## [apps/frontend/src/features/library/library-files-dialog.module.scss](../../../apps/frontend/src/features/library/library-files-dialog.module.scss)

Оформление компонента: Список скачивания берётся из защищённого API.

## [apps/frontend/src/features/library/library-files-dialog.tsx](../../../apps/frontend/src/features/library/library-files-dialog.tsx)

Модуль library-files-dialog.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `LibraryFilesDialog` | 13 | Показываем только подтверждённые серверные привязки и открываем скачивание в отдельном окне с текущей cookie-сессией. |

## [apps/frontend/src/features/library/library-screen.content.ts](../../../apps/frontend/src/features/library/library-screen.content.ts)

Ресурсы и подписи витрины Библиотеки отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DEFAULT_COVER_ASPECT` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BANNER_URL` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `GUIDE_BANNER_URL` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `STILIZACII_COVER_URL` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `STILIZACII_YANDEX_URL` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `RECIPES_COVER_URL` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PETERBURG_COVER_URL` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PATTERNS_COVER_URL` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LOSHADKA_COVER_URL` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LOSHADKA_PDF_URL` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ABOUT_ME_COVER_URL` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 27 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `OLIVE_BG` | 28 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `MaterialCard` | 29 | Контракт типов. Подробности и ограничения — в исходнике. |
| `MaterialItem` | 35 | Контракт типов. Подробности и ограничения — в исходнике. |
| `MATERIALS` | 45 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `GRID_GAP` | 111 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `HORIZONTAL_PADDING` | 112 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CARD_META_HEIGHT` | 114 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getLibraryScreenContent` | 117 | Вычисляем ширину двух колонок из доступного viewport с теми же полями и зазором, которые использует витрина. |

## [apps/frontend/src/features/library/library-screen.module.scss](../../../apps/frontend/src/features/library/library-screen.module.scss)

Оформление компонента: Витрина библиотеки различает переход в материал и выдачу файла.

## [apps/frontend/src/features/library/library-screen.tsx](../../../apps/frontend/src/features/library/library-screen.tsx)

Модуль library-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `splitMasonryColumns` | 43 | Сохраняем исходную очередность карточек, каждый раз добавляя следующую в более короткую колонку по оценке высоты обложки и подписи. |
| `LibraryScreen` | 67 | Объединяем статические материалы и статьи API; тип действия определяет переход, внешний PDF или диалог защищённых файлов. |

## [apps/frontend/src/features/library/patterns-screen.content.ts](../../../apps/frontend/src/features/library/patterns-screen.content.ts)

Ресурсы и подписи выкроек Библиотеки отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_LIGHT` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `OLIVE_BG` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PATTERNS_HERO_URL` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PatternItem` | 14 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CHRISTMAS_PATTERNS` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LOSHADKA_COVER_URL` | 41 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getPatternsScreenContent` | 45 | Передаём размеры viewport в расчёт карточек и полноэкранного просмотра без повторного чтения окна. |

## [apps/frontend/src/features/library/patterns-screen.layout.ts](../../../apps/frontend/src/features/library/patterns-screen.layout.ts)

Геометрия выкроек Библиотеки рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getPatternsScreenLayout` | 7 | Разводим геометрию двух колонок и области просмотра: полотно изображения занимает 70% высоты экрана. |

## [apps/frontend/src/features/library/patterns-screen.module.scss](../../../apps/frontend/src/features/library/patterns-screen.module.scss)

Оформление компонента: Клубные выкройки открываются по серверным привязкам.

## [apps/frontend/src/features/library/patterns-screen.tsx](../../../apps/frontend/src/features/library/patterns-screen.tsx)

Модуль patterns-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PatternsScreen` | 47 | Пересоздаём локальное состояние выкроек при смене аккаунта или клубного доступа, исключая перенос открытого просмотра. |
| `PatternsScreenContent` | 55 | Разделяем четыре закрытые выкройки по серверным привязкам и бесплатный PDF «Лошадки», который открывается независимо от подписки. |
| `FullScreenViewerProps` | 357 | Контракт типов. Подробности и ограничения — в исходнике. |
| `FullScreenViewer` | 367 | Показываем оригинал для печати с независимым масштабированием; закрытие возвращает масштаб и смещение в исходное состояние. |

## [apps/frontend/src/features/library/private-library-state.tsx](../../../apps/frontend/src/features/library/private-library-state.tsx)

Модуль private-library-state.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PrivateLibraryState` | 8 | Разделяем ожидание, ошибку с повтором и успешный ответ без готового материала. |

## [apps/frontend/src/features/library/use-aesthetic-visuals.ts](../../../apps/frontend/src/features/library/use-aesthetic-visuals.ts)

Модуль use-aesthetic-visuals.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Group` | 14 | Контракт типов. Подробности и ограничения — в исходнике. |
| `AestheticVisualRequest` | 15 | Контракт типов. Подробности и ограничения — в исходнике. |
| `useAestheticVisuals` | 23 | Параллельно читаем привязки нужных эстетик и сопоставляем их с порядком иллюстраций; старые результаты не переживают перепроверку доступа. Байты иллюстраций остаются no-store. |

## [apps/frontend/src/features/library/use-library-files.ts](../../../apps/frontend/src/features/library/use-library-files.ts)

Модуль use-library-files.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `useLibraryFiles` | 9 | Привязываем ссылки к текущему аккаунту и материалу; на перепроверке доступа скрываем ранее полученные привязки. |

## [apps/frontend/src/features/profile/profile-name-editor.tsx](../../../apps/frontend/src/features/profile/profile-name-editor.tsx)

Модуль profile-name-editor.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ProfileNameEditor` | 18 | Отделяем локальный ввод имени от подтверждённого профиля; unknown и review управляются общим revision-aware hook. |

## [apps/frontend/src/features/profile/profile-screen.content.ts](../../../apps/frontend/src/features/profile/profile-screen.content.ts)

Ресурсы и подписи личного профиля отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 2 | Ресурсы и подписи личного профиля отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `BROWN` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `OLIVE` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PROFILE_NAME_KEY` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PROFILE_GENDER_KEY` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PROFILE_AVATAR_KEY` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SUPPORT_EMAIL` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PERSONAL_MOODBOARDS_ENABLED` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/profile/profile-screen.module.scss](../../../apps/frontend/src/features/profile/profile-screen.module.scss)

Оформление компонента: Профиль объединяет подтверждённые данные аккаунта, подписку и страницы сохранённого.

## [apps/frontend/src/features/profile/profile-screen.tsx](../../../apps/frontend/src/features/profile/profile-screen.tsx)

Модуль profile-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `SavedPost` | 62 | Контракт типов. Подробности и ограничения — в исходнике. |
| `SavedTab` | 63 | Контракт типов. Подробности и ограничения — в исходнике. |
| `formatRuDate` | 65 | Форматируем подтверждённую дату доступа в русской локали для профиля. |
| `openSupportMail` | 73 | Открываем письмо поддержки с закодированной темой; отправка остаётся действием почтового клиента. |
| `CropperImage` | 78 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ProfileScreen` | 84 | Собираем личный профиль без общего paywall: открытые сохранения доступны аккаунту без клуба, клубные данные дополнительно фильтруются по правам. |

## [apps/frontend/src/features/profile/use-subscription-cancellation.tsx](../../../apps/frontend/src/features/profile/use-subscription-cancellation.tsx)

Модуль use-subscription-cancellation.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Notice` | 28 | Контракт типов. Подробности и ограничения — в исходнике. |
| `unconfirmed` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `requested` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `validExpiration` | 35 | Ответ отмены допускает null или пригодную абсолютную дату, не NaN/Infinity. |
| `requireSubscription` | 44 | Повторное чтение прав проходит тот же runtime-контракт, что общий провайдер подписки. |
| `useCancellationController` | 49 | Храним неизвестный исход отмены выше экрана профиля; pending провайдера и подтверждённая отмена имеют разные состояния. После timeout повторяем чтение, а не команду отмены. |
| `CancellationContext` | 188 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SubscriptionCancellationProvider` | 193 | Удерживаем controller в области аккаунта независимо от временного размонтирования профиля. |
| `useSubscriptionCancellation` | 209 | Возвращаем единый controller отмены из провайдера, не создавая новый разрешённый повтор на каждом экране. |

## [apps/frontend/src/features/pwa/install-guide.content.ts](../../../apps/frontend/src/features/pwa/install-guide.content.ts)

Ресурсы и подписи подсказки установки приложения отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `SEEN_KEY` | 2 | Ресурсы и подписи подсказки установки приложения отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `BROWN` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/pwa/install-guide.module.scss](../../../apps/frontend/src/features/pwa/install-guide.module.scss)

Оформление компонента: Подсказка установки учитывает возможности браузера.

## [apps/frontend/src/features/pwa/install-guide.tsx](../../../apps/frontend/src/features/pwa/install-guide.tsx)

Модуль install-guide.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `isStandaloneWeb` | 10 | Распознаём установленный режим браузера через iOS standalone либо display-mode; при SSR отвечаем false. |
| `isIosWeb` | 21 | Выбираем текст инструкции для iOS по доступному userAgent; это подсказка установки, не проверка поддержки офлайн. |
| `Step` | 26 | Оформляем один статический шаг инструкции с декоративным значком. |
| `InstallGuide` | 45 | Не показываем инструкцию установленному приложению или после отметки seen; позднее чтение storage отменяется при уходе. |

## [apps/frontend/src/features/pwa/web-post-alerts.tsx](../../../apps/frontend/src/features/pwa/web-post-alerts.tsx)

Модуль web-post-alerts.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `FEED_SEEN_KEY` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CLUB_SEEN_KEY` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `canNotify` | 10 | Проверяем существование браузерного Notification API и уже выданное разрешение. |
| `showNote` | 16 | Пробуем локальное уведомление без обещания гарантированной доставки; отказ платформы не ломает чтение постов. |
| `WebPostAlerts` | 23 | При включённой возможности опрашиваем latest и сравниваем локальные seen-маркеры; первый запуск только инициализирует базу. |

## [apps/frontend/src/features/quiz/aesthetic-result-content.module.scss](../../../apps/frontend/src/features/quiz/aesthetic-result-content.module.scss)

Оформление компонента: Расширенный результат отображает проверенный гайд и набор иллюстраций отдельно от бесплатного подсчёта эстетики.

## [apps/frontend/src/features/quiz/aesthetic-result-content.tsx](../../../apps/frontend/src/features/quiz/aesthetic-result-content.tsx)

Модуль aesthetic-result-content.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ClubContentSection` | 39 | По ключу эстетики выбираем порядок иллюстраций, затем заменяем исходные идентификаторы защищёнными URL; без привязок не показываем неполный расширенный результат. |

## [apps/frontend/src/features/quiz/interactive-banner.tsx](../../../apps/frontend/src/features/quiz/interactive-banner.tsx)

Модуль interactive-banner.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `keyDecor` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ivyLeft` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ivyRight` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `InteractiveBanner` | 11 | Собираем анимированную декоративную шапку; порядок ветвей и карточек согласуется слоями контейнера интерактива. |

## [apps/frontend/src/features/quiz/interactive-screen.content.ts](../../../apps/frontend/src/features/quiz/interactive-screen.content.ts)

Ресурсы и подписи раздела Интерактив отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 2 | Ресурсы и подписи раздела Интерактив отделены от компонентов; изменение этих данных входит в клиентскую сборку. |
| `BROWN` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/features/quiz/interactive-screen.module.scss](../../../apps/frontend/src/features/quiz/interactive-screen.module.scss)

Оформление компонента: Раздел интерактива связывает тест и сохранённый результат, оставляя доступ к расширенным материалам проверке подписки.

## [apps/frontend/src/features/quiz/interactive-screen.tsx](../../../apps/frontend/src/features/quiz/interactive-screen.tsx)

Модуль interactive-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `quizCover` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `InteractiveScreen` | 20 | Показываем точку входа в бесплатный тест; карточка перекрывает нижние хвосты декора шапки. |

## [apps/frontend/src/features/quiz/quiz-question.content.ts](../../../apps/frontend/src/features/quiz/quiz-question.content.ts)

Ресурсы и подписи вопроса теста отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `GRID_PADDING` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `GRID_GAP` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `WARM_MILKY` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_TEXT` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SWIPE_QUESTION_IDS` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getQuizQuestionContent` | 15 | Рассчитываем общую геометрию сетки и высокий формат слайдера из viewport; настройки строк остаются в данных вопроса. |

## [apps/frontend/src/features/quiz/quiz-question.layout.ts](../../../apps/frontend/src/features/quiz/quiz-question.layout.ts)

Геометрия вопроса теста рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getQuizQuestionLayout` | 7 | Согласуем размеры слайдов, полей картинки и карточек на один, два или три ответа в строке. |

## [apps/frontend/src/features/quiz/quiz-question.module.scss](../../../apps/frontend/src/features/quiz/quiz-question.module.scss)

Оформление компонента: Экран вопроса передаёт выбранный answerId и номер вопроса модели теста.

## [apps/frontend/src/features/quiz/quiz-question.tsx](../../../apps/frontend/src/features/quiz/quiz-question.tsx)

Модуль quiz-question.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `RichAnswerText` | 29 | Разбираем только локальные маркеры жирного и курсива в тексте ответа; фрагменты остаются React-текстом без вставки HTML. |
| `QuizQuestion` | 89 | Выбираем визуальный слайдер, сетку или текст по данным вопроса; сохранение и последовательность переходов делегированы потоку. |

## [apps/frontend/src/features/quiz/quiz-result.content.ts](../../../apps/frontend/src/features/quiz/quiz-result.content.ts)

Ресурсы и подписи результата теста отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_LIGHT` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `HOUSE_IMAGES` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `COTTAGECORE_MOODBOARDS` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `COTTAGECORE_OUTFITS` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `COTTAGECORE_INTERIORS` | 46 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DARKACADEMIA_OUTFITS` | 52 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DARKACADEMIA_MOODBOARDS` | 67 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DARKACADEMIA_INTERIORS` | 77 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `GOBLINCORE_OUTFITS` | 87 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `GOBLINCORE_MOODBOARDS` | 104 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `GOBLINCORE_INTERIORS` | 113 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CASTLECORE_OUTFITS` | 124 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CASTLECORE_MOODBOARDS` | 138 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CASTLECORE_INTERIORS` | 149 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `WITCHCORE_OUTFITS` | 164 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `WITCHCORE_MOODBOARDS` | 183 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `WITCHCORE_INTERIORS` | 194 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FAIRYCORE_OUTFITS` | 204 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FAIRYCORE_MOODBOARDS` | 218 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FAIRYCORE_INTERIORS` | 228 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LIGHTACADEMIA_OUTFITS` | 240 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LIGHTACADEMIA_MOODBOARDS` | 258 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `LIGHTACADEMIA_INTERIORS` | 271 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getQuizResultContent` | 286 | Передаём ширину в геометрию результата; массивы выше задают порядок исходных иллюстраций для защищённых привязок. |

## [apps/frontend/src/features/quiz/quiz-result.layout.ts](../../../apps/frontend/src/features/quiz/quiz-result.layout.ts)

Геометрия результата теста рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getQuizResultLayout` | 7 | Разделяем размеры героя, образов, мудбордов и интерьеров, сохраняя их редакционные пропорции. |

## [apps/frontend/src/features/quiz/quiz-result.module.scss](../../../apps/frontend/src/features/quiz/quiz-result.module.scss)

Оформление компонента: Открытый итог теста и клубное продолжение имеют разные источники данных.

## [apps/frontend/src/features/quiz/quiz-result.tsx](../../../apps/frontend/src/features/quiz/quiz-result.tsx)

Модуль quiz-result.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `QuizResultScreen` | 33 | Показываем бесплатный итог и по явному действию запрашиваем клубное продолжение выбранной эстетики. |

## [apps/frontend/src/features/quiz/quiz-screen.tsx](../../../apps/frontend/src/features/quiz/quiz-screen.tsx)

Модуль quiz-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `QuizScreen` | 30 | Ждём установления владельца сессии и пересоздаём поток для каждого аккаунта и режима просмотра результата. |
| `QuizFlow` | 47 | Владеем очередью действий теста, сохранением под межвкладочной блокировкой и защитой от поздних операций предыдущего прохода. |
| `SavedQuizScreen` | 354 | Открываем тот же поток в режиме наблюдения за сохранённым результатом вместо восстановления незавершённых вопросов. |

## [apps/frontend/src/features/quiz/quiz-welcome.content.ts](../../../apps/frontend/src/features/quiz/quiz-welcome.content.ts)

Ресурсы и подписи приветствия теста отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getQuizWelcomeContent` | 10 | Передаём ширину viewport в расчёт приветственного коллажа. |

## [apps/frontend/src/features/quiz/quiz-welcome.layout.ts](../../../apps/frontend/src/features/quiz/quiz-welcome.layout.ts)

Геометрия приветствия теста рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getQuizWelcomeLayout` | 7 | Сохраняем соотношение сторон коллажа при изменении ширины экрана. |

## [apps/frontend/src/features/quiz/quiz-welcome.module.scss](../../../apps/frontend/src/features/quiz/quiz-welcome.module.scss)

Оформление компонента: Приветствие начинает новый проход теста через его модель, не редактируя ответы в браузерном хранилище напрямую.

## [apps/frontend/src/features/quiz/quiz-welcome.tsx](../../../apps/frontend/src/features/quiz/quiz-welcome.tsx)

Модуль quiz-welcome.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `QuizWelcome` | 20 | Показываем условия теста и запускаем новый проход через reducer, оставляя сохранение владельцу потока. |

## [apps/frontend/src/features/shop/product-screen.content.ts](../../../apps/frontend/src/features/shop/product-screen.content.ts)

Ресурсы и подписи карточки товара отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_LIGHT` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SHOP_MISSING_FILES` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getProductScreenContent` | 33 | Размер карусели задаётся долей ширины; детальный каталог переиспользуется из domain без копирования товаров. |

## [apps/frontend/src/features/shop/product-screen.layout.ts](../../../apps/frontend/src/features/shop/product-screen.layout.ts)

Геометрия карточки товара рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getProductScreenLayout` | 7 | Передаём размеры обложки, превью и модального просмотра одной карточке товара. |

## [apps/frontend/src/features/shop/product-screen.module.scss](../../../apps/frontend/src/features/shop/product-screen.module.scss)

Оформление компонента: Карточка товара готовит письмо по актуальному контакту менеджера.

## [apps/frontend/src/features/shop/product-screen.tsx](../../../apps/frontend/src/features/shop/product-screen.tsx)

Модуль product-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `isPublicShopAsset` | 34 | Пропускаем известные отсутствующие legacy-файлы shop, сохраняя остальные адреса каталога без переписывания. |
| `ProductDetailScreen` | 40 | Показываем статическую карточку и галереи; цифровой заказ открывает только свежий контакт менеджера, а не фиктивную оплату. |

## [apps/frontend/src/features/shop/shelf-item.module.scss](../../../apps/frontend/src/features/shop/shelf-item.module.scss)

Оформление компонента: Товар на полке связывает иллюстрацию с маршрутом, оставляя порядок и группировку общему экрану магазина.

## [apps/frontend/src/features/shop/shelf-item.tsx](../../../apps/frontend/src/features/shop/shelf-item.tsx)

Модуль shelf-item.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ShelfItem` | 20 | Представляем товар как отдельное действие полки; выбранные размеры могут переопределить стандартные размеры книги. |

## [apps/frontend/src/features/shop/shelf-label.module.scss](../../../apps/frontend/src/features/shop/shelf-label.module.scss)

Оформление компонента: Подпись полки оформляет группу товаров и не влияет на адреса карточек или порядок каталога.

## [apps/frontend/src/features/shop/shelf-label.tsx](../../../apps/frontend/src/features/shop/shelf-label.tsx)

Модуль shelf-label.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ShelfLabel` | 13 | Собираем декоративную рамку и односложную подпись полки, сохраняя внешний style для рассчитанного положения. |

## [apps/frontend/src/features/shop/shop-screen.content.ts](../../../apps/frontend/src/features/shop/shop-screen.content.ts)

Ресурсы и подписи витрины Магазина отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SHOP_BROWN` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ASSETS` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BOOK_GAP` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getShopScreenContent` | 29 | Вычисляем пропорции полок, книг, цифровых товаров и табличек из одной ширины полотна. |

## [apps/frontend/src/features/shop/shop-screen.module.scss](../../../apps/frontend/src/features/shop/shop-screen.module.scss)

Оформление компонента: Витрина использует каталог сборки и ссылки на карточки товаров.

## [apps/frontend/src/features/shop/shop-screen.tsx](../../../apps/frontend/src/features/shop/shop-screen.tsx)

Модуль shop-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ShopScreenInner` | 41 | Привязываем товарные карточки к координатам исходной иллюстрации полки; фокус экрана управляет только декоративными анимациями. |
| `ShopScreen` | 624 | Сохраняем общую внешнюю stack-обёртку экрана, оставляя всю витрину внутреннему компоненту. |

## [apps/frontend/src/features/videos/catalog-api.ts](../../../apps/frontend/src/features/videos/catalog-api.ts)

Парсеры каталога и воспроизведения отделяют метаданные карточки от источника, для которого сервер проверяет доступ.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `isVkCatalogEnabled` | 8 | Флаг сборки выбирает новый каталог; это не проверка наличия серверного доступа к отдельному ролику. |
| `isVideoThumbnailsEnabled` | 12 | Запрашиваем расширенный контракт обложек только после согласованного opt-in выпуска. |
| `videoCatalogInput` | 15 | Собираем wire-input без неопределённых полей, добавляя includeThumbnails только при включённой возможности. |
| `normalizeVkThumbnailUrl` | 23 | При редактировании допускаем документированные публичные местоположения обложек без query и неоднозначных кодировок; это не общий парсер просмотра. |
| `id` | 57 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `card` | 58 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `page` | 69 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `VideoCard` | 72 | Контракт типов. Подробности и ограничения — в исходнике. |
| `videoThumbnailUrl` | 74 | Для показа принимаем безопасную картинку, исключая защищённое API и адрес самого iframe-провайдера. |
| `parseVideoCatalog` | 86 | Проверяем strict форму карточек и страницы до помещения ответа в query-кеш. |
| `getVkCatalogEmbedUrl` | 92 | Дополнительно ограничиваем каталог разрешёнными уникальными параметрами iframe, затем применяем общий VK-парсер. |
| `playback` | 116 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `parseVideoPlayback` | 129 | Сверяем playback-source с запрошенным ID и провайдером; VK и прямой videoUrl имеют разные проверки адреса. |
| `nextVideoCursor` | 148 | Продолжаем только возрастающую неповторённую границу; старую/циклическую страницу нельзя пришить к текущей цепочке. |
| `stalledVideoCursor` | 160 | Отличаем завершение nextCursor=null от непродолжаемого ошибочного курсора. |
| `requireVkVideoId` | 169 | ACK создания VK должен содержать только валидный ID; успешный HTTP недостаточен. |
| `vkEditorDetail` | 175 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `VkEditorDetail` | 184 | Контракт типов. Подробности и ограничения — в исходнике. |
| `parseVkEditorDetail` | 186 | Сверяем detail редактора с нужным ID, поддерживаемой revision и пригодным VK embed URL. |

## [apps/frontend/src/features/videos/catalog-screen.tsx](../../../apps/frontend/src/features/videos/catalog-screen.tsx)

Модуль catalog-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `VideoCatalogScreen` | 31 | Смена аккаунта пересоздаёт локальное окно каталога через owner-key. |
| `Catalog` | 38 | Сохраняем серверный порядок страниц и показываем фоновые ошибки отдельно от подтверждённых карточек. |
| `ThumbnailUnavailable` | 190 | Явно показываем отсутствие обложки без подмены источника самого видео. |

## [apps/frontend/src/features/videos/catalog-video-detail.tsx](../../../apps/frontend/src/features/videos/catalog-video-detail.tsx)

Модуль catalog-video-detail.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CatalogVideoDetail` | 29 | Источник воспроизведения получаем отдельно от карточки; ключ user+epoch и gcTime=0 требуют новой проверки при каждом реальном возврате. |

## [apps/frontend/src/features/videos/playback-lifecycle.ts](../../../apps/frontend/src/features/videos/playback-lifecycle.ts)

Каждый возврат к проигрыванию меняет эпоху проверки, включая восстановление страницы из bfcache.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `RESUME_CHECK_COOLDOWN_MS` | 2 | Каждый возврат к проигрыванию меняет эпоху проверки, включая восстановление страницы из bfcache. |
| `PlaybackLifecycle` | 5 | Each return to a page needs new playback authority, including bfcache restores. |

## [apps/frontend/src/features/videos/use-video-catalog.ts](../../../apps/frontend/src/features/videos/use-video-catalog.ts)

Модуль use-video-catalog.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `useVideoCatalog` | 39 | Храним ограниченное окно страниц с отдельным head; свежие границы, ownerScope и request time не дают смешать старый хвост с новым. Фоновое чтение ограничено головой и двумя видимыми страницами; явное обновление подтверждает новую цепочку атомарно. |

## [apps/frontend/src/features/videos/video-detail-view.tsx](../../../apps/frontend/src/features/videos/video-detail-view.tsx)

Модуль video-detail-view.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `VideoDetailView` | 18 | Отображаем готовый player в общей геометрии; право воспроизведения и выбор источника остаются у родителя. |

## [apps/frontend/src/features/videos/video-screen.content.ts](../../../apps/frontend/src/features/videos/video-screen.content.ts)

Ресурсы и подписи страницы воспроизведения отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getVideoScreenContent` | 8 | Задаём геометрию плеера 16:9 от ширины полотна приложения. |

## [apps/frontend/src/features/videos/video-screen.layout.ts](../../../apps/frontend/src/features/videos/video-screen.layout.ts)

Геометрия страницы воспроизведения рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getVideoScreenLayout` | 7 | Передаём размер видеослота компонентам страницы без решения о провайдере или доступе. |

## [apps/frontend/src/features/videos/video-screen.module.scss](../../../apps/frontend/src/features/videos/video-screen.module.scss)

Оформление компонента: Старая страница видео отделена от каталожного протокола.

## [apps/frontend/src/features/videos/video-screen.tsx](../../../apps/frontend/src/features/videos/video-screen.tsx)

Модуль video-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `VideoDetailScreen` | 28 | Согласуем detail с выбранным каталогом сборки, сохраняя legacy путь до завершения rollout. |
| `LegacyVideoDetail` | 36 | Читаем старую деталь активного экрана; временный фоновой сбой оставляет подтверждённое видео, отказ доступа скрывает его. |

## [apps/frontend/src/features/videos/videos-banner.tsx](../../../apps/frontend/src/features/videos/videos-banner.tsx)

Модуль videos-banner.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BannerContent` | 14 | Собираем статический декор каталога отдельно от запроса роликов. |
| `bannerHasEntered` | 41 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `VideosBannerHeader` | 43 | Анимацию входа проигрываем только при первом реальном браузерном монтировании, не отмечая SSR как просмотр. |

## [apps/frontend/src/features/videos/videos-screen.content.ts](../../../apps/frontend/src/features/videos/videos-screen.content.ts)

Ресурсы и подписи списка видео отделены от компонентов; изменение этих данных входит в клиентскую сборку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PAPER_TEXTURE_URI` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_MUTED` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CREAM` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CARD_H_PADDING` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ROSE_W` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ROSE_H` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ROSE_TOP` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ROSE_INSET` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `HEADER_MIN_HEIGHT` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getVideosScreenContent` | 18 | Вычисляем ширину карточки после горизонтальных отступов и высоту её постера 16:9. |

## [apps/frontend/src/features/videos/videos-screen.layout.ts](../../../apps/frontend/src/features/videos/videos-screen.layout.ts)

Геометрия списка видео рассчитывается из viewport отдельно от данных и обработчиков экрана.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `getVideosScreenLayout` | 7 | Сводим расчёт превью к одному стилевому слоту, используемому обоими каталогами. |

## [apps/frontend/src/features/videos/videos-screen.module.scss](../../../apps/frontend/src/features/videos/videos-screen.module.scss)

Оформление компонента: Старый и новый каталоги выбираются по настройке сборки.

## [apps/frontend/src/features/videos/videos-screen.tsx](../../../apps/frontend/src/features/videos/videos-screen.tsx)

Модуль videos-screen.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Video` | 32 | Контракт типов. Подробности и ограничения — в исходнике. |
| `VideosScreenInner` | 34 | Старый список продолжает читать прежний контракт до включения каталога VK; локальный refresh не меняет playback-права. |
| `VideosScreen` | 187 | Выбираем старый или новый протокол каталога единственным build-флагом. |

## [apps/frontend/src/proxy.ts](../../../apps/frontend/src/proxy.ts)

Серверный proxy разделяет маршруты приложения и защищённых ресурсов, добавляя политику документа до рендера страницы.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `loopbackHosts` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `proxy` | 11 | Сначала закрываем retired/legacy пути, затем разделяем API и документы; nonce переопределяем независимо от входных заголовков клиента. |
| `proxyApi` | 52 | Только локальному dev proxy с HTTPS upstream подменяем Origin после проверки loopback и same-origin; production не переписываем. Cookie и серверные проверки авторизации сохраняются; локальный HTTP API не затрагиваем. |
| `forbidden` | 79 | Отклоняем неподходящий dev-запрос без кеширования отказа. |
| `config` | 86 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/api/access-email.ts](../../../apps/frontend/src/shared/api/access-email.ts)

Ответ постановки письма в очередь проверяется отдельно от фактической доставки получателю.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `resendAccessEmail` | 9 | Повтор письма отправляем с проверенными userId и ключом, принимая только 202 queued=true как постановку в очередь. queued подтверждает очередь, а не доставку письма. |

## [apps/frontend/src/shared/api/action-result.ts](../../../apps/frontend/src/shared/api/action-result.ts)

Небольшие валидаторы подтверждают результат мутации до изменения локального интерфейса.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `requireOk` | 5 | Успехом мутации считаем явное ok=true в объекте, а не любой ответ с HTTP 200. |
| `requireCommentLike` | 14 | Подтверждение отметки должно содержать и булев результат, и допустимый счётчик: частичный ответ нельзя применить к карточке. |
| `requireGrant` | 25 | Проверяем успешную выдачу доступа с будущим ISO-сроком; malformed дата не превращается в визуально активную подписку. |
| `requireIdList` | 37 | Сначала подтверждаем структуру всего списка, чтобы дальнейшая проверка отсутствия ID не использовала повреждённые данные. |
| `requireAbsentId` | 48 | Отсутствие удалённой записи принимаем только в проверенном списке; нераспознанный ответ не подтверждает удаление. |

## [apps/frontend/src/shared/api/admin-actions.ts](../../../apps/frontend/src/shared/api/admin-actions.ts)

Транспорт административных операций отделён от журнала: ключ и статус позволяют проверять результат без повторной команды.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `AdminActionRequest` | 14 | Контракт типов. Подробности и ограничения — в исходнике. |
| `AdminActionStatus` | 19 | Контракт типов. Подробности и ограничения — в исходнике. |
| `AdminActionApi` | 20 | Контракт типов. Подробности и ограничения — в исходнике. |
| `requestSchema` | 30 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `statusSchema` | 35 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `parseAdminActionStatus` | 41 | Квитанция должна соответствовать виду команды и целевому userId, а не просто иметь правильную форму. |
| `adminActionApi` | 57 | Объединяем REST постановки письма и tRPC продления под транспортом журнала; оба пути возвращают проверенный outcome. |
| `adminActionRetryAt` | 103 | Из REST/tRPC извлекаем только положительные целые секунды и безопасный deadline, не используя произвольное значение из ошибки. |

## [apps/frontend/src/shared/api/auth.ts](../../../apps/frontend/src/shared/api/auth.ts)

REST-методы входа и профиля проверяют публичный ответ; HttpOnly-cookie остаётся транспортом браузерной сессии.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `isObject` | 10 | Для REST-конвертов нужен объект полей; массив и null не подтверждают форму ответа. |
| `retryAfter` | 14 | Предпочитаем положительную задержку тела, иначе разбираем HTTP-заголовок одним общим парсером. |
| `apiCall` | 26 | Общий REST-вызов читает JSON внутри deadline, нормализует ошибки и отключает HTTP-кеш; T задаёт ожидание, а не runtime-валидацию payload. |
| `AuthUser` | 69 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Session` | 82 | Контракт типов. Подробности и ограничения — в исходнике. |
| `parseAuthUser` | 87 | Проверяем обязательные поля профиля и собираем публичный объект явно, не распространяя внутренние серверные поля через spread. |
| `authenticate` | 139 | Ожидаем конверт с валидным user после POST; токен не возвращается и не сохраняется в браузерном хранилище. |
| `loginWithEmail` | 153 | Вход отправляет email/пароль и необязательный TOTP существующему REST login, сохраняя сигнал владельца формы. |
| `requestInstructions` | 162 | Регистрация или recovery принимают только ok=true и непустую инструкцию; этот ответ не подтверждает доставку письма. |
| `registerWithEmail` | 182 | Передаём версию согласия вместе с данными регистрации и возвращаем только принятую сервером инструкцию. |
| `requestPasswordInstructions` | 194 | Просим инструкцию для email без создания сессии; установку пароля выполняет отдельный одноразовый endpoint. |
| `sendSmsCode` | 199 | Совместимый SMS-метод только отправляет запрос коду; доступность функции контролируется отдельно capabilities. |
| `verifySmsCode` | 205 | Проверка кода использует тот же парсер публичной сессии, что и email-вход; сама функция не включает SMS-сценарий. |
| `logout` | 213 | Серверный выход подтверждается явным success=true; непонятный ответ оставляет отзыв сессии неподтверждённым. |
| `getMe` | 221 | Отличаем подтверждённый user=null от ошибки конверта или чтения; остальные профили проходят parseAuthUser. |
| `establishSession` | 227 | Совместимый обмен отправляет bearer только на сервер установки сессии; локально строка токена не сохраняется. |

## [apps/frontend/src/shared/api/capabilities.ts](../../../apps/frontend/src/shared/api/capabilities.ts)

Модуль capabilities.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `APP_CAPABILITIES_QUERY_KEY` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `uploadUnavailableMessage` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PrivateUploadCapability` | 12 | Контракт типов. Подробности и ограничения — в исходнике. |
| `unavailable` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getAppCapabilities` | 28 | Проверяем boolean-флаги ответа; отсутствие обязательного privateContentUploads не должно случайно выбрать unkeyed запись комментария. |
| `useCapabilities` | 56 | Кешируем публичные возможности на минуту, но при ошибке UI консервативно получает выключенный набор. |
| `frontendCapabilities` | 70 | Продуктовый запрет SMS сильнее совместимого server hint; wire-ответ сохраняется, но UI получает smsLogin=false. |
| `requirePrivateUpload` | 79 | На границе новой загрузки читаем серверную политику заново; видео требует ещё и закрытых фото для генерируемого постера. |

## [apps/frontend/src/shared/api/club-access.ts](../../../apps/frontend/src/shared/api/club-access.ts)

Ответ подписки проверяем отдельно от результата покупки: исторически успешный заказ не подтверждает текущий доступ.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `parseClubAccess` | 6 | Проверяем признаки прав, оплаты и отмены отдельно, приводя срок к Date без вывода доступа из одной только даты. |
| `requireClubClaim` | 44 | У claim должны согласоваться granted и orderId: отказ не может притворяться подтверждённым заказом. |

## [apps/frontend/src/shared/api/content-refresh.ts](../../../apps/frontend/src/shared/api/content-refresh.ts)

Периодическое обновление относится к активным экранам контента; операции оплаты и получения закрытых файлов используют собственный жизненный цикл.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CONTENT_REFRESH_INTERVAL_MS` | 2 | Периодическое обновление относится к активным экранам контента; операции оплаты и получения закрытых файлов используют собственный жизненный цикл. |
| `contentRefreshOptions` | 5 | Возвращаем opt-in настройки периодического чтения контента; активность управляет interval и возобновлением, без фонового опроса скрытого документа. Оплата, скачивание и воспроизведение используют собственные правила жизненного цикла. |

## [apps/frontend/src/shared/api/contract.ts](../../../apps/frontend/src/shared/api/contract.ts)

Generated from apps/backend/src/routers.ts. Run pnpm api:contract after API changes.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `RichTextBlock` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PostMedia` | 13 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PublicVideo` | 26 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PostStatistics` | 53 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ArticleBlock` | 67 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PostCommentRow` | 74 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PenPalMatchCard` | 88 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CommentReportInboxRow` | 102 | Контракт типов. Подробности и ограничения — в исходнике. |
| `RichTextInline` | 116 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ArticleBlockType` | 122 | Контракт типов. Подробности и ограничения — в исходнике. |
| `AppRouter` | 129 | Контракт типов. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/api/cursor-pages.ts](../../../apps/frontend/src/shared/api/cursor-pages.ts)

Чистые операции над страницами сохраняют навигационные курсоры без удержания всех ранее просмотренных карточек.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `cursorQueryKey` | 5 | Добавляем владельца и версию контракта к исходному queryKey, чтобы несовместимые страницы не разделили кеш. |
| `cancelInactiveCursorQuery` | 14 | Откладываем проверку до microtask: соседний observer может подписаться в том же проходе React и ещё нуждаться в запросе. |
| `CursorPage` | 21 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CursorChain` | 22 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CursorChainError` | 29 | Класс. Подробности и ограничения — в исходнике. |
| `CursorChainError.constructor` | 31 | Отдельный вид ошибки позволяет UI выбрать перечитывание цепочки вместо повторной отправки зацикленного курсора. |
| `appendCursorPage` | 38 | Присоединяем страницу только при новом токене; повтор любого удержанного или возвратного курсора считается нарушением цепочки. |
| `POST_PAGE_WINDOW` | 63 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CURSOR_PAGE_LIMIT` | 64 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `boundary` | 66 | Для сравнения головы достаточно порядка ID и nextCursor: полные тексты отброшенных карточек удерживать не нужно. |
| `boundCursorChain` | 73 | Оставляем окно нужного направления и лёгкую историю курсоров; начало окна определяет, какую сторону карточек освобождаем. |
| `prependCursorPage` | 102 | Возвращаем ранее отброшенную страницу по сохранённому непрозрачному токену и требуем совпадения её границы с текущей головой окна. Данные отброшенных карточек не остаются во втором кэше страниц. |
| `sameBoundary` | 122 | Порядок ID важен наравне с курсором: перестановка или исчезновение карточки требует пересборки соответствующего окна. |
| `refreshCursorChain` | 128 | Читаем свежую голову и выбранные видимые страницы; смена границы запускает согласованную пересборку удержанного окна до commit. |

## [apps/frontend/src/shared/api/errors.ts](../../../apps/frontend/src/shared/api/errors.ts)

Публичные сообщения об ошибках отделяем от транспортных деталей и различаем отказ доступа, временный сбой и отмену.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ApiErrorKind` | 2 | Публичные сообщения об ошибках отделяем от транспортных деталей и различаем отказ доступа, временный сбой и отмену. |
| `ApiError` | 10 | Классификация ошибки хранит безопасное сообщение вместе с HTTP-статусом, задержкой и машинным видом сбоя. |
| `ApiError.constructor` | 12 | Сообщение передаётся Error, остальные поля остаются структурированными признаками для UI и политики повторов. |
| `invalidResponse` | 25 | Повреждённый успешный ответ выделяем в отдельный вид; он не доказывает, что запись не состоялась. |
| `getRequestErrorMessage` | 36 | Извлекаем безопасное объяснение из ApiError или HTTP-кода; неизвестную внутреннюю ошибку не показываем дословно. |
| `getHttpStatus` | 61 | Сохраняем один способ чтения статуса для REST ApiError и tRPC-обёртки с cause или data.httpStatus. |
| `isTemporaryRequestError` | 73 | Сетевой сбой, timeout и 5xx допускают сохранение прежнего экрана; отмена и invalid-response сюда не входят. |
| `shouldRetryQuery` | 89 | Разрешаем не больше одного автоматического повтора чтения; явные 4xx и распознанная отмена/поломка контракта прекращают его. |

## [apps/frontend/src/shared/api/operation-abort-link.ts](../../../apps/frontend/src/shared/api/operation-abort-link.ts)

Сигнал операции проходит через tRPC до транспорта, чтобы уход с экрана отменял ожидание его результата.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `operationAbortLink` | 8 | Каждый observer прекращается по своему signal, даже если общий batch-fetch ещё нужен другим операциям; unsubscribe снимает подписку. |

## [apps/frontend/src/shared/api/password.ts](../../../apps/frontend/src/shared/api/password.ts)

Восстановление пароля использует отдельный контракт: получение инструкции не равно установке нового пароля.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `completePassword` | 8 | Отправляем одноразовый токен без cookie и referrer; 400/429 получают отдельные сообщения, успех проверяется по ok=true. Токен не сохраняем, не логируем и не отправляем автоматически повторно. |

## [apps/frontend/src/shared/api/query-client.ts](../../../apps/frontend/src/shared/api/query-client.ts)

Один клиент запросов обслуживает приложение; здесь ограничиваем неактивные списки и направляем ошибки доступа на проверку сессии.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `INACTIVE_COMMENT_QUERY_LIMIT` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `INACTIVE_FEED_QUERY_LIMIT` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `limitContentCache` | 15 | Ограничиваем только известные неиспользуемые query; активные observers и незавершённые fetch не удаляются ради лимита. |
| `createAppQueryClient` | 86 | Defaults keep cache stable; content refresh and access checks opt in separately. |

## [apps/frontend/src/shared/api/read-response-contracts.ts](../../../apps/frontend/src/shared/api/read-response-contracts.ts)

Ответы чтения проверяем на границе API; объявленный TypeScript-тип не заменяет проверку полученных данных.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `id` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `publicPostId` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `postAddress` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `count` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `date` | 13 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `strings` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `target` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `status` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `access` | 17 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `articleCard` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `articleBlock` | 24 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `article` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `video` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `richText` | 51 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `media` | 64 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `post` | 77 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `postCard` | 99 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `adminPostCard` | 100 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `adminArticleCard` | 114 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `counts` | 120 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `calendarDay` | 126 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `stats` | 130 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `numericPage` | 145 | Публичные offset-страницы сохраняют числовой nextCursor и поле posts; это отдельный wire-формат от cursorPage. |
| `cursorPage` | 148 | Непрозрачный курсор остаётся строкой, items проверяются своей row-схемой; структура не объединяется с offset-страницами. |
| `member` | 150 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `payment` | 161 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `comment` | 175 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `commentReport` | 189 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `readContracts` | 207 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `validateReadResponse` | 240 | Проверяем зарегистрированные read-проекции без удаления unknown fields; detail, календарь и комментарии дополнительно связываем с исходным input. |

## [apps/frontend/src/shared/api/read-response-link.ts](../../../apps/frontend/src/shared/api/read-response-link.ts)

Читающий link проверяет ответы процедур до передачи данным экранам, чтобы успешный HTTP не скрывал повреждённый контракт.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `readResponseLink` | 9 | Ответы query проходят runtime-проверку после декодирования; при ошибке наружу выходит безопасный invalid-response без payload. Проверка выполняется до прямого reader и Query cache. |

## [apps/frontend/src/shared/api/request-lifecycle.ts](../../../apps/frontend/src/shared/api/request-lifecycle.ts)

Срок запроса включает чтение тела ответа; смена аккаунта отменяет связанные запросы, даже если транспорт ещё выполняется.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `sessionRequests` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getSessionRequestSignal` | 8 | Возвращаем текущий сигнал владельца сессии, чтобы подготовка файла и последующая сеть отменялись вместе. |
| `cancelSessionRequests` | 13 | Одновременно отменяем все старые связанные операции и создаём свежий сигнал для следующей личности. |
| `runApiRequest` | 19 | Объединяем отмену вызывающего кода и сессии с deadline fetch+body; finally снимает подписки и таймер независимо от исхода. |
| `responseFailure` | 95 | Успешный HTTP с нечитаемым JSON означает нарушенный контракт; ошибочный HTTP сохраняет свой статус и Retry-After. |
| `BufferedApiResponse` | 106 | Обёртка удерживает HTTP-метаданные до позднего tRPC json(), не прикрепляя приватное тело к исключению. |
| `BufferedApiResponse.json` | 108 | Ошибка JSON-разбора преобразуется по сохранённому HTTP-статусу, чтобы 413/429 не терялись как безымянная parser error. |
| `fetchApiResponse` | 118 | Буферизуем тело внутри общего deadline, затем возвращаем совместимый Response для HTTP-links tRPC. |
| `fetchUploadResponse` | 151 | Файловая отправка получает больший, но конечный бюджет; обычные чтения статуса не наследуют этот длинный timeout. |

## [apps/frontend/src/shared/api/retry-after.ts](../../../apps/frontend/src/shared/api/retry-after.ts)

Значение Retry-After приводим к целой задержке для интерфейса, учитывая обе формы HTTP-заголовка. Не принимаем сокращённые форматы даты JavaScript.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `parseRetryAfter` | 3 | Принимаем целые секунды или HTTP-date GMT и возвращаем положительную задержку без переполнения вычисляемого timestamp. |

## [apps/frontend/src/shared/api/session-events.ts](../../../apps/frontend/src/shared/api/session-events.ts)

Общие события проверки доступа связывают сетевые вызовы с провайдером сессии без прямой зависимости каждого запроса от React.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Listener` | 2 | Общие события проверки доступа связывают сетевые вызовы с провайдером сессии без прямой зависимости каждого запроса от React. |
| `listeners` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `requestSessionCheck` | 5 | Передаём отказ доступа подписанным владельцам сессии, не устанавливая гостя внутри сетевого слоя. |
| `subscribeSessionChecks` | 9 | Подписка возвращает симметричное отключение, чтобы размонтированный провайдер не получал чужие ошибки доступа. |

## [apps/frontend/src/shared/api/token-storage.ts](../../../apps/frontend/src/shared/api/token-storage.ts)

Убираем устаревшие браузерные credentials; актуальная сессия браузера передаётся серверной cookie.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `discardLegacyCredentials` | 5 | Удаляем старые token/user-info ключи по возможности; отказ localStorage не ломает действующую HttpOnly-cookie сессию. |
| `getSessionToken` | 17 | Совместимый reader больше не выдаёт токен JavaScript-клиенту и заодно убирает старые значения. |
| `setSessionToken` | 23 | Совместимая функция намеренно не сохраняет переданную строку; новая авторизация не использует localStorage bearer token. |
| `removeSessionToken` | 28 | Совместимая очистка удаляет только legacy-ключи; серверный logout выполняется своим REST-методом. |

## [apps/frontend/src/shared/api/trpc.ts](../../../apps/frontend/src/shared/api/trpc.ts)

Модуль trpc.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `trpc` | 20 | tRPC React client for type-safe API calls. IMPORTANT (tRPC v11): The 'transformer' must be inside the HTTP links, NOT at the root createClient level. This ensures client and server use the same serialization format (superjson). |
| `fileUploads` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `operationHeaders` | 31 | Операционный header допускается только для mutation с UUID v4; ключ одного запроса нельзя присвоить общему batch. |
| `createTRPCClient` | 42 | Собираем links в порядке безопасных ошибок, отмены и проверки ответа, затем выбираем отдельный или batch-транспорт по протоколу. |

## [apps/frontend/src/shared/api/types.ts](../../../apps/frontend/src/shared/api/types.ts)

Типы входов и выходов выводим из сгенерированного API-контракта, чтобы компоненты не копировали серверные структуры вручную.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ApiInputs` | 5 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ApiOutputs` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `AdminPost` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `AdminPostCard` | 8 | Контракт типов. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/api/upload-errors.ts](../../../apps/frontend/src/shared/api/upload-errors.ts)

Ошибки закрытых загрузок преобразуем в понятные сообщения без перехода на публичный маршрут.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `privateUploadRejectionMessage` | 5 | Специальные 404/413 объясняют текущий отказ загрузки; они не отменяют ранее отправленную попытку с тем же ключом. |

## [apps/frontend/src/shared/api/use-cursor-pages.ts](../../../apps/frontend/src/shared/api/use-cursor-pages.ts)

Модуль use-cursor-pages.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `requireCursorPage` | 32 | Базовая структура должна содержать положительные ID и строковый/пустой курсор; специализацию элементов проверяет транспорт. |
| `useCursorPages` | 49 | Управляем чтением, ручной догрузкой и ограниченным кешем одной цепочки, привязанной к владельцу, фильтрам и версии. Явное обновление перечитывает всё удержанное окно, обычное — голову и видимые страницы. |

## [apps/frontend/src/shared/api/user-facing-errors-link.ts](../../../apps/frontend/src/shared/api/user-facing-errors-link.ts)

Нормализуем транспортные ошибки для интерфейса, сохраняя признаки, нужные для восстановления и ограничения повторов.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `privateUploadProcedures` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `userFacingErrorsLink` | 24 | Нормализуем ошибки до экранов, сохраняя только безопасный статус и проверенную задержку повторного действия. |

## [apps/frontend/src/shared/browser/actions.ts](../../../apps/frontend/src/shared/browser/actions.ts)

Модуль actions.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `openExternalUrl` | 5 | Проверяем URL перед открытием; mailto/tel передаются текущему браузеру, обычные ссылки открываются без opener. |
| `shareContent` | 12 | Используем системный share, а при его отсутствии копируем сообщение и URL; отказ разрешения не маскируем как успех. |
| `showAlert` | 28 | Совместимую конфигурацию кнопок сводим к native confirm/alert: это не произвольный много-кнопочный диалог приложения. |

## [apps/frontend/src/shared/browser/download-text.ts](../../../apps/frontend/src/shared/browser/download-text.ts)

Модуль download-text.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `downloadText` | 4 | Временный текстовый Blob скачивается через скрытый anchor; URL отзывается с задержкой, чтобы браузер успел начать чтение. |

## [apps/frontend/src/shared/browser/file-operations.ts](../../../apps/frontend/src/shared/browser/file-operations.ts)

Модуль file-operations.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `MAX_ATTACHMENT_BYTES` | 4 | Выбор, чтение и загрузка файла имеют пределы по размеру и отмене; крупное тело не должно бесконтрольно удерживаться в памяти. |
| `MAX_AVATAR_SOURCE_BYTES` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `MAX_VIDEO_BYTES` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `MAX_FILES_PER_SELECTION` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FileSelectionOptions` | 8 | Контракт типов. Подробности и ограничения — в исходнике. |
| `validateFileSize` | 15 | Проверяем ненулевой размер и предел байтов до чтения; MIME и структура содержимого относятся к следующему валидатору. |
| `readResponseBlob` | 25 | Удерживаем не больше разрешённого тела даже без честного Content-Length; при завершении освобождаем reader и снимаем abort listener. |
| `validateFileSelection` | 68 | Проверяем количество и размер всего выбора до начала декодирования хотя бы первого файла, чтобы частичный набор не стал готовым выбором. |
| `chooseFiles` | 80 | Создаём одноразовый нативный input с конечным владельцем; change, cancel и abort завершают Promise только один раз и удаляют DOM. |
| `readFileDataUrl` | 138 | Связываем FileReader с внешней отменой и очищаем обработчики на каждом исходе; результат должен быть строковым data URL. |

## [apps/frontend/src/shared/browser/file-picker.ts](../../../apps/frontend/src/shared/browser/file-picker.ts)

Модуль file-picker.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ImagePickerAsset` | 10 | Контракт типов. Подробности и ограничения — в исходнике. |
| `MediaTypeOptions` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `requestMediaLibraryPermissionsAsync` | 26 | Совместимый browser stub не запрашивает системное разрешение: реальный доступ к файлам предоставляет нативный picker при выборе. |
| `launchImageLibraryAsync` | 30 | Выбираем изображения или видео, последовательно читаем data URL и размеры; отсутствие выбранных файлов возвращается как canceled. |
| `getDocumentAsync` | 108 | Преобразуем выбранные File в совместимые assets; optional preview URL создаётся только по запросу и должен освобождаться владельцем. |

## [apps/frontend/src/shared/browser/file-task.ts](../../../apps/frontend/src/shared/browser/file-task.ts)

Локальная подготовка файла тоже имеет срок и сигнал отмены; поздно созданные ресурсы должны освобождаться вызывающей операцией.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `runFileTask` | 3 | Даём локальной обработке общий сигнал с timeout и ждём гонку завершения/отмены; очистку ресурсов позднего task выполняет его реализация. |

## [apps/frontend/src/shared/browser/gestures.module.scss](../../../apps/frontend/src/shared/browser/gestures.module.scss)

CSS-правила жестов согласуют области касаний с браузерной прокруткой; обработчики Pointer Events находятся в соседнем модуле.

## [apps/frontend/src/shared/browser/gestures.tsx](../../../apps/frontend/src/shared/browser/gestures.tsx)

Модуль gestures.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `GestureEvent` | 12 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Handler` | 23 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PointerGesture` | 25 | Цепочка builder-методов только описывает обработчики и пороги; browser events устанавливает отдельный GestureDetector. |
| `PointerGesture.constructor` | 35 | Вид жеста определяет, какие callbacks и координаты использует detector, не устанавливая listeners при создании описания. |
| `PointerGesture.onStart` | 37 | Регистрируем начало распознанного pan; возвращаем тот же builder для цепочки настроек. |
| `PointerGesture.onUpdate` | 42 | Сохраняем обработчик промежуточных координат без запуска самого жеста. |
| `PointerGesture.onEnd` | 47 | Сохраняем штатное завершение; системная отмена направляется отдельному callback. |
| `PointerGesture.onCancel` | 52 | Сохраняем отмену активного pan, чтобы владелец мог вернуть временное состояние. |
| `PointerGesture.activateAfterLongPress` | 57 | Откладываем активацию pan до удержания; заметное движение до таймера отменяет распознавание. |
| `PointerGesture.numberOfTaps` | 62 | Задаём необходимое число коротких последовательных tap для запуска end-handler. |
| `PointerGesture.activeOffsetY` | 67 | Задаём вертикальный коридор ожидания: pan начинается только после выхода за его границу. |
| `PointerGesture.failOffsetX` | 72 | Горизонтальный выход за коридор отменяет этот pan, позволяя отличать его от другого направления. |
| `Gesture` | 78 | Фабрики совместимого API создают независимые описания; Simultaneous группирует их для одного DOM-detector. |
| `GestureDetector` | 85 | Один detector хранит pointers, временные пороги и активность; callbacks получают нормализованное событие pan/pinch/tap. |

## [apps/frontend/src/shared/browser/links.ts](../../../apps/frontend/src/shared/browser/links.ts)

Открытие ссылки использует общий проверенный путь внешней навигации вместо отдельной логики в каждом экране.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `openBrowserAsync` | 4 | Совместимый вызов делегирует открытие общему URL-валидатору, не создавая отдельного окна приложения или авторизации. |

## [apps/frontend/src/shared/browser/motion.tsx](../../../apps/frontend/src/shared/browser/motion.tsx)

Модуль motion.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Listener` | 25 | Контракт типов. Подробности и ограничения — в исходнике. |
| `collect` | 26 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Animation` | 27 | Контракт типов. Подробности и ограничения — в исходнике. |
| `animation` | 40 | Animation descriptor распознаётся по kind; это внутренний объект совместимого API, который type cast представляет как value. |
| `SharedValue` | 42 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Value` | 46 | Значение удерживает подписчиков и текущую анимацию; чтение во время сбора зависимостей регистрирует потребителя. |
| `Value.constructor` | 51 | Начальное значение устанавливается без анимации и без уведомления ещё не подключённых подписчиков. |
| `Value.value` | 55 | Во время computations чтение добавляет Value в набор зависимостей, после чего возвращает текущее число. |
| `Value.value` | 60 | Новая запись останавливает прежнюю анимацию; descriptor запускает play, обычное значение применяется сразу. |
| `Value.update` | 66 | Уведомляем только при реальном изменении значения, чтобы одинаковые кадры не дублировали DOM-обновления. |
| `Value.subscribe` | 72 | Возвращаем точечную отписку: несколько стилей или реакций могут независимо наблюдать один Value. |
| `Value.stopAnimation` | 79 | Останавливаем текущую цепочку и убираем её cancel-handle, сохраняя последнее уже показанное значение. |
| `play` | 85 | Выполняем timing/spring или композицию delay/sequence/repeat; cancel рекурсивно останавливает frame, timer и дочерний запуск. |
| `Easing` | 157 | Чистые кривые и их in/out/inOut-композиции преобразуют нормализованное время, не планируя кадры самостоятельно. |
| `withTiming` | 177 | Создаём descriptor временной анимации; само выполнение начинается при присваивании его shared value. |
| `withSpring` | 188 | Совместимая spring использует фиксированную затухающую кривую в play и заданную длительность; это не отдельный физический solver. |
| `withDelay` | 201 | Обертываем дочерний descriptor задержкой, сохраняя общую цепочку отмены в play. |
| `withSequence` | 205 | Последовательность передаёт управление следующему descriptor только после штатного окончания предыдущего. |
| `withRepeat` | 209 | Описываем число повторов и обратную цель; отрицательная единица означает незавершаемую до cancel цепочку. |
| `cancelAnimation` | 213 | Явно останавливаем анимацию данного совместимого Value, не удаляя его подписчиков и последнее значение. |
| `runOnJS` | 217 | В браузерном адаптере callbacks уже находятся в JS-потоке; совместимый runOnJS возвращает исходную функцию. |
| `useSharedValue` | 219 | Создаём один Value на экземпляр hook и отменяем его анимацию при unmount; number/boolean overload сохраняют совместимость вызывающего кода. |
| `useSharedValue` | 220 | Функция. Подробности и ограничения — в исходнике. |
| `useSharedValue` | 221 | Функция. Подробности и ограничения — в исходнике. |
| `styles` | 229 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `useAnimatedStyle` | 231 | Стабильный marker хранит актуальную функцию в WeakMap, чтобы animated component мог вычислять стиль без React-рендера каждого кадра. |
| `computations` | 239 | Из вложенного массива style выбираем только зарегистрированные animated computations для подписки на их Value. |
| `resolved` | 246 | Разворачиваем animated markers при первом DOM-рендере, сохраняя остальные объекты и массивы стилей. |
| `applyMotion` | 253 | Переводим вычисленные свойства в CSS, добавляя px размерным числам и отдельно собирая совместимый массив transform. |
| `assign` | 281 | Передаём найденный DOM-узел наружу одинаково для callback-ref и object-ref. |
| `Entrance` | 286 | Описание entrance хранит имя, длительность и задержку; совместимые spring-настройки здесь не создают физическую анимацию. |
| `Entrance.constructor` | 288 | Храним независимые параметры entrance preset; построение описания не запускает DOM-анимацию. |
| `Entrance.duration` | 294 | Возвращаем новое описание с другой длительностью, не изменяя общий экспортированный preset для остальных компонентов. |
| `Entrance.delay` | 298 | Создаём отдельный preset задержки, сохраняя исходные имя и длительность. |
| `Entrance.springify` | 302 | Совместимый метод цепочки сохраняет preset; web entrance продолжает использовать Web Animations, отдельного springify-преобразования нет. |
| `Entrance.damping` | 306 | Параметр оставлен для совместимости цепочек; браузерная entrance-реализация его не применяет. |
| `Entrance.stiffness` | 310 | Совместимый параметр не меняет easing web entrance; возврат this сохраняет существующий builder API. |
| `FadeIn` | 314 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FadeOut` | 315 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FadeInDown` | 316 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `FadeInUp` | 317 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SlideInLeft` | 318 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `SlideInRight` | 319 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `MotionOptions` | 320 | Контракт типов. Подробности и ограничения — в исходнике. |
| `MotionProps` | 327 | Контракт типов. Подробности и ограничения — в исходнике. |
| `animatedComponent` | 333 | Оборачиваем DOM/UI-компонент подпиской на Value и entrance-effect; supportsMotionStyles сообщает соседним адаптерам о поддержке marker-стилей. |
| `Animated` | 422 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `useAnimatedScrollHandler` | 431 | Стабильный обработчик читает актуальную пользовательскую функцию из ref, поддерживая обе совместимые формы onScroll. |
| `useAnimatedReaction` | 447 | Собираем Value-зависимости prepare и подписываем react на их изменения; cleanup снимает все подписки текущего набора deps. |
| `interpolate` | 477 | Ищем линейный сегмент input/output; CLAMP ограничивает вход краями, остальные режимы здесь используют линейное продолжение. |

## [apps/frontend/src/shared/browser/operation-scope.ts](../../../apps/frontend/src/shared/browser/operation-scope.ts)

Каждая асинхронная операция получает право применить результат только пока её область актуальна; finish не завершает чужую новую задачу.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ScopedOperation` | 2 | Каждая асинхронная операция получает право применить результат только пока её область актуальна; finish не завершает чужую новую задачу. |
| `OperationScope` | 11 | Synchronous lock and cancellation boundary for one editor or comment form. |
| `OperationScope.emit` | 26 | Уведомляем всех подписчиков после изменения области, сохраняя один источник busy-состояния. |
| `OperationScope.begin` | 41 | Занятая или лишённая доступа область не выдаёт задачу; успешный begin связывает новый AbortController с parent-сессией. |

## [apps/frontend/src/shared/browser/press.ts](../../../apps/frontend/src/shared/browser/press.ts)

Модуль press.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `pressableProps` | 4 | Возвращаем нативный click handler без второго touch-события, чтобы одно действие не выполнялось дважды. |
| `formatToolbarProps` | 10 | Pointerdown сохраняет выделение и не уводит фокус с текста, а сама команда запускается обычным click. |

## [apps/frontend/src/shared/browser/scroll-header-state.ts](../../../apps/frontend/src/shared/browser/scroll-header-state.ts)

Направление прокрутки определяем по пройденным пикселям, чтобы частота событий не меняла поведение шапки.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ScrollHeaderState` | 2 | Направление прокрутки определяем по пройденным пикселям, чтобы частота событий не меняла поведение шапки. |
| `ScrollHeaderState.reveal` | 8 | Явное раскрытие сбрасывает накопленный путь: восстановленная позиция экрана становится новой базой, а не командой спрятать шапку. |
| `ScrollHeaderState.update` | 15 | Обрезаем Safari rubber-band к границам и накапливаем движение одного направления; разные пороги скрытия/возврата уменьшают дрожание. |

## [apps/frontend/src/shared/browser/selection.ts](../../../apps/frontend/src/shared/browser/selection.ts)

Модуль selection.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `RICH_TEXT_INPUT_ID` | 3 | Выделение текста сохраняем в координатах поля, чтобы панели форматирования не теряли выбранный диапазон. |
| `Selection` | 4 | Контракт типов. Подробности и ограничения — в исходнике. |
| `normalizeSelection` | 9 | Упорядочиваем координаты и отклоняем пустой или выходящий за текст диапазон до применения форматирования. |
| `normalizeFormatRange` | 19 | Убираем пробелы и табы только по краям выделения, сохраняя переносы строк внутри многострочного форматирования. |
| `SelectionAnchor` | 31 | Контракт типов. Подробности и ограничения — в исходнике. |
| `anchorSelection` | 35 | Сохраняем нормализованный диапазон вместе с его текстом, чтобы последующая команда могла сверить актуальное выделение. |
| `resolveFormatRange` | 47 | Приоритет имеет живой непустой диапазон; сохранённый snapshot не должен самопроизвольно переносить форматирование на другой фрагмент. При сдвинувшихся индексах сопоставляем сохранённый текст, учитывая emoji и правки. |
| `findRichTextInput` | 81 | Находим совместимое поле по единому ID/name; отсутствие DOM или редактора возвращает null вместо ошибки инструмента. |
| `readLiveSelection` | 96 | Берём текущие DOM-координаты, если поле существует, иначе проверяем переданный fallback той же нормализацией. |
| `restoreDomSelection` | 112 | После работы панели возвращаем фокус и диапазон в существующее поле; сам текст и разметку не меняем. |

## [apps/frontend/src/shared/browser/storage.ts](../../../apps/frontend/src/shared/browser/storage.ts)

Модуль storage.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `personalKeys` | 3 | Персональные ключи изолируем по подтверждённому владельцу; часть операций требует записи с явной ошибкой вместо тихого fallback. |
| `personalDataOwner` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `scopedKey` | 21 | Именное пространство добавляется только известным персональным ключам; глобальные UI-предпочтения сохраняют прежние имена. |
| `isPersonalDataOwner` | 25 | Асинхронный результат проверяет этого владельца до применения, включая отдельное гостевое пространство null. |
| `requiredStorage` | 31 | Required drafts must report storage failures rather than pretend to persist. |
| `setPersonalDataOwner` | 39 | Удаляем непривязанные legacy-данные и старые scoped-ключи при смене владельца, чтобы следующий вход не наследовал персональный ввод. |
| `storage` | 52 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/browser/touch-press-guard.tsx](../../../apps/frontend/src/shared/browser/touch-press-guard.tsx)

Модуль touch-press-guard.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `TouchPressGuard` | 7 | Единая capture-подписка отличает swipe/pinch от tap и подавляет только недавний совместимый click на управляющем элементе. |

## [apps/frontend/src/shared/browser/use-browser-ready.ts](../../../apps/frontend/src/shared/browser/use-browser-ready.ts)

Модуль use-browser-ready.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `subscribe` | 5 | Здесь нет внешнего изменяемого источника: React после подписки сам переключается с server snapshot на client snapshot. |
| `useBrowserReady` | 7 | Первый HTML и hydration-кадр получают false, затем клиентский snapshot разрешает браузерные элементы без рассогласования разметки. |

## [apps/frontend/src/shared/browser/use-club-protection.ts](../../../apps/frontend/src/shared/browser/use-club-protection.ts)

Модуль use-club-protection.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `owners` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `events` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `block` | 9 | Не мешаем вводу и выделению в редактируемых контролах; остальные события копирования/drag останавливаем как UI-ограничение. |
| `protect` | 19 | Один набор document-level правил ставится при первом владельце защищённого активного экрана. |
| `release` | 25 | Последний владелец снимает общие CSS-классы и обработчики, чтобы ограничения не оставались в публичных разделах. |
| `useClubContentProtection` | 32 | Счётчик владельцев учитывает параллельные/сохранённые экраны; cleanup одной страницы не снимает ещё нужную защиту другой. Скрытая сохранённая вкладка не владеет документной защитой. |

## [apps/frontend/src/shared/browser/use-mouse-drag-scroll.ts](../../../apps/frontend/src/shared/browser/use-mouse-drag-scroll.ts)

Модуль use-mouse-drag-scroll.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Drag` | 5 | Контракт типов. Подробности и ограничения — в исходнике. |
| `snapOffsets` | 19 | Считаем допустимые остановки по реальным дочерним карточкам и ширине прокрутки, убирая совпадающие крайние позиции. |
| `useMouseDragScroll` | 37 | Добавляем drag только левой мышью по нужному horizontal-root; touch, контролы медиа и редактирование текста остаются нативными. |

## [apps/frontend/src/shared/browser/use-scroll-header.ts](../../../apps/frontend/src/shared/browser/use-scroll-header.ts)

Модуль use-scroll-header.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `useScrollHeader` | 7 | Наблюдаем корневую вертикальную область активного экрана; состояние шапки меняем через DOM без React-рендера на каждый scroll. |

## [apps/frontend/src/shared/browser/viewport.ts](../../../apps/frontend/src/shared/browser/viewport.ts)

Модуль viewport.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ViewportSize` | 4 | Контракт типов. Подробности и ограничения — в исходнике. |
| `serverViewport` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `browserViewport` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `browserScreenViewport` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `listeners` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `measureViewportOffset` | 22 | Отдельный CSS-offset учитывает iOS-панорамирование visualViewport над клавиатурой даже без нового resize. |
| `measureViewport` | 30 | Обновляем app-height, измерения окна и safe-area согласованно; одинаковые значения не вызывают лишних уведомлений подписчиков. |
| `subscribeViewport` | 64 | Глобальные resize/visualViewport listeners существуют, пока есть хотя бы один потребитель; последний cleanup удаляет их. |
| `getViewport` | 85 | Window-scope ограничен макетом 480px, screen-scope нужен полноэкранному медиа; layout viewport помогает пережить iOS rotation overflow. |
| `useViewport` | 104 | Возвращаем стабильный external-store snapshot с единым SSR-значением, не измеряя DOM прямо во время hydration-рендера. |
| `serverInsets` | 111 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `browserInsets` | 112 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `useBrowserSafeAreaInsets` | 114 | Safe-area использует тот же цикл измерения, что viewport, и нулевой серверный snapshot. |
| `ViewportSync` | 122 | Постоянный невидимый подписчик поддерживает CSS app-height и safe-area даже когда конкретный экран не читает размеры. |
| `useSystemColorScheme` | 127 | После монтирования читаем prefers-color-scheme и подписываемся на смену; начальное light сохраняет согласованный SSR. |

## [apps/frontend/src/shared/config/api.ts](../../../apps/frontend/src/shared/config/api.ts)

Построение адресов API отделяем от компонентов, чтобы пути одинаково работали с настроенным базовым адресом.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `API_BASE_URL` | 2 | Построение адресов API отделяем от компонентов, чтобы пути одинаково работали с настроенным базовым адресом. |
| `getApiBaseUrl` | 6 | В браузере запрещаем отдельный публичный origin или вложенный base path, чтобы cookie и относительные закрытые URL оставались на одном сайте. |
| `apiUrl` | 29 | Проверяем публичную базу перед объединением с внутренним API-путём; функция не превращает произвольный URL в доверенный. |
| `SESSION_TOKEN_KEY` | 32 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `USER_INFO_KEY` | 33 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `isOwnerUser` | 35 | Административный интерфейс определяется ролью, а не совпадением email или openId; окончательные полномочия проверяет API. |
| `getLoginPath` | 48 | Совместимый вызов возвращает текущий маршрут входа без токенов и query-параметров. |

## [apps/frontend/src/shared/config/contact.ts](../../../apps/frontend/src/shared/config/contact.ts)

Общий публичный контакт используется в интерфейсе и документах; это адрес обращения, а не SMTP-секрет. Адрес используется для поддержки, Prodamus и юридических документов.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PUBLIC_CONTACT_EMAIL` | 2 | Общий публичный контакт используется в интерфейсе и документах; это адрес обращения, а не SMTP-секрет. Адрес используется для поддержки, Prodamus и юридических документов. |

## [apps/frontend/src/shared/media/audio-player.module.scss](../../../apps/frontend/src/shared/media/audio-player.module.scss)

Оформление компонента: Визуальная карточка использует подтверждённое состояние браузерного аудио и удерживает активный элемент в окне коллекции.

## [apps/frontend/src/shared/media/audio-player.tsx](../../../apps/frontend/src/shared/media/audio-player.tsx)

Модуль audio-player.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CREAM_BG` | 11 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ACCENT` | 12 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `AudioPlayerProps` | 13 | Контракт типов. Подробности и ограничения — в исходнике. |
| `generateWaveform` | 20 | Строим детерминированный декоративный рисунок по URL; это не анализ звукового сигнала и не интерактивная перемотка. |
| `AudioPlayerCard` | 33 | Показываем реальное состояние плеера и удерживаем карточку при запуске, паузе с позицией или ошибке, чтобы не потерять работу. |

## [apps/frontend/src/shared/media/audio.ts](../../../apps/frontend/src/shared/media/audio.ts)

Модуль audio.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `useAudioPlayer` | 7 | Создаём плеер на источник; эффект подключает DOM-аудио и освобождает его при смене URL или размонтировании, скрытый экран ставит на паузу. |
| `useAudioPlayerState` | 20 | Подписываем React на согласованный snapshot плеера, используя пустое стабильное состояние при серверном рендеринге. |
| `setAudioModeAsync` | 28 | Сохраняем совместимый вызов настройки аудио; в браузере дополнительных глобальных режимов здесь не устанавливаем. |

## [apps/frontend/src/shared/media/avatar-cropper.module.scss](../../../apps/frontend/src/shared/media/avatar-cropper.module.scss)

Оформление компонента: Обрезка аватара создаёт отдельный результат по выбранной области.

## [apps/frontend/src/shared/media/avatar-cropper.tsx](../../../apps/frontend/src/shared/media/avatar-cropper.tsx)

Модуль avatar-cropper.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `AvatarCropperProps` | 23 | Контракт типов. Подробности и ограничения — в исходнике. |
| `AvatarCropper` | 32 | Согласуем жесты с круговой областью просмотра; сохранение создаёт квадратный PNG 400px, а загрузка на сервер остаётся обязанностью владельца. |

## [apps/frontend/src/shared/media/browser-audio-player.ts](../../../apps/frontend/src/shared/media/browser-audio-player.ts)

Состояние аудио следует событиям HTMLAudioElement и результату play; отмена ожидания не должна оживлять старый запуск.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `AudioSnapshot` | 2 | Состояние аудио следует событиям HTMLAudioElement и результату play; отмена ожидания не должна оживлять старый запуск. |
| `initial` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BrowserAudioPlayer` | 17 | Playback state follows browser events and the play promise, including rejected autoplay. |
| `BrowserAudioPlayer.constructor` | 26 | Сохраняем источник и фабрику; HTMLAudioElement создаётся лениво, чтобы конструктор работал также при SSR. |
| `BrowserAudioPlayer.update` | 42 | Публикуем новый snapshot перед оповещением слушателей, чтобы они читали уже согласованное состояние. |
| `BrowserAudioPlayer.duration` | 90 | Читаем длительность из последнего snapshot, а не из ещё не подключённого DOM-элемента. |
| `BrowserAudioPlayer.currentTime` | 94 | Возвращаем последнюю подтверждённую событиями позицию аудио. |
| `BrowserAudioPlayer.volume` | 98 | До подключения возвращаем сохранённую громкость, после — фактическую громкость элемента. |
| `BrowserAudioPlayer.volume` | 102 | Ограничиваем громкость диапазоном HTMLMediaElement и сохраняем её для будущего подключения. |
| `BrowserAudioPlayer.loop` | 107 | Читаем текущий loop либо его отложенное значение до создания элемента. |
| `BrowserAudioPlayer.loop` | 111 | Сохраняем повтор для ленивого подключения и сразу применяем к уже созданному аудио. |
| `BrowserAudioPlayer.play` | 116 | Запускаем аудио с дедлайном; номер поколения не даёт старому play обновить состояние после pause/release. |
| `BrowserAudioPlayer.pause` | 151 | Прерываем текущее поколение запуска, снимаем дедлайн и явно сообщаем остановку независимо от событий браузера. |
| `BrowserAudioPlayer.seekTo` | 159 | Перемещаем уже подключённый плеер не раньше начала и сразу обновляем snapshot позиции. |

## [apps/frontend/src/shared/media/canvas-image.ts](../../../apps/frontend/src/shared/media/canvas-image.ts)

Декодирование и рисование изображения на canvas вынесены из формы, чтобы подготовка файла управлялась общим жизненным циклом.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `SaveFormat` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Operation` | 4 | Контракт типов. Подробности и ограничения — в исходнике. |
| `manipulateAsync` | 17 | Последовательно выполняем crop/resize под отменяемой задачей; соседние crop+resize объединяем, чтобы не создавать огромный промежуточный canvas. |

## [apps/frontend/src/shared/media/document-attachment.module.scss](../../../apps/frontend/src/shared/media/document-attachment.module.scss)

Оформление компонента: Карточка документа показывает имя и размер.

## [apps/frontend/src/shared/media/document-attachment.tsx](../../../apps/frontend/src/shared/media/document-attachment.tsx)

Модуль document-attachment.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BROWN_DARK` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BROWN_LIGHT` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `DocumentAttachmentProps` | 10 | Контракт типов. Подробности и ограничения — в исходнике. |
| `getDocIcon` | 17 | Выбираем декоративный значок по MIME; неизвестный тип остаётся обычным документом. |
| `formatFileSize` | 29 | Отображаем размер в B/KB/MB, не подменяя исходное число байтов и не угадывая отсутствующее значение. |
| `DocumentAttachmentCard` | 36 | Собираем читаемую подпись и метаданные документа; реальный доступ по URL проверяется при открытии сервером. |

## [apps/frontend/src/shared/media/emoji-text.ts](../../../apps/frontend/src/shared/media/emoji-text.ts)

Модуль emoji-text.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `EMOJI_SEGMENT_RE` | 3 | Текст делим на обычные и emoji-фрагменты для совместимого отображения шрифтами, не интерпретируя его как разметку. Emoji выводятся системным шрифтом, поскольку EB Garamond не содержит этих глифов. |
| `TextEmojiSegment` | 5 | Контракт типов. Подробности и ограничения — в исходнике. |
| `splitForEmojiRendering` | 10 | Сохраняем исходный текст и порядок символов, выделяя распознанные emoji для системного шрифта без интерпретации HTML. |

## [apps/frontend/src/shared/media/image-display-history.ts](../../../apps/frontend/src/shared/media/image-display-history.ts)

История уже показанных изображений управляет повторным появлением в интерфейсе; это не HTTP-кеш содержимого файла.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `displayed` | 5 | История уже показанных изображений управляет повторным появлением в интерфейсе; это не HTTP-кеш содержимого файла. |
| `DISPLAY_HISTORY_LIMIT` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `wasImageDisplayed` | 9 | Проверяем успешный показ и освежаем LRU-порядок; отсутствие ключа не означает отсутствие файла в HTTP-кеше. |
| `rememberImageDisplay` | 17 | Запоминаем только идентичность успешно показанного изображения и вытесняем самый старый ключ сверх лимита. |

## [apps/frontend/src/shared/media/image-sizes.ts](../../../apps/frontend/src/shared/media/image-sizes.ts)

Размер слота описывает реальную ширину изображения в макете, чтобы браузер выбирал подходящий вариант srcset. Расчёт учитывает холст 480 px, поля и зазоры между фото.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `imageSlotSizes` | 3 | Описываем ширину слота в полотне до 480px с учётом внешних отступов и межколоночных промежутков для выбора srcset. |

## [apps/frontend/src/shared/media/image-upload.ts](../../../apps/frontend/src/shared/media/image-upload.ts)

Модуль image-upload.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `pickWebFiles` | 15 | Открываем общий browser picker с заданными типами и множественностью; ограничения выбора делегируем file-operations. |
| `blobToBase64` | 23 | Получаем локальный data URL отменяемым FileReader и возвращаем только Base64-часть без MIME-префикса. |
| `fileName` | 34 | Имя доступно только у File; обычный Blob не должен требовать существования File при SSR. |
| `imageTypes` | 37 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `MAX_PHOTO_BYTES` | 48 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `PhotoPreparationOptions` | 49 | Контракт типов. Подробности и ограничения — в исходнике. |
| `assertStaticImage` | 56 | Проверяем GIF и анимационные чанки PNG/WebP до canvas, чтобы не молча терять остальные кадры. |
| `imageType` | 84 | Используем заявленный MIME, а для пустого/octet-stream восстанавливаем только известный тип по расширению File. |
| `isHeicLike` | 92 | HEIC/HEIF направляем в нативный img-путь вместо createImageBitmap для совместимости WebKit. |
| `Drawable` | 96 | Контракт типов. Подробности и ограничения — в исходнике. |
| `loadDrawableFromBlob` | 103 | Возвращаем единый draw/release над bitmap или img: fallback сохраняет отмену и освобождает object URL. |
| `compressImageBlob` | 179 | Уменьшаем длинную сторону без увеличения и кодируем результат; ограниченный исходник можно сохранить, чтобы избежать лишнего lossy-прохода. |
| `preparePhotoBlob` | 256 | Проверяем исходный размер/тип/анимацию и уменьшаем результат ступенями до лимита фото; прозрачность запрашивает WebP. |
| `readPhotoDataUrl` | 293 | Декодируем только Base64 data URL с предварительной оценкой размера; небольшие блоки ограничивают временные строки atob. Локальные data URL не требуют сетевого запроса. |
| `uriToBase64` | 321 | Совместимый короткий путь возвращает Base64 уже проверенного и подготовленного изображения. |
| `uriToPhotoUpload` | 329 | Отделяем чтение локального data URL от сети, подготавливаем фото и возвращаем фактический MIME вместе с байтами. |
| `fileForPhotoUpload` | 356 | Создаём File из подготовленного Blob с согласованными расширением и MIME, сохраняя время исходника. |
| `fileToUpload` | 375 | Собираем переносимый payload публичной загрузки только после подготовки изображения и получения итогового имени. |

## [apps/frontend/src/shared/media/image.module.scss](../../../apps/frontend/src/shared/media/image.module.scss)

Оформление компонента: Картинка имеет ограниченный цикл загрузки и повторов.

## [apps/frontend/src/shared/media/image.tsx](../../../apps/frontend/src/shared/media/image.tsx)

Модуль image.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ImageSource` | 19 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ImageProps` | 24 | Контракт типов. Подробности и ограничения — в исходнике. |
| `RETRY_DELAYS` | 51 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `VISIBLE_LOAD_TIMEOUT` | 52 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ImageFailure` | 55 | Отображаем терминальный отказ отдельно от ожидания; повтор не должен активировать переход карточки. |
| `PictureContent` | 77 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `Picture` | 331 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/media/managed-video.tsx](../../../apps/frontend/src/shared/media/managed-video.tsx)

Модуль managed-video.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Props` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ManagedVideo` | 15 | Смена src пересоздаёт состояние ошибки и DOM-владельца видео; старый ресурс очищается его эффектом. |
| `VideoResource` | 20 | Привязываем остановку и освобождение video к видимости страницы и активности экрана, сохраняя стандартные controls браузера. |

## [apps/frontend/src/shared/media/media-label.ts](../../../apps/frontend/src/shared/media/media-label.ts)

Модуль media-label.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `RAW_NAME` | 3 | Техническое имя файла приводим к подписи вложения, не подменяя его адрес или серверную метаинформацию. |
| `isRawMediaFilename` | 5 | Распознаём пустые и типичные технические имена камеры по последнему сегменту пути. |
| `friendlyMediaName` | 14 | Выбираем подпись вложения без расширения; техническое имя видео скрываем, для аудио и документов оставляем общую подпись. |
| `displayPostTitle` | 26 | Берём первую содержательную строку до 80 символов, обходя технические имена и сохраняя предсказуемую подпись пустого поста. |

## [apps/frontend/src/shared/media/media-playback.module.scss](../../../apps/frontend/src/shared/media/media-playback.module.scss)

Общие слои ошибки и повтора располагаются над плеером, не меняя его исходный адрес.

## [apps/frontend/src/shared/media/natural-photo-stack.module.scss](../../../apps/frontend/src/shared/media/natural-photo-stack.module.scss)

Оформление компонента: Стек фотографий использует известные пропорции и общую навигацию, чтобы не растягивать снимки до произвольной высоты.

## [apps/frontend/src/shared/media/natural-photo-stack.tsx](../../../apps/frontend/src/shared/media/natural-photo-stack.tsx)

Модуль natural-photo-stack.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `VideoGridSlot` | 12 | Контракт типов. Подробности и ограничения — в исходнике. |
| `NaturalPhotoStack` | 17 | Выбираем одиночное видео, видеокарусель, фотокарусель или сетку; исходные индексы фото сохраняем для полноэкранного просмотра. |

## [apps/frontend/src/shared/media/photo-aspect-ratios.ts](../../../apps/frontend/src/shared/media/photo-aspect-ratios.ts)

Модуль photo-aspect-ratios.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `FALLBACK_PHOTO_RATIO` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `usePhotoAspectRatios` | 11 | Учимся на onLoad уже показанного фото: локальные измерения привязаны к набору URL, а общий ограниченный кеш помогает повторному открытию. |
| `normalizeLinkUrl` | 47 | Дополняем пользовательскую ссылку схемой HTTPS, сохраняя явно указанные HTTP(S), mailto и tel. |

## [apps/frontend/src/shared/media/photo-carousel-navigation.ts](../../../apps/frontend/src/shared/media/photo-carousel-navigation.ts)

Переходы по индексам фотографий выделены из рендера, чтобы одинаково обрабатывать крайние элементы и изменение набора.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `scrollPhotoWithKeyboard` | 5 | Обрабатываем только немодифицированные стрелки/Home/End пригодной карусели, не перехватывая уже отменённое событие. |
| `scrollPhotoTo` | 44 | Ограничиваем индекс существующими кадрами и синхронно ставим карусель в начало нужного слота. |

## [apps/frontend/src/shared/media/photo-dots.module.scss](../../../apps/frontend/src/shared/media/photo-dots.module.scss)

Оформление компонента: Индикаторы листания получают текущий индекс от владельца карусели и не заводят собственное состояние выбора.

## [apps/frontend/src/shared/media/photo-dots.tsx](../../../apps/frontend/src/shared/media/photo-dots.tsx)

Индикаторы листания получают текущий индекс от владельца карусели и не заводят собственное состояние выбора.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PhotoDots` | 6 | Показываем компактные точки только для 2–10 кадров; индекс приходит от карусели, а длинный список использует её числовой счётчик. |

## [apps/frontend/src/shared/media/photo-navigation.module.scss](../../../apps/frontend/src/shared/media/photo-navigation.module.scss)

Оформление компонента: Единое управление выбранной фотографией связывает кнопки, жесты и открытие просмотра без раздельных индексов.

## [apps/frontend/src/shared/media/photo-navigation.tsx](../../../apps/frontend/src/shared/media/photo-navigation.tsx)

Модуль photo-navigation.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PhotoNavigation` | 8 | Предлагаем соседние индексы без собственного состояния, отключая движение за первый и последний кадр. |

## [apps/frontend/src/shared/media/photo-ratio-cache.ts](../../../apps/frontend/src/shared/media/photo-ratio-cache.ts)

Кеш пропорций помогает не повторять измерение известного фото; он хранит геометрию, а не закрытые байты изображения.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PHOTO_RATIO_CACHE_LIMIT` | 3 | Кеш пропорций помогает не повторять измерение известного фото; он хранит геометрию, а не закрытые байты изображения. |
| `ratios` | 4 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `getCachedPhotoRatio` | 7 | Читаем известную пропорцию и переносим URL в конец LRU, не создавая дополнительный сетевой запрос. |
| `rememberPhotoRatio` | 17 | Принимаем только положительные конечные размеры, сохраняем отношение сторон и ограничиваем число URL в памяти. |

## [apps/frontend/src/shared/media/photo-tile.module.scss](../../../apps/frontend/src/shared/media/photo-tile.module.scss)

Оформление компонента: Плитка фотографии получает готовую геометрию и передаёт открытие владельцу списка.

## [apps/frontend/src/shared/media/photo-tile.tsx](../../../apps/frontend/src/shared/media/photo-tile.tsx)

Модуль photo-tile.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PhotoTileProps` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PhotoTile` | 20 | Смена URI сбрасывает локальное состояние отказа и повтора через новый экземпляр карточки. Кнопка повтора остаётся рядом с действием фото, без вложенных кнопок. |
| `PhotoTileContent` | 25 | Держим кнопку открытия и кнопку повтора соседями, чтобы не создавать вложенные интерактивные элементы. |

## [apps/frontend/src/shared/media/photo-urls.ts](../../../apps/frontend/src/shared/media/photo-urls.ts)

Модуль photo-urls.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `sanitizePhotoUrls` | 4 | Сохраняем порядок пригодных HTTP(S)-адресов и точных same-origin путей приватных файлов; некорректные элементы пропускаем. |

## [apps/frontend/src/shared/media/photo-viewer.module.scss](../../../apps/frontend/src/shared/media/photo-viewer.module.scss)

Оформление компонента: Полноэкранный просмотр владеет индексом и жестами, освобождая временные состояния при закрытии.

## [apps/frontend/src/shared/media/photo-viewer.tsx](../../../apps/frontend/src/shared/media/photo-viewer.tsx)

Модуль photo-viewer.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PhotoViewerProps` | 34 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PhotoViewer` | 41 | Удерживаем исходную карточку пока открыт просмотр; при закрытии внутренний экземпляр со всеми жестами размонтируется. |
| `PhotoViewerInner` | 59 | Полноэкранный диалог использует размеры окна, а не 480px-полотна; индекс объединяет scroll, клавиатуру и кнопки. |

## [apps/frontend/src/shared/media/post-media-section.tsx](../../../apps/frontend/src/shared/media/post-media-section.tsx)

Модуль post-media-section.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PostMediaItem` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PostMediaSectionProps` | 16 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PostMediaSection` | 22 | Разделяем вложения по типу; для защищённого attachment URL не используем случайную общую обложку вместо персонального posterUrl. |

## [apps/frontend/src/shared/media/post-photo-carousel.module.scss](../../../apps/frontend/src/shared/media/post-photo-carousel.module.scss)

Оформление компонента: Карусель сохраняет индекс и явное открытие фото.

## [apps/frontend/src/shared/media/post-photo-carousel.tsx](../../../apps/frontend/src/shared/media/post-photo-carousel.tsx)

Модуль post-photo-carousel.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PostPhotoCarousel` | 19 | Сохраняем выбранный кадр при измерении ширины и сокращении списка; загружаем только текущую фотографию и ближайших соседей. |

## [apps/frontend/src/shared/media/post-photo-frame.module.scss](../../../apps/frontend/src/shared/media/post-photo-frame.module.scss)

Рамка фотографии удерживает рассчитанные пропорции и наложенные действия, пока изображение загружается.

## [apps/frontend/src/shared/media/post-photo-rows.ts](../../../apps/frontend/src/shared/media/post-photo-rows.ts)

Раскладка рядов выбирается по числу фотографий; порядок исходных изображений сохраняется.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `postPhotoRows` | 3 | Разбиваем последовательность индексов на заполненные ряды; особые размеры 5 и 7 сохраняют более крупный первый ряд. |

## [apps/frontend/src/shared/media/post-video-carousel.module.scss](../../../apps/frontend/src/shared/media/post-video-carousel.module.scss)

Оформление компонента: Несколько роликов поста показываем в одной последовательности, сохраняя управление выбранным элементом.

## [apps/frontend/src/shared/media/post-video-carousel.tsx](../../../apps/frontend/src/shared/media/post-video-carousel.tsx)

Модуль post-video-carousel.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PostVideoSlide` | 17 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PostVideoCarousel` | 20 | Согласуем индекс, ширину и инертность слайдов; смена активности пересоздаёт VideoGridCell и освобождает старый плеер. |

## [apps/frontend/src/shared/media/private-content-upload.ts](../../../apps/frontend/src/shared/media/private-content-upload.ts)

Исходный файл, ключ и серверную квитанцию сверяем до привязки; повтор использует то же намерение и не переходит на публичную загрузку.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `AdminContentUsage` | 5 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ContentUsage` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ContentReceipt` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PrivateContentFile` | 16 | Контракт типов. Подробности и ограничения — в исходнике. |
| `PrivateContentApi` | 22 | Контракт типов. Подробности и ограничения — в исходнике. |
| `documents` | 34 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `limit` | 40 | Назначение файла определяет лимит: документ статьи допускает 32 МиБ, фотографии — 4 МиБ. |
| `validatePrivateContentFile` | 43 | Проверяем сохранённый исходник и ключ намерения до сетевой записи; MIME, имя и размер должны соответствовать назначению. |
| `requirePrivateContentReceipt` | 66 | Сверяем полный контракт квитанции с исходником: документ сохраняет размер/MIME, фото подтверждается как WebP, готовый URL строго соответствует assetId. |
| `uploadPrivateContentFile` | 119 | Сохраняем намерение и attempted до POST; после потери ответа сначала читаем статус прежнего ключа и сохраняем подтверждённую квитанцию. Публичной загрузки как fallback нет. |

## [apps/frontend/src/shared/media/private-upload-availability.ts](../../../apps/frontend/src/shared/media/private-upload-availability.ts)

До нового намерения загрузки выполняем читающую пробу; она проверяет доступность API, но не разрешает исход старой записи.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PrivateUploadStatus` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `checkPrivateUploadAvailability` | 12 | Пробуем новый случайный ключ только читающим status: допустим ровно notRecorded; результат не разрешает повтор прежней записи. |

## [apps/frontend/src/shared/media/read-attachment.ts](../../../apps/frontend/src/shared/media/read-attachment.ts)

Исходный Blob или адрес вложения преобразуется в Base64 в границах размера и срока текущей операции.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `attachmentBase64` | 11 | Читаем Blob или сетевой источник с общим лимитом вложения, затем кодируем под тем же сигналом отмены. |

## [apps/frontend/src/shared/media/upload-result.ts](../../../apps/frontend/src/shared/media/upload-result.ts)

Перед привязкой загруженного файла проверяем структуру результата, а не полагаемся только на успешный HTTP-статус.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `requireUploadedMedia` | 4 | Проверяем URL, непустой MIME без управляющих символов и положительный целочисленный размер перед привязкой результата. |
| `requireUploadedUrl` | 28 | Принимаем абсолютный HTTP(S)-адрес без учётных данных; успешный HTTP сам по себе не подтверждает пригодный результат загрузки. |

## [apps/frontend/src/shared/media/use-photo-mouse-drag.ts](../../../apps/frontend/src/shared/media/use-photo-mouse-drag.ts)

Модуль use-photo-mouse-drag.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Drag` | 13 | Контракт типов. Подробности и ограничения — в исходнике. |
| `usePhotoMouseDrag` | 27 | Дополняем нативный touch/trackpad drag-жестом мыши и после движения подавляем только порождённый им клик. |

## [apps/frontend/src/shared/media/video-grid-cell.module.scss](../../../apps/frontend/src/shared/media/video-grid-cell.module.scss)

Оформление компонента: Компактная ячейка видео отделяет постер и запуск от геометрии общей сетки публикаций.

## [apps/frontend/src/shared/media/video-grid-cell.tsx](../../../apps/frontend/src/shared/media/video-grid-cell.tsx)

Модуль video-grid-cell.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `VideoGridCellProps` | 16 | Контракт типов. Подробности и ограничения — в исходнике. |
| `VideoGridCell` | 24 | До действия отображаем постер, затем монтируем плеер; отдельный VK-плеер сохраняет 16:9 независимо от портретной обложки. |

## [apps/frontend/src/shared/media/video-poster.ts](../../../apps/frontend/src/shared/media/video-poster.ts)

Модуль video-poster.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `extractVideoPosterBlob` | 4 | Пытаемся получить JPEG-кадр из локального Blob за 15 секунд; обычная ошибка даёт null, явная отмена отклоняет Promise. |

## [apps/frontend/src/shared/media/video-preview.module.scss](../../../apps/frontend/src/shared/media/video-preview.module.scss)

Оформление компонента: Карточка до запуска показывает постер, а проигрыватель создаётся после действия пользователя.

## [apps/frontend/src/shared/media/video-preview.tsx](../../../apps/frontend/src/shared/media/video-preview.tsx)

Модуль video-preview.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `VideoPreviewProps` | 13 | Контракт типов. Подробности и ограничения — в исходнике. |
| `VideoPreviewCard` | 21 | Выбираем VK iframe или нативное video; пропорции постера и reels ограничивают высоту карточки текущим viewport. |

## [apps/frontend/src/shared/media/video-title.ts](../../../apps/frontend/src/shared/media/video-title.ts)

Модуль video-title.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `TITLE_OVERRIDES_BY_ID` | 3 | Читаемую подпись видео выбираем отдельно от идентификатора провайдера и адреса воспроизведения. |
| `TITLE_OVERRIDES` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `displayVideoTitle` | 15 | Применяем согласованные русские подписи к известным старым роликам, иначе сохраняем нормализованный заголовок API. |

## [apps/frontend/src/shared/media/vk-video-embed.tsx](../../../apps/frontend/src/shared/media/vk-video-embed.tsx)

Модуль vk-video-embed.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `subscribe` | 10 | Подписываем внешний store видимости на события документа и bfcache; cleanup снимает ровно эти listeners. |
| `VkVideoEmbed` | 22 | Создаём iframe только для проверенного VK URL на активном видимом экране; удаление плеера останавливает скрытый звук. |
| `Player` | 54 | Управляем одним адресом iframe и ручным повтором; onLoad подтверждает загрузку документа, а не успешный старт видео внутри VK. |

## [apps/frontend/src/shared/media/vk-video-url.ts](../../../apps/frontend/src/shared/media/vk-video-url.ts)

Экспортируемый адрес VK приводится к разрешённому формату плеера; ссылка на публикацию не равна адресу самого iframe.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `VK_PLAYER_HOSTS` | 2 | Экспортируемый адрес VK приводится к разрешённому формату плеера; ссылка на публикацию не равна адресу самого iframe. |
| `getVkVideoEmbedUrl` | 5 | Разбираем только экспортированный HTTPS-плеер VK с уникальными oid/id и необязательным валидным hash; лишние параметры отбрасываем, autoplay выключаем. |

## [apps/frontend/src/shared/media/youtube-embed.module.scss](../../../apps/frontend/src/shared/media/youtube-embed.module.scss)

Оформление компонента: Старый путь YouTube отделяет официальный iframe от серверного видеоисточника и управляет освобождением при уходе.

## [apps/frontend/src/shared/media/youtube-embed.tsx](../../../apps/frontend/src/shared/media/youtube-embed.tsx)

Модуль youtube-embed.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Props` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `YouTubeEmbed` | 14 | Оставляем совместимость старых роликов: адрес proxy-видео или официальный iframe выбирается явным флагом. |
| `OfficialPlayer` | 48 | Подключаем официальный iframe и удаляем src при pagehide/cleanup, чтобы не оставить ресурс после ухода. |

## [apps/frontend/src/shared/navigation/content-id.ts](../../../apps/frontend/src/shared/navigation/content-id.ts)

Числовой адрес материала принимаем только в канонической форме безопасного положительного целого.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `parseContentId` | 2 | Числовой адрес материала принимаем только в канонической форме безопасного положительного целого. |

## [apps/frontend/src/shared/navigation/external-url.ts](../../../apps/frontend/src/shared/navigation/external-url.ts)

Адреса действий проверяем перед открытием: строка ссылки не должна становиться исполняемой браузерной схемой.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `safeExternalUrl` | 5 | Разрешаем внутренний путь или URL из явного списка схем; credentials и управляющие символы делают адрес недопустимым. |
| `requirePaymentUrl` | 25 | Для перенаправления на оплату дополнительно требуем HTTPS; остальные разрешённые ссылки здесь не подходят. |

## [apps/frontend/src/shared/navigation/history.tsx](../../../apps/frontend/src/shared/navigation/history.tsx)

Модуль history.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `entryIndex` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `hasAppHistory` | 13 | Наличие предыдущей записи определяем своим индексом: history.length включает внешние сайты и пустую стартовую вкладку. |
| `NavigationHistory` | 20 | Добавляем индекс к push/replace, сохраняя служебные поля Next; при cleanup возвращаем только всё ещё свои wrappers. history.length включает внешние страницы и начальную пустую вкладку, поэтому для возврата его недостаточно. |

## [apps/frontend/src/shared/navigation/navigation-intent.ts](../../../apps/frontend/src/shared/navigation/navigation-intent.ts)

Возврат после входа и намерение оплаты храним отдельно от обычной истории переходов и проверяем допустимость пути.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `loginKey` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `clubKey` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `loginHistoryKey` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `clubHistoryKey` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `lifetime` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `navigationIntentEvent` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ClubNavigation` | 12 | Контракт типов. Подробности и ограничения — в исходнике. |
| `LoginDestination` | 13 | Контракт типов. Подробности и ограничения — в исходнике. |
| `SavedDestination` | 17 | Контракт типов. Подробности и ограничения — в исходнике. |
| `SavedClubNavigation` | 18 | Контракт типов. Подробности и ограничения — в исходнике. |
| `memory` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `unusedParameters` | 20 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `secretParameters` | 34 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `cleanParameters` | 42 | Удаляем служебные query и секреты из hash перед сохранением адреса в истории; не переносим их как навигационные данные. |
| `pages` | 54 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `appPage` | 72 | Этот локальный allowlist определяет допустимые адреса возврата, отдельно от списка реально существующих маршрутов Next. |
| `clubFlags` | 85 | Из query берём только два булевых hint; они меняют экран ожидания, но не подтверждают платёж или доступ. |
| `loginDestination` | 93 | Проверяем форму, нормализацию и разрешённый путь, сохраняя только безопасное назначение возврата без исходных секретных параметров. |
| `write` | 124 | Пытаемся сохранить intent в sessionStorage; при запрете хранилища оставляем только in-memory вариант этой вкладки. |
| `read` | 136 | Читаем сохранённое значение как unknown: JSON-разбор не подтверждает его срок, маршрут или структуру. |
| `remove` | 152 | Помечаем намерение потреблённым и при недоступном storage, чтобы fallback-память не возвращала прежнее значение. |
| `unexpired` | 162 | Срок должен быть будущим и укладываться в допустимое время хранения; произвольная дальняя дата не продлевает hint. |
| `savedDestination` | 173 | Повторно проверяем и срок, и маршрут прочитанного намерения, даже если оно записывалось нашей функцией раньше. |
| `rememberLoginReturn` | 180 | Сохраняем допустимое назначение с новым сроком; неподходящий адрес очищает прежний return intent. |
| `prepareLoginPage` | 188 | Однократно переносим старый next в проверенное состояние и очищаем адрес без создания дополнительной записи истории. |
| `consumeLoginReturn` | 207 | Извлекаем действующий return intent из storage или своей записи истории и удаляем его; без него возвращаем профиль. |
| `rememberClubNavigation` | 223 | Новое клубное намерение получает собственный ключ для отслеживания смены и сообщает активному экрану о записи. |
| `savedClubNavigation` | 232 | Проверяем два флага, срок и ключ прочитанного hint; остальные произвольные поля не переносятся в результат. |
| `captureClubNavigation` | 252 | Выбираем явные query-флаги раньше сохранённого hint, фиксируем результат в текущей записи и очищаем служебные параметры URL. Hint возврата не выдаёт доступ. |
| `clearOtherPageIntents` | 280 | Служебные флаги принадлежат своей странице; копирование history.state механизмом Next не должно переносить оплату на другой раздел. |

## [apps/frontend/src/shared/navigation/navigation-start.ts](../../../apps/frontend/src/shared/navigation/navigation-start.ts)

Уведомляем об уходе до фиксации нового маршрута, чтобы старая страница больше не владела отложенным перенаправлением.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `navigationStartEvent` | 2 | Уведомляем об уходе до фиксации нового маршрута, чтобы старая страница больше не владела отложенным перенаправлением. |
| `notifyNavigationStart` | 5 | Сообщаем страницам о переходе до завершения Next-навигации; на сервере браузерное событие не создаётся. |
| `watchCheckoutDeparture` | 13 | Отзываем право checkout на отложенный redirect при уходе с /club; переход в новой вкладке и download не считаются уходом текущей страницы. |

## [apps/frontend/src/shared/navigation/parent-route.ts](../../../apps/frontend/src/shared/navigation/parent-route.ts)

Для прямой ссылки без истории приложения выбираем понятный родительский раздел вместо случайного внешнего возврата.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `parentRoute` | 2 | Для прямой ссылки без истории приложения выбираем понятный родительский раздел вместо случайного внешнего возврата. |

## [apps/frontend/src/shared/navigation/paths.ts](../../../apps/frontend/src/shared/navigation/paths.ts)

Путь возврата ограничиваем внутренним адресом сайта, исключая сетевой URL и управляющие символы.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `safeNextPath` | 2 | Путь возврата ограничиваем внутренним адресом сайта, исключая сетевой URL и управляющие символы. |

## [apps/frontend/src/shared/navigation/post-address.ts](../../../apps/frontend/src/shared/navigation/post-address.ts)

Пост может иметь публичный UUID или старый числовой адрес; разбор и построение ссылки используют одно правило.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `publicPostId` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `parsePostAddress` | 8 | Разбираем старый числовой адрес или UUID v4; неподходящее значение не становится параметром API. |
| `postHref` | 16 | Для новой ссылки предпочитаем publicId, оставляя числовой fallback для старых записей. |

## [apps/frontend/src/shared/navigation/router.tsx](../../../apps/frontend/src/shared/navigation/router.tsx)

Модуль router.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Destination` | 16 | Контракт типов. Подробности и ограничения — в исходнике. |
| `publicPath` | 23 | Убираем старую Expo-группу из пути и распределяем параметры между динамическим сегментом и query, кодируя значения. |
| `useRouter` | 40 | Возвращаем единые команды Next с уведомлением об уходе и сохранением согласованных login/club намерений. |
| `Router` | 81 | Контракт типов. Подробности и ограничения — в исходнике. |
| `useFocusEffect` | 83 | Запускаем эффект только для активного сохранённого экрана; изменение маршрута вызывает его штатную очистку. |
| `useIsFocused` | 89 | Для совместимых экранов фокус означает активность панели, а не только наличие её DOM в документе. |
| `Link` | 93 | Совместимую ссылку переводим в публичный путь; prefetch отключён, чтобы не запускать ненужные загрузки соседних экранов. |
| `Redirect` | 107 | Клиентский redirect выполняет replace через общий router, сохраняя уведомление уходящей странице. |

## [apps/frontend/src/shared/navigation/screen-activity.tsx](../../../apps/frontend/src/shared/navigation/screen-activity.tsx)

Модуль screen-activity.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ScreenActivity` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `useScreenActive` | 8 | Читаем активность панели из контекста; вне retained-вкладок значение по умолчанию true. |

## [apps/frontend/src/shared/navigation/use-club-navigation.ts](../../../apps/frontend/src/shared/navigation/use-club-navigation.ts)

Модуль use-club-navigation.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `useClubNavigation` | 11 | Пока вкладка Клуба активна, синхронизируем navigation hint из истории при смене query и внутренних событиях. |

## [apps/frontend/src/shared/security/document-headers.ts](../../../apps/frontend/src/shared/security/document-headers.ts)

Политика HTML задаёт nonce для скриптов и список разрешённых источников; заголовки API формируются отдельно. Существующие React style-атрибуты поддерживаются; HTTPS-медиа разрешены, iframe ограничены провайдерами.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `documentSecurityHeaders` | 3 | Формируем политику только документа с переданным nonce; страница установки пароля получает более узкие источники и no-referrer. |

## [apps/frontend/src/shared/security/legacy-club-images.ts](../../../apps/frontend/src/shared/security/legacy-club-images.ts)

Манифест старых клубных изображений читается на сервере; клиентская сборка не должна включать доступ к файловой системе.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Manifest` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Rules` | 14 | Контракт типов. Подробности и ограничения — в исходнике. |
| `cached` | 15 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `validKey` | 18 | Ключ объекта должен быть однозначным относительным путём без управляющих символов, percent-двусмысленности и traversal-сегментов. |
| `loadRules` | 30 | Проверяем размер, SHA-256 и согласованность deny/preserved манифеста до кеширования; путь и digest вместе задают его версию. |
| `sourceKey` | 67 | Разворачиваем URL до разбора пути, сохраняя закодированный вопросительный знак частью ключа; неоднозначность отклоняется, а не угадывается. |
| `legacyClubImageStatus` | 106 | Только явно включённый guard перехватывает оптимизатор до cache hit: плохая настройка даёт 503, плохой URL — 400, закрытый ключ — 404. |

## [apps/frontend/src/shared/security/retired-library-assets.ts](../../../apps/frontend/src/shared/security/retired-library-assets.ts)

Список выведенных из публичной выдачи материалов проверяем и для прямых адресов, и для параметров оптимизатора изображений.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `paths` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `isRetiredLibraryAsset` | 6 | Декодируем ограниченное число оболочек URL и сверяем pathname с манифестом снятых материалов, включая запросы оптимизатора. |

## [apps/frontend/src/shared/styles/_base.scss](../../../apps/frontend/src/shared/styles/_base.scss)

Базовые правила документа и DOM-элементов применяются до локального оформления компонентов.

## [apps/frontend/src/shared/styles/_controls.scss](../../../apps/frontend/src/shared/styles/_controls.scss)

Общие состояния полей и кнопок задаются здесь; специфическая геометрия остаётся в CSS-модулях экранов.

## [apps/frontend/src/shared/styles/_fonts.scss](../../../apps/frontend/src/shared/styles/_fonts.scss)

Подключения локальных шрифтов и начертания вынесены отдельно; интерфейс использует их через общие семейства.

## [apps/frontend/src/shared/styles/_layers.scss](../../../apps/frontend/src/shared/styles/_layers.scss)

Порядок слоёв задаёт взаимное расположение меню, диалогов и обычного содержимого.

## [apps/frontend/src/shared/styles/_search.scss](../../../apps/frontend/src/shared/styles/_search.scss)

Единое оформление поисковых полей позволяет сохранить одинаковые отступы, значки и состояния в разделах.

## [apps/frontend/src/shared/styles/_tokens.scss](../../../apps/frontend/src/shared/styles/_tokens.scss)

Базовые CSS-токены используются общими контролами и экранными модулями, чтобы значения не расходились.

## [apps/frontend/src/shared/styles/global.scss](../../../apps/frontend/src/shared/styles/global.scss)

Общие стили документа задают базовую геометрию, шрифты и служебные состояния; модульные стили экранов подключаются отдельно.

## [apps/frontend/src/shared/styles/palette.ts](../../../apps/frontend/src/shared/styles/palette.ts)

Именованные цвета служат источником палитры; семантическое назначение выбирается в теме и компонентах.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `themeColors` | 3 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `palette` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/styles/tab-assets.ts](../../../apps/frontend/src/shared/styles/tab-assets.ts)

Модуль tab-assets.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CLUB_MUSIC_URL` | 3 | Изображения вкладок собраны отдельно от навигации, чтобы подписи маршрутов не зависели от выбора ресурсов. Лицензированная фоновая музыка клуба хранится отдельно от навигационных ресурсов. |
| `VIDEO_FILM_DECOR_URL` | 6 | Video tab banner decorations (from design reference) |
| `VIDEO_ROSE_DECOR_URL` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/styles/theme-core.ts](../../../apps/frontend/src/shared/styles/theme-core.ts)

Модуль theme-core.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ColorScheme` | 4 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ThemeColors` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ThemeColorTokens` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ThemeColorName` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `SchemePalette` | 8 | Контракт типов. Подробности и ограничения — в исходнике. |
| `SchemePaletteItem` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `buildSchemePalette` | 11 | Разворачиваем пары light/dark в две палитры с одинаковыми именами токенов; источником остаётся один themeColors. |
| `SchemeColors` | 23 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `RuntimePalette` | 24 | Контракт типов. Подробности и ограничения — в исходнике. |
| `buildRuntimePalette` | 34 | Добавляем совместимые семантические имена text/icon/tab поверх схемы, сохраняя исходные значения базовых токенов. |
| `Colors` | 47 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ThemeColorPalette` | 51 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Fonts` | 52 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/styles/theme-provider.module.scss](../../../apps/frontend/src/shared/styles/theme-provider.module.scss)

Оформление компонента: Контекст темы связывает выбранную схему с общими цветами компонентов.

## [apps/frontend/src/shared/styles/theme-provider.tsx](../../../apps/frontend/src/shared/styles/theme-provider.tsx)

Модуль theme-provider.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ThemeContextValue` | 15 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ThemeContext` | 19 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ThemeProvider` | 21 | Контекст хранит выбранную схему и синхронизирует её с CSS-переменными; изменение оформления клуба к этому состоянию не относится. |
| `useThemeContext` | 64 | Вне провайдера выдаём явную ошибку конфигурации дерева вместо выдуманной темы. |

## [apps/frontend/src/shared/styles/theme.ts](../../../apps/frontend/src/shared/styles/theme.ts)

Модуль theme.ts; объявления и смысловые границы перечислены ниже.

## [apps/frontend/src/shared/styles/use-color-scheme.ts](../../../apps/frontend/src/shared/styles/use-color-scheme.ts)

Модуль use-color-scheme.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `useColorScheme` | 6 | До hydration возвращаем light, затем системное предпочтение; это сохраняет одинаковый первый серверный и клиентский кадр. |

## [apps/frontend/src/shared/styles/use-colors.ts](../../../apps/frontend/src/shared/styles/use-colors.ts)

Модуль use-colors.ts; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `useColors` | 10 | Явная схема вызова имеет приоритет над системной; результатом остаётся готовая палитра, а не изменение темы документа. |

## [apps/frontend/src/shared/ui/action.tsx](../../../apps/frontend/src/shared/ui/action.tsx)

Модуль action.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ActionProps` | 12 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Action` | 36 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/ui/background-notice.module.scss](../../../apps/frontend/src/shared/ui/background-notice.module.scss)

Оформление компонента: Общие фоновые сообщения имеют владельцев и приоритет.

## [apps/frontend/src/shared/ui/background-notice.tsx](../../../apps/frontend/src/shared/ui/background-notice.tsx)

Модуль background-notice.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `NoticeAction` | 18 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Notice` | 24 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Registry` | 31 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `BackgroundNoticeProvider` | 37 | Храним сообщения по стабильному ID владельца; регистрация возвращает удаление только его записи. |
| `useBackgroundNotice` | 62 | Регистрируем ошибку только активного экрана; актуальные действия читаем через ref и сопоставляем по ID. |
| `BackgroundNoticeSlot` | 117 | Показываем одно сообщение с наибольшим приоритетом, но общий повтор запускает все доступные восстановления. |

## [apps/frontend/src/shared/ui/background.tsx](../../../apps/frontend/src/shared/ui/background.tsx)

Модуль background.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BackgroundProps` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Background` | 14 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/ui/blur.tsx](../../../apps/frontend/src/shared/ui/blur.tsx)

Модуль blur.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BlurView` | 6 | Имитируем слой размытия через backdrop-filter и полупрозрачную подложку; это только оформление доступного содержимого. |

## [apps/frontend/src/shared/ui/bottom-tab-icon.tsx](../../../apps/frontend/src/shared/ui/bottom-tab-icon.tsx)

SVG-пути нижнего меню хранятся рядом с их отображением; исходная лицензия Material Icons сохранена ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `paths` | 4 | SVG-пути нижнего меню хранятся рядом с их отображением; исходная лицензия Material Icons сохранена ниже. |
| `BottomTabIcon` | 29 | Рисуем геометрию меню напрямую через SVG, чтобы его размеры не зависели от момента загрузки шрифта значков. |

## [apps/frontend/src/shared/ui/bottom-tabs.module.scss](../../../apps/frontend/src/shared/ui/bottom-tabs.module.scss)

Оформление компонента: Нижние вкладки используют маршруты Next и состояние перехода, сохраняя корректные ссылки и доступные названия.

## [apps/frontend/src/shared/ui/bottom-tabs.tsx](../../../apps/frontend/src/shared/ui/bottom-tabs.tsx)

Модуль bottom-tabs.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `tabs` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `TabContents` | 19 | Читаем pending внутри конкретной ссылки Next: индикатор и доступная подпись относятся к выбранному переходу. |
| `BottomTabs` | 45 | Подсвечиваем родительский раздел деталей поста, видео и теста; ссылки остаются обычными маршрутами Next. |

## [apps/frontend/src/shared/ui/collection-item-window.tsx](../../../apps/frontend/src/shared/ui/collection-item-window.tsx)

Модуль collection-item-window.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ItemWindow` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `useCollectionItemRetention` | 25 | Выдаём явный токен удержания карточки на время ввода или операции; очистка освобождает только этот токен. |
| `useCollectionItemPlaceholder` | 36 | Запоминаем высоту завершённого блока и резервируем её при повторном чтении вытесненных данных. |
| `CollectionItemWindow` | 55 | Оставляем далёкую строку измеренным spacer, но сохраняем React-состояние при фокусе, удержании или начатом воспроизведении. |

## [apps/frontend/src/shared/ui/collection.module.scss](../../../apps/frontend/src/shared/ui/collection.module.scss)

Оформление компонента: Коллекция связывает прокрутку, видимые элементы и сохранение положения с ограничением числа смонтированных карточек.

## [apps/frontend/src/shared/ui/collection.tsx](../../../apps/frontend/src/shared/ui/collection.tsx)

Модуль collection.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Slot` | 18 | Контракт типов. Подробности и ограничения — в исходнике. |
| `slot` | 20 | Вычисляем ленивое содержимое слота только при его отображении; готовый ReactNode используем без преобразования. |
| `CollectionProps` | 21 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CollectionInner` | 46 | Связываем страницы данных с DOM-окном: удерживаем взаимодействующие карточки отдельно от данных и явно сохраняем якорь прокрутки. |
| `Collection` | 399 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `CollectionRow` | 406 | Выбираем измеряемое окно только при включённом windowing; обычная строка сохраняет ту же разметку и индекс. |
| `ScrollSnapshot` | 422 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CollectionScrollAnchor` | 428 | Capture before React changes the DOM; keep the first surviving visible row in place when pages are prepended, removed, or revalidated. |
| `CollectionScrollAnchor.getSnapshotBeforeUpdate` | 436 | Снимаем якоря до изменения DOM: сохраняем несколько кандидатов на случай удаления первой видимой строки. |
| `CollectionScrollAnchor.componentDidUpdate` | 472 | После изменения страниц компенсируем сдвиг по первому сохранившемуся якорю, используя захваченный DOM-узел, а не callback ref. |
| `CollectionScrollAnchor.render` | 491 | Обёртка не добавляет DOM: её задача — порядок измерений до и после обновления детей. |

## [apps/frontend/src/shared/ui/content-placeholder.module.scss](../../../apps/frontend/src/shared/ui/content-placeholder.module.scss)

Оформление компонента: Заглушки сохраняют форму контента при ожидании, не добавляя повторных анимаций поверх уже подтверждённых данных.

## [apps/frontend/src/shared/ui/content-placeholder.tsx](../../../apps/frontend/src/shared/ui/content-placeholder.tsx)

Заглушки сохраняют форму контента при ожидании, не добавляя повторных анимаций поверх уже подтверждённых данных.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PlaceholderKind` | 4 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ContentPlaceholder` | 7 | Сохраняем форму ожидаемого контента статичными карточками; видимые рамки декоративны, состояние загрузки озвучивается один раз. Повторного shimmer или анимированного вступления у заглушки нет. |

## [apps/frontend/src/shared/ui/content-request-state.tsx](../../../apps/frontend/src/shared/ui/content-request-state.tsx)

Модуль content-request-state.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ContentRequestState` | 8 | Отделяем отсутствие объекта (404 или пустой результат) от ошибки запроса, для которой доступен повтор. |

## [apps/frontend/src/shared/ui/css.ts](../../../apps/frontend/src/shared/ui/css.ts)

Объединение стилей и преобразование размеров дают DOM-компонентам общий формат CSS-свойств.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `StyleInput` | 4 | Контракт типов. Подробности и ограничения — в исходнике. |
| `mergeStyles` | 11 | Рекурсивно разворачиваем массивы и пропускаем false/null; более поздние свойства перекрывают ранние как в совместимых style-массивах. |
| `px` | 20 | Число становится CSS-длиной px, готовая строка сохраняет собственную единицу измерения. |
| `cssTransform` | 23 | Последовательность transform сохраняет порядок; translate/perspective получают px, остальные числовые значения остаются безразмерными. |

## [apps/frontend/src/shared/ui/cursor-page-previous.tsx](../../../apps/frontend/src/shared/ui/cursor-page-previous.tsx)

Модуль cursor-page-previous.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PageReader` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `CursorPagePrevious` | 16 | Предлагаем предыдущую страницу только при доступном курсоре и разрешённом чтении; повтор использует тот же hook. |

## [apps/frontend/src/shared/ui/dialog.tsx](../../../apps/frontend/src/shared/ui/dialog.tsx)

Модуль dialog.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `dialogStack` | 6 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `originalInert` | 7 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `syncDialogBackground` | 10 | Оставляем активным только верхний портал; после закрытия последнего окна восстанавливаем исходный inert каждого элемента. |
| `DialogProps` | 23 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Dialog` | 32 | Портал открывается только на активном экране, владеет фокусом и возвращает его источнику после закрытия. |

## [apps/frontend/src/shared/ui/dom-image.tsx](../../../apps/frontend/src/shared/ui/dom-image.tsx)

Модуль dom-image.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ImageAsset` | 5 | Контракт типов. Подробности и ограничения — в исходнике. |
| `DomImageProps` | 10 | Контракт типов. Подробности и ограничения — в исходнике. |
| `DomImage` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/ui/elements.tsx](../../../apps/frontend/src/shared/ui/elements.tsx)

Публичная точка входа базовых UI-элементов сохраняет единые компоненты для разных разделов приложения.

## [apps/frontend/src/shared/ui/field.tsx](../../../apps/frontend/src/shared/ui/field.tsx)

Модуль field.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `FieldProps` | 4 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Field` | 21 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/ui/glyphs/material-icons-LICENSE.txt](../../../apps/frontend/src/shared/ui/glyphs/material-icons-LICENSE.txt)

Служебный файл проекта; назначение уточняется по каталогу и связанному README.

## [apps/frontend/src/shared/ui/glyphs/MaterialIcons.json](../../../apps/frontend/src/shared/ui/glyphs/MaterialIcons.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [apps/frontend/src/shared/ui/gradient.tsx](../../../apps/frontend/src/shared/ui/gradient.tsx)

Модуль gradient.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `LinearGradient` | 6 | Переводим вектор start/end и доли остановок в CSS linear-gradient; внешние стили могут переопределить результат. |

## [apps/frontend/src/shared/ui/icons.module.scss](../../../apps/frontend/src/shared/ui/icons.module.scss)

Оформление компонента: Шрифт значков используется через общий набор имён и стилей, чтобы экран не зависел от числовых кодов глифов.

## [apps/frontend/src/shared/ui/icons.tsx](../../../apps/frontend/src/shared/ui/icons.tsx)

Модуль icons.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Props` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `family` | 15 | Связываем таблицу кодов с конкретным шрифтом; экраны работают с именами, неизвестный глиф даёт пустой текст. |
| `MaterialIcons` | 38 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/ui/loading-indicator.tsx](../../../apps/frontend/src/shared/ui/loading-indicator.tsx)

Индикатор локальной операции использует общую геометрию и доступную текстовую подпись.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `LoadingIndicator` | 5 | Согласуем размер индикатора и подпись: диктор читает label из Spinner, видимый текст помечен как декоративный. Группа предназначена для проверки доступа и локальных операций списка. |

## [apps/frontend/src/shared/ui/material-icon.ts](../../../apps/frontend/src/shared/ui/material-icon.ts)

Совместимый экспорт оставляет прежнее имя импорта значков, направляя отображение в общий компонент.

## [apps/frontend/src/shared/ui/measured-box.tsx](../../../apps/frontend/src/shared/ui/measured-box.tsx)

Модуль measured-box.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `MeasuredBox` | 5 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/ui/post-menu-button.module.scss](../../../apps/frontend/src/shared/ui/post-menu-button.module.scss)

Оформление компонента: Кнопка действий поста отделена от самой карточки, чтобы открытие меню не запускало переход в материал.

## [apps/frontend/src/shared/ui/post-menu-button.tsx](../../../apps/frontend/src/shared/ui/post-menu-button.tsx)

Модуль post-menu-button.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `PostMenuButton` | 7 | Отображаем отдельное действие карточки; Action с обработчиком остановит распространение клика на переход поста. |

## [apps/frontend/src/shared/ui/query-retry-state.module.scss](../../../apps/frontend/src/shared/ui/query-retry-state.module.scss)

Оформление компонента: Чтение с ошибкой показывает общий повтор и загрузку.

## [apps/frontend/src/shared/ui/query-retry-state.tsx](../../../apps/frontend/src/shared/ui/query-retry-state.tsx)

Модуль query-retry-state.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Props` | 7 | Контракт типов. Подробности и ограничения — в исходнике. |
| `QueryRetryState` | 20 | Подменяем содержимое только до первого результата: при повторной загрузке уже полученные данные остаются видимыми. |

## [apps/frontend/src/shared/ui/route-loading.tsx](../../../apps/frontend/src/shared/ui/route-loading.tsx)

Небольшая заглушка маршрута не дублирует баннер и анимацию экрана, который ещё загружается.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `RouteLoading` | 4 | Показываем лёгкое состояние перехода внутри общего контейнера; path служит меткой открываемого раздела. |

## [apps/frontend/src/shared/ui/safe-area.tsx](../../../apps/frontend/src/shared/ui/safe-area.tsx)

Модуль safe-area.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Edge` | 5 | Контракт типов. Подробности и ограничения — в исходнике. |
| `SafeArea` | 8 | Добавляем безопасные отступы только на выбранных сторонах; верх и низ допускают значения контейнера Mini App. |

## [apps/frontend/src/shared/ui/screen-container.module.scss](../../../apps/frontend/src/shared/ui/screen-container.module.scss)

Оформление компонента: Оболочка экрана задаёт фон и безопасные отступы, оставляя бизнес-состояния дочернему содержимому.

## [apps/frontend/src/shared/ui/screen-container.tsx](../../../apps/frontend/src/shared/ui/screen-container.tsx)

Модуль screen-container.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `paper` | 9 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ScreenContainerProps` | 11 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ScreenContainer` | 18 | Собираем безопасную область и необязательную прокрутку; текстура и однотонный фон используют одинаковую внутреннюю геометрию. |

## [apps/frontend/src/shared/ui/screen-error-boundary.tsx](../../../apps/frontend/src/shared/ui/screen-error-boundary.tsx)

Модуль screen-error-boundary.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Props` | 6 | Контракт типов. Подробности и ограничения — в исходнике. |
| `State` | 11 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ScreenErrorBoundary` | 15 | Catches render errors so Safari/WebKit does not reload the page in a crash loop. |
| `ScreenErrorBoundary.getDerivedStateFromError` | 18 | Переключаем границу на запасное представление после ошибки рендера дочернего экрана. |
| `ScreenErrorBoundary.componentDidCatch` | 22 | Оставляем подробную ошибку только в диагностике разработки, не выводя её текст пользователю. |
| `ScreenErrorBoundary.render` | 33 | При ошибке сохраняем оболочку экрана с явным повтором; иначе возвращаем исходных детей. |

## [apps/frontend/src/shared/ui/screen-status.module.scss](../../../apps/frontend/src/shared/ui/screen-status.module.scss)

Оформление компонента: Контейнер состояния сохраняет общую структуру страницы для ожидания, отказа доступа и ошибки.

## [apps/frontend/src/shared/ui/screen-status.tsx](../../../apps/frontend/src/shared/ui/screen-status.tsx)

Модуль screen-status.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ScreenStatus` | 9 | Размещаем полноэкранное состояние в прокручиваемой безопасной области без участия автоскрытия шапки. |

## [apps/frontend/src/shared/ui/scroll-area.tsx](../../../apps/frontend/src/shared/ui/scroll-area.tsx)

Модуль scroll-area.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `ScrollAreaProps` | 14 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ScrollArea` | 29 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/ui/scroll-to-top-button.module.scss](../../../apps/frontend/src/shared/ui/scroll-to-top-button.module.scss)

Оформление компонента: Кнопка возврата управляет прокруткой своей области экрана и появляется независимо от состояния списка данных.

## [apps/frontend/src/shared/ui/scroll-to-top-button.tsx](../../../apps/frontend/src/shared/ui/scroll-to-top-button.tsx)

Модуль scroll-to-top-button.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `CREAM_BG` | 8 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `ScrollToTopButtonProps` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ScrollToTopButton` | 14 | Показываем возврат после порога прокрутки; при оконной пагинации сначала даём владельцу восстановить начальные данные. |

## [apps/frontend/src/shared/ui/spinner.tsx](../../../apps/frontend/src/shared/ui/spinner.tsx)

Модуль spinner.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Spinner` | 5 | Переводим стандартный или числовой размер в геометрию индикатора; результат операции этот компонент не определяет. |

## [apps/frontend/src/shared/ui/static-image-catalog.ts](../../../apps/frontend/src/shared/ui/static-image-catalog.ts)

Generated by tooling/assets/generate-frontend-image-catalog.mjs.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `STATIC_IMAGE_URLS` | 61 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `STATIC_IMAGE_VARIANTS` | 265 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/ui/static-images.ts](../../../apps/frontend/src/shared/ui/static-images.ts)

Версионированные локальные ресурсы и разрешённые публичные фото получают srcset; закрытые и подписанные адреса не переписываются этим правилом.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `isPublicFeedPhoto` | 9 | Разрешаем оптимизатору только канонические публичные фото feed без query, авторизации и фрагмента. |
| `resolveImageUri` | 27 | Переписываем только точное совпадение с каталогом сборки; внешние и защищённые адреса остаются исходными. |
| `resolveImageAttributes` | 34 | Выбираем оптимизатор или готовый srcset только для разрешённых превью; fullSize сохраняет путь для полного просмотра. Подписанные URL, закрытые API-медиа, blob и fullSize обходят оптимизатор. |

## [apps/frontend/src/shared/ui/status-notice.module.scss](../../../apps/frontend/src/shared/ui/status-notice.module.scss)

Оформление компонента: Общее сообщение состояния отделяет текст, значок и явные действия повтора или перехода.

## [apps/frontend/src/shared/ui/status-notice.tsx](../../../apps/frontend/src/shared/ui/status-notice.tsx)

Модуль status-notice.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `Tone` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `StatusNoticeProps` | 10 | Контракт типов. Подробности и ограничения — в исходнике. |
| `StatusNotice` | 18 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `StatusNoticeAction` | 72 | Оформляем обычное действие в стиле сообщения, сохраняя его обработчики и состояние disabled. |
| `StatusNoticeLink` | 85 | Даём переходу Next такое же оформление, как действиям сообщения; навигацию оставляем самому Link. |

## [apps/frontend/src/shared/ui/tab-header.module.scss](../../../apps/frontend/src/shared/ui/tab-header.module.scss)

Оформление компонента: Общая шапка связывает домашний переход, возврат, профиль и музыку с текущим разделом.

## [apps/frontend/src/shared/ui/tab-header.tsx](../../../apps/frontend/src/shared/ui/tab-header.tsx)

Модуль tab-header.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `TabHeader` | 11 | Собираем общую навигацию; явный backHref заменяет текущий маршрут, иначе возврат решает общий router. |

## [apps/frontend/src/shared/ui/tab-music-toggle.module.scss](../../../apps/frontend/src/shared/ui/tab-music-toggle.module.scss)

Оформление компонента: Фоновая музыка вкладки управляется отдельным плеером.

## [apps/frontend/src/shared/ui/tab-music-toggle.tsx](../../../apps/frontend/src/shared/ui/tab-music-toggle.tsx)

Модуль tab-music-toggle.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `TabMusicToggleProps` | 9 | Контракт типов. Подробности и ограничения — в исходнике. |
| `TabMusicToggle` | 15 | Кнопка управляет выделенным аудиоплеером: повтор ошибки относится только к тому экземпляру, запуск которого пользователь уже пытался выполнить. |

## [apps/frontend/src/shared/ui/types.ts](../../../apps/frontend/src/shared/ui/types.ts)

Общие DOM-типы описывают размеры и события базовых UI-компонентов без привязки к бизнес-сценариям.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `BoxProps` | 3 | Контракт типов. Подробности и ограничения — в исходнике. |
| `ScrollEvent` | 4 | Контракт типов. Подробности и ограничения — в исходнике. |
| `LayoutRect` | 5 | Контракт типов. Подробности и ограничения — в исходнике. |
| `VisibleItem` | 11 | Контракт типов. Подробности и ограничения — в исходнике. |

## [apps/frontend/src/shared/ui/typography.tsx](../../../apps/frontend/src/shared/ui/typography.tsx)

Модуль typography.tsx; объявления и смысловые границы перечислены ниже.

| Блок | Строка | Назначение |
| --- | --- | --- |
| `TextContext` | 10 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |
| `TypographyProps` | 11 | Контракт типов. Подробности и ограничения — в исходнике. |
| `Typography` | 16 | Объявление данных или схемы. Подробности и ограничения — в исходнике. |

## [apps/frontend/tsconfig.e2e.json](../../../apps/frontend/tsconfig.e2e.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.

## [apps/frontend/tsconfig.json](../../../apps/frontend/tsconfig.json)

Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.
