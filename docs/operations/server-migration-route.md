# Маршрут Daryadarcy

> Это целевая схема, а не уже развёрнутая сеть. Сначала восстановить российский backend/БД из доступных проверенных копий, затем измерить маршруты и CDN. Расположение фактических данных и стабильность с конкретными VPN здесь не подтверждены.

## Как идут запросы

```mermaid
flowchart TD
    user(["Посетитель<br/>РФ · Европа · VPN"])
    user --> domain("Домен Daryadarcy")
    user --> cdn("CDN<br/>Публичные фото и обложки")
    user --> vk("Плеер VK<br/>Видео идёт напрямую из VK")

    domain -->|После проверки| kz("Прокси в Алматы<br/>Пересылает зашифрованный HTTPS")
    domain -. При сбое Алматы меняем DNS .-> ru("Сайт и API в России<br/>Здесь расшифровывается HTTPS")
    kz -->|WireGuard| ru

    ru --> db[("MySQL в России")]
    ru --> access{"Есть клубный доступ?"}
    access -->|Да| private[("Закрытые файлы<br/>S3 в России")]
    access -->|Нет| denied("Доступ закрыт")
    cdn -->|Если превью нет в кеше| public[("Публичные превью<br/>S3 в России")]

    classDef entry fill:#F1E9FA,stroke:#8B6AA8,color:#35234A
    classDef route fill:#E5F0FF,stroke:#5D87B9,color:#183653
    classDef media fill:#FCEDD8,stroke:#B58A53,color:#523613
    classDef data fill:#E4F3EB,stroke:#6C9B83,color:#234939
    classDef blocked fill:#F8E6E4,stroke:#B57872,color:#663330
    class user,domain entry
    class kz,ru route
    class cdn,vk,public media
    class db,access,private data
    class denied blocked
```

## Порядок запуска

```mermaid
flowchart LR
    restore("01 · Сервер РФ<br/>Восстановить БД")
    app("02 · Приложение<br/>Проверить вход и Клуб")
    routes("03 · Маршруты<br/>Сравнить РФ и Алматы")
    cdn("04 · Фотографии<br/>Сравнить S3 и CDN")
    release("05 · Запуск<br/>Переключить домен")
    restore --> app --> routes --> cdn --> release

    classDef preparation fill:#E5F0FF,stroke:#5D87B9,color:#183653
    classDef testing fill:#FCEDD8,stroke:#B58A53,color:#523613
    classDef ready fill:#E4F3EB,stroke:#6C9B83,color:#234939
    class restore,app preparation
    class routes,cdn testing
    class release ready
```

[Подробный порядок настройки для DevOps](server-migration-ru-kz-cdn-2026-11-10.md)
