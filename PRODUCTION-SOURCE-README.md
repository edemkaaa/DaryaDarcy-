# Production source snapshot — 20 сентября 2026

Этот архив содержит **точный исходный код**, соответствующий frontend-сборке на сайте **https://daryadarcy.com** по состоянию на **17.09.2026 16:14 UTC**.

## Frontend на production

| Маркер | Значение |
|--------|----------|
| Deploy tag | `2026-09-17T16:14:51.072Z` |
| Entry bundle | `entry-2da09407d85e1065626fae63b60f839a.js` |
| Common chunk | `__common-2a12136c20dfbb8b85e55222f4a6a910.js` |
| Сборка в архиве | `web-dist/` (локальная копия, совпадает с VPS) |

## Git

| Параметр | Значение |
|----------|----------|
| Базовый commit | `a1cecf0` (tag `prod-stable-2026-09-17`) |
| Состояние | **все незакоммиченные правки включены** (гибридная стабильная версия) |

### Что в гибриде (отличия от `a1cecf0`)

- Shop routes в tabs (`app/(tabs)/shop/`) — профиль и магазин работают
- UI из сентября: карусель, Woolen, документы, видео, shop UI
- **Отключено:** moodboard (`_disabled/moodboard-routes/`), AppBootGate, web-touch-unblock
- S3 media backup: `tooling/scripts/s3-media-backup.mjs`, `docs/S3-BACKUP.md`

## Быстрый старт

```bash
npm install
cp production.env .env   # или .env.example для dev
npm run verify
npm run build:web        # → web-dist/
npm run dev              # API :3000 + web :8081
```

## Deploy

```bash
npm run verify && npm run build:web
python3 tooling/scripts/ssh-deploy-web-direct.py
npm run deploy:api
npm run smoke
```

## Отличие от архива 18.09

Первый архив (`daryadarcy_handover_2026-09-18.zip`) содержал commit `a1cecf0` **без** последующих правок.
**Этот архив** — полное рабочее дерево на дату 20.09.2026, включая production-фиксы после отката.

Подготовил: Иван, 20.09.2026
