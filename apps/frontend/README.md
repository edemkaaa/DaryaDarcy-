# Фронтенд Daryadarcy

Основной клиент написан на Expo / React Native с Expo Router. Из этих же исходников собираются web, iOS и Android. Старый Vite-клиент находится отдельно в [legacy-web](../legacy-web/).

## Где менять

- app/ — маршруты и экраны.
- components/ — компоненты интерфейса.
- hooks/ — клиентская логика и состояние.
- lib/ — клиент API и вспомогательные функции.
- assets/ — используемые приложением изображения, шрифты и другие ресурсы.
- app.config.ts — конфигурация Expo.
- [public/](../../public/) — публичные веб-ресурсы в корне репозитория.

Общие контракты находятся в [packages/shared](../../packages/shared/). Справочные тексты и заметки дизайна — в [docs/reference](../../docs/reference/), не среди исполняемых модулей.

## Команды из корня

```sh
pnpm dev:metro
pnpm build:web
pnpm android
pnpm ios
```

Для работы API запускайте pnpm dev:server или весь проект командой pnpm dev. Настройки и подготовка окружения — в [инструкции запуска](../../docs/development/getting-started.md).

Нативная сборка и реальное устройство требуют отдельной настройки среды. Успешная web-сборка не подтверждает работоспособность iOS/Android или доставку push.

[Push: текущие ограничения](../../docs/architecture/push.md) · [рабочий процесс](../../docs/development/workflow.md) · [задачи](../../tasks/todo.md).
