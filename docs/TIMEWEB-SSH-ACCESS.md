# SSH к VPS Timeweb (daryadarcy-main)

На сервере SSH уже работает (порт 22, UFW, sshd — OK).

Если с ПК **timeout**, а сайт открывается — часто виноват **VPN (hidemy.name и др.)**: режут исходящий **порт 22**, но **443/80** к тому же IP проходят. Timeweb Firewall при этом может быть пустым.

## Шаг 1 — ваш IP (для безопасного правила)

На **своём ПК** откройте в браузере: https://ifconfig.me  
Скопируйте IPv4, например `95.123.45.67`.

## Шаг 2 — панель Timeweb

1. https://timeweb.cloud → **Облачные серверы** → **daryadarcy-main** (kvmnvm-874)
2. Вкладка **Сеть** или раздел **Сети → Firewall**
3. Посмотрите, **привязана ли группа firewall** к серверу:
   - если есть группа только с «запретить всё» — нужно добавить **разрешающее** правило ниже
   - если firewall **не привязан** — создайте группу и привяжите

## Шаг 3 — создать группу (если нет)

**Сети → Firewall → Создать группу**

| Поле | Значение |
|------|----------|
| Имя | `daryadarcy-ssh` |
| Тип группы | **Разрешающая** (ingress allow) |

### Правило 1 — SSH (обязательно)

| Поле | Значение |
|------|----------|
| Направление | **Входящий** (Ingress) |
| Протокол | **TCP** |
| Порт | **22** |
| Источник / CIDR | `ВАШ_IP/32` (например `95.123.45.67/32`) |

Для временного доступа с любого места (менее безопасно):

| Источник | `0.0.0.0/0` |

### Правила 2–3 — сайт (если группа единственная)

| Направление | Протокол | Порт | Источник |
|-------------|----------|------|----------|
| Входящий | TCP | **80** | `0.0.0.0/0` |
| Входящий | TCP | **443** | `0.0.0.0/0` |

Сохраните группу.

## Шаг 4 — привязать к серверу

**Сервер daryadarcy-main → Сеть → Firewall → Применить группу** → выберите `daryadarcy-ssh`.

Подождите 1–2 минуты.

## Шаг 5 — проверка с ПК

PowerShell:

```powershell
Test-NetConnection 200.165.234.36 -Port 22
```

`TcpTestSucceeded : True` → подключение:

```powershell
ssh root@200.165.234.36
```

Деплой API:

```powershell
cd C:\Users\Иван\Downloads\daryadarcy_app
npm run deploy:api
```

## hidemy.name VPN (частая причина timeout)

Если `InterfaceAlias` = `hidemy.name VPN OpenVPN Adapter`, SSH к VPS не проходит через туннель.

**Авто (уже прописано в конфиге VPN):**

```powershell
cd C:\Users\Иван\Downloads\daryadarcy_app
python3 tooling/scripts/set-hidemy-vps-bypass.py
```

Затем в hidemy.name: **Отключить → Подключить** VPN.

**Вручную в приложении:** Настройки → **OpenVPN** → маршрутизация → добавить `200.165.234.36` и `daryadarcy.com` → **без VPN**.

**Сразу после подключения VPN (от администратора):**

```powershell
powershell -ExecutionPolicy Bypass -File scripts\vpn-bypass-daryadarcy.ps1
```

Проверка: `Test-NetConnection 200.165.234.36 -Port 22` → `TcpTestSucceeded : True`.

## Если всё ещё timeout

1. **Другой интернет** — раздача с телефона, другой Wi‑Fi (иногда провайдер режет порт 22).
2. **IPv6** — попробуйте: `ssh root@2a03:6f00:a::2:be51`
3. **Консоль Timeweb** — деплой без SSH: загрузить `dist/index.mjs` в `/var/www/daryadarcy/dist/`, затем `pm2 restart daryadarcy-api`

## На сервере уже OK (не трогать)

```bash
ufw status          # 22/tcp ALLOW
systemctl status ssh
ss -tlnp | grep :22
```
