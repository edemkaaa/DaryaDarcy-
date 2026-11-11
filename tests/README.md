# Проверки

- `*.test.ts`: unit, HTTP и составные проверки по именам модулей.
- `*.mysql.test.ts`, `mysql-backup.test.ts`, `private-library.browser.test.ts`:
  SQL-проект Vitest, выполняемый последовательно на одноразовой БД.
- [regression/](regression/): общие регрессии, перенесённые из корневого `__tests__`.
- [helpers/](helpers/) и [fixtures/](fixtures/): подготовка окружения и тестовые входы.
- Браузерные сценарии действующего клиента: [apps/frontend/e2e](../apps/frontend/e2e/).
- Отдельные Node tests: [apps/video-service/test](../apps/video-service/test/).

Каноническая конфигурация разделения unit/MySQL —
[vitest.config.mts](../vitest.config.mts). Команды запускаются из корня:

```sh
pnpm exec vitest run --project unit
pnpm verify
pnpm test:quiz
```

Рабочие ключи и адреса интеграций в обычном тестовом окружении отсутствуют.
`regression/s3-connection.test.ts` с S3-ключами выполняет настоящую публичную
запись; это не проверка только чтения. SQL и внешние провайдеры проверяются
отдельно по [инструкции](../docs/development/workflow.md).
