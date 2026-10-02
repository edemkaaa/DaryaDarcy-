#!/usr/bin/env python3
"""Generate full audit PDF report (Russian, UTF-8)."""
from __future__ import annotations

import os
import re
from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "audits" / "archive" / f"DARYADARCY-AUDIT-REPORT-{date.today().isoformat()}.pdf"
FONT = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts" / "arial.ttf"
FONT_BOLD = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts" / "arialbd.ttf"


def ascii_safe(text: str) -> str:
    """Replace chars that break fpdf2 width calculation."""
    text = text.replace("\u2014", "-").replace("\u2013", "-")
    text = text.replace("\u2192", "->").replace("\u2265", ">=")
    text = text.replace("\u00b7", ".")
    text = text.replace("\u00ab", '"').replace("\u00bb", '"')
    return text


class ReportPDF(FPDF):
    def _reset_x(self):
        self.set_x(self.l_margin)

    def header(self):
        if self.page_no() == 1:
            return
        self._reset_x()
        self.set_font("Arial", "B", 9)
        self.set_text_color(120, 90, 70)
        self.cell(
            self.epw,
            8,
            ascii_safe(f"Daryadarcy - audit report . page {self.page_no()}"),
            align="L",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.set_draw_color(220, 210, 195)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-12)
        self.set_font("Arial", "", 8)
        self.set_text_color(140, 120, 100)
        self.cell(
            0,
            8,
            ascii_safe(
                f"ИП Левина Дарья Сергеевна . daryadarcy.com . {date.today().strftime('%d.%m.%Y')}"
            ),
            align="C",
        )

    def _mc(self, text: str, h: float, style: str = "", size: int = 10, color=(40, 40, 40)):
        self._reset_x()
        self.set_font("Arial", style, size)
        self.set_text_color(*color)
        self.multi_cell(self.epw, h, ascii_safe(text), new_x="LMARGIN", new_y="NEXT")

    def h1(self, text: str):
        self.ln(4)
        self._mc(text, 9, "B", 16, (92, 64, 51))
        self.ln(2)

    def h2(self, text: str):
        self.ln(3)
        self._mc(text, 7, "B", 12, (107, 80, 60))
        self.ln(1)

    def h3(self, text: str):
        self.ln(2)
        self._mc(text, 6, "B", 10, (92, 64, 51))

    def body(self, text: str):
        self._mc(text, 5.5, "", 10)
        self.ln(1)

    def bullet(self, text: str):
        self._mc(f"  -  {text}", 5.5, "", 10)

    def table_row(self, cols: list[str], bold: bool = False, widths: list[float] | None = None):
        self._reset_x()
        if widths is None:
            widths = [52, self.epw - 52]
        self.set_font("Arial", "B" if bold else "", 8)
        self.set_text_color(40, 40, 40)
        for i, (w, c) in enumerate(zip(widths, cols)):
            txt = ascii_safe(c)
            if len(txt) > 120:
                txt = txt[:117] + "..."
            new_x = "LMARGIN" if i == len(cols) - 1 else "RIGHT"
            new_y = "NEXT" if i == len(cols) - 1 else "TOP"
            self.cell(w, 6, txt, border=1, new_x=new_x, new_y=new_y)

    def task_row(self, num: int, task: str, status: str):
        w_num, w_status = 10, 28
        w_task = self.epw - w_num - w_status
        self._reset_x()
        self.set_font("Arial", "", 7)
        self.set_text_color(40, 40, 40)
        y0 = self.get_y()
        self.cell(w_num, 5, str(num), border=1)
        x_task = self.get_x()
        self.multi_cell(w_task, 5, ascii_safe(task), border=1)
        y1 = self.get_y()
        self.set_xy(x_task + w_task, y0)
        st = ascii_safe(status)
        if status.startswith("DONE"):
            self.set_text_color(20, 100, 40)
        elif status.startswith("WAIT"):
            self.set_text_color(140, 90, 20)
        else:
            self.set_text_color(120, 40, 40)
        self.cell(w_status, y1 - y0, st, border=1, align="C")
        self.set_y(y1)
        self.set_text_color(40, 40, 40)


def build(pdf: ReportPDF):
    pdf.add_page()
    pdf.set_font("Arial", "B", 22)
    pdf.set_text_color(92, 64, 51)
    pdf.ln(20)
    pdf.multi_cell(
        pdf.epw,
        12,
        ascii_safe("Daryadarcy App\nПолный технический отчёт\nаудит + FAQ + Роскомнадзор (14 пунктов)"),
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(8)
    pdf.set_font("Arial", "", 11)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(
        pdf.epw,
        6,
        ascii_safe(
            f"Дата: {date.today().strftime('%d.%m.%Y')}\n"
            "Владелец: ИП Левина Дарья Сергеевна\n"
            "Production: https://daryadarcy.com\n"
            "Версия приложения: 1.0.0\n"
            "Контакт для пользователей и Prodamus: daryadarcyapp@yandex.ru\n"
            "Документ не содержит секретов, паролей и персональных данных пользователей."
        ),
        new_x="LMARGIN",
        new_y="NEXT",
    )

    pdf.add_page()
    pdf.h1("1. Резюме")
    pdf.body(
        "Daryadarcy - PWA/мобильное приложение бренда Darya Darcy: лента, видео, клуб по подписке, "
        "библиотека, магазин, интерактив (квиз). Backend на Node.js + tRPC, БД MySQL 8 (Timeweb), "
        "медиа - Timeweb S3, хостинг - VPS Timeweb (Россия)."
    )
    pdf.body(
        "Production online (smoke 02.09.2026: home, feed, api, trpc - 200). "
        "Автотесты: 30/30 (Vitest verify). Миграции 0015-0018 применены на production MySQL. "
        "Сентябрь 2026: boot-видео загрузки, карусель на главной, pen pals v2 (mutual confirm), "
        "блокировка в админке, комментарии с фото, cron retention, SMTP, Woolen, эффект «Тайинственный сад»."
    )

    pdf.h1("2. Окружения и роли")
    pdf.table_row(["Окружение", "URL / назначение"], bold=True)
    pdf.table_row(["Production", "daryadarcy.com - PWA + API"])
    pdf.table_row(["Локально", "localhost:8081 (web), localhost:3000 (API)"])
    pdf.table_row(["Staging", "Не развёрнут"])
    pdf.ln(2)
    pdf.h3("Роли пользователей")
    pdf.bullet("Гость - лента, видео, магазин, часть библиотеки")
    pdf.bullet("Пользователь (users.role=user) - профиль, лайки, вход SMS/email")
    pdf.bullet("Подписчик клуба - club_subscriptions активна - контент клуба, pen pals")
    pdf.bullet("Администратор (role=admin) - CRUD контента, модерация")

    pdf.h1("3. Технологический стек")
    pdf.bullet("Клиент: React Native 0.81, Expo 54, Expo Router, TypeScript")
    pdf.bullet("Web: Expo export (PWA), React Native Web")
    pdf.bullet("API: Node.js, Express, tRPC 11, Zod, superjson")
    pdf.bullet("БД: MySQL 8 utf8mb4, Drizzle ORM")
    pdf.bullet("Файлы: Timeweb S3 (s3.twcstorage.ru)")
    pdf.bullet("Auth: JWT cookie/Bearer, SMS.ru OTP, email+password (scrypt)")
    pdf.bullet("Платежи: Prodamus (клуб, цифровые товары)")
    pdf.bullet("Деплой: nginx + PM2 на VPS Timeweb")

    pdf.h1("4. Персональные данные - поля профиля")
    pdf.table_row(["Поле", "Статус"], bold=True)
    pdf.table_row(["Имя / ник (name)", "Да - одно поле, отдельного псевдонима нет"])
    pdf.table_row(["Телефон", "Да - вход по SMS, уникальный"])
    pdf.table_row(["Email", "Да - вход, оплата, связь"])
    pdf.table_row(["Пол (gender)", "Да - female / male"])
    pdf.table_row(["Аватар", "Да - URL на S3"])
    pdf.table_row(["Дата рождения", "Нет"])
    pdf.table_row(["Город в профиле", "Нет - только в Pen pals (план: ФИО)"])
    pdf.table_row(["Пароль", "Хеш scrypt - только email-вход"])
    pdf.ln(2)
    pdf.h3("Дополнительные данные")
    pdf.bullet("Pen pals: интересы (2-3), почтовый адрес, поле city (план: ФИО)")
    pdf.bullet("Квиз: результат локально (AsyncStorage), не на сервере")
    pdf.bullet("Лайки, сохранения, комментарии - привязка к userId")
    pdf.bullet("Push-токен (Expo) - только native; marketing push - отдельное согласие")

    pdf.h1("5. Авторизация")
    pdf.table_row(["Способ", "Сервис"], bold=True)
    pdf.table_row(["SMS OTP", "SMS.ru (sms.ru/sms/send), код SHA-256, TTL 5 мин"])
    pdf.table_row(["Email + пароль", "Встроенная (/api/auth/register, /login)"])
    pdf.body("Сторонних OAuth (Auth0, Firebase Auth, Яндекс ID) нет.")

    pdf.h1("6. Инфраструктура и размещение данных")
    pdf.body(
        "Важно: компоненты в разных зонах Timeweb. Cloud MSK 50 - это тариф VPS, не зона ЦОД. "
        "Production API - Москва MSK-1 (ru-3). MySQL и S3 - Санкт-Петербург SPB-3 (ru-1)."
    )
    pdf.table_row(["Компонент", "Провайдер / зона / страна"], bold=True)
    pdf.table_row(["Backend API (VPS daryadarcy-main)", "Timeweb Cloud MSK 50, зона MSK-1, Москва, РФ"])
    pdf.table_row(["IP VPS", "200.165.234.36 (ID 8271015)"])
    pdf.table_row(["База данных (Charming Aquila)", "Timeweb MySQL 8.4, зона SPB-3, СПб, РФ"])
    pdf.table_row(["IP MySQL", "77.95.206.157 (ID 4202401)"])
    pdf.table_row(["Изображения (S3 daryadarcy-s3)", "Timeweb S3, ru-1 / SPB-3, endpoint s3.twcstorage.ru"])
    pdf.table_row(["Резервные копии MySQL", "Timeweb: ежедневно 00:15 МСК, 1 копия (панель 31.08.2026)"])
    pdf.table_row(["Резервные копии VPS", "Timeweb: включены; ЦОД хранения - уточнить в поддержке"])
    pdf.ln(1)
    pdf.h3("Адреса ЦОД (Timeweb Cloud, docs timeweb.cloud)")
    pdf.bullet("SPB-3 (MySQL, S3): Dataline, г. Санкт-Петербург, ул. Жукова, д. 43")
    pdf.bullet(
        "MSK-1 (VPS API): по документации Timeweb - IXcellerate, "
        "г. Москва, ул. Подольских Курсантов, 15Б, ст1 "
        "(точное здание для VPS 8271015 - запрос в поддержку Timeweb)"
    )
    pdf.body(
        "Timeweb: ООО ТАЙМВЭБ.КЛАУД, ИНН 7810945525. "
        "На VPS нет локальной копии БД пользователей - только обработка запросов и журналы."
    )

    pdf.h1("7. Аналитика и сторонние SDK")
    pdf.table_row(["Сервис", "Используется"], bold=True)
    pdf.table_row(["Яндекс Метрика", "Нет"])
    pdf.table_row(["Google Analytics", "Нет"])
    pdf.table_row(["Sentry", "Нет"])
    pdf.table_row(["Firebase", "Нет"])
    pdf.table_row(["Expo", "Да - фреймворк, не аналитика"])
    pdf.table_row(["Expo Push", "iOS/Android; web - нет; трансграничная передача (США)"])
    pdf.table_row(["Google Fonts CDN", "Нет - шрифты встроены локально (assets/fonts/)"])
    pdf.table_row(["Локальные шрифты", "Playfair, EB Garamond, Gogol, Woolen (бренд)"])

    pdf.h1("8. Сроки хранения и удаление")
    pdf.bullet("Удаление аккаунта: запрос в профиле; cron processScheduledAccountDeletions - через 30 дней после окончания клуба")
    pdf.bullet("Комментарии: автор отображается как «Удалённый аккаунт»; purge комментариев старше 90 дней (cron)")
    pdf.bullet("Pen pals: purge неподтверждённых матчей, неактивных анкет 30+ дней, данных 90+ дней без клуба")
    pdf.bullet("Данные банковских карт не хранятся - Prodamus")
    pdf.bullet("Marketing push: push_consent_events + consentText (миграция 0018)")
    pdf.bullet("user_consent_events: consentText (миграция 0017) - SMS, pen pals, push")

    pdf.h1("9. Безопасность и доступ специалистов")
    pdf.bullet("Журнал admin_audit_log: block/unblock пользователей (реализован)")
    pdf.bullet("2FA admin/moderator: TOTP при входе, если задан ADMIN_TOTP_SECRET в .env")
    pdf.bullet("Роли: user / moderator / admin; blockedAt блокирует API")
    pdf.bullet("MySQL backup из приложения: mysqldump -> S3, раз в 24 ч (server/_core/backup.ts)")
    pdf.bullet("Timeweb: физические бэкапы MySQL + VPS (панель)")
    pdf.bullet("SMTP: daryadarcyapp@yandex.ru (Yandex), SMTP_PASS на VPS")

    pdf.h1("10. Почтовое отделение (Pen Pals)")
    pdf.body("Раздел для подписчиков клуба - подбор друга по переписке.")
    pdf.h3("Реализовано (02.09.2026)")
    pdf.bullet("18+ checkbox, отдельное согласие, журнал user_consent_events")
    pdf.bullet("Поле ФИО (fullName), не «Город»")
    pdf.bullet("Подбор по интересам без раскрытия адреса до mutual confirm (7 дней)")
    pdf.bullet("Взаимное подтверждение обоих участников; отзыв анкеты")
    pdf.bullet("Cron: purge stale pen pal data")

    pdf.h1("11. Цифровые товары (магазин)")
    pdf.bullet("Товары: digital-1 (пособие по фото), digital-2 (мастер-класс)")
    pdf.bullet("Оплата: Prodamus; email daryadarcyapp@yandex.ru на экранах магазина и в письме")
    pdf.bullet("Автоотправка: server/shop-delivery.ts, очередь shop_delivery_emails, retry каждые 5 мин")
    pdf.bullet("Сервисный push после успешной доставки (native)")
    pdf.bullet("SLA в письме: «если не пришло за 15 минут - напишите на email»")

    pdf.h1("12. Юридические документы")
    pdf.bullet("Хаб /legal: оферта, политика ПД, согласие на ПД, пользовательское соглашение")
    pdf.bullet("Оплата/отмена/возврат, cookie, реквизиты (shared/legal-documents.ts)")
    pdf.bullet("Email везде: daryadarcyapp@yandex.ru")
    pdf.bullet("Частично: реквизиты - ИП + email; полные банковские реквизиты - от Дарьи")

    pdf.h1("13. Оптимизация производительности (август 2026)")
    pdf.bullet("S3: 145 файлов оптимизировано, ~192 МБ экономии")
    pdf.bullet("Бумажная текстура: 5.7 МБ -> 230 КБ")
    pdf.bullet("Локальный бандл: PNG->WebP, JPG пересжатие (~120->~35 МБ assets)")
    pdf.bullet("Скрипты: npm run optimize:s3, npm run optimize:assets")

    pdf.h1("14. API (кратко)")
    pdf.body("tRPC: https://daryadarcy.com/api/trpc/ - auth, profile, feed, videos, club, admin, articles, shop, penPals, notifications.")
    pdf.body("Health: GET /api/health. REST: /api/auth/*, /api/prodamus/*, /api/pay/:id")

    pdf.h1("15. База данных (таблицы без PII)")
    pdf.body("users, posts, post_media, tags, likes, saved_posts, videos, articles, club_subscriptions, club_payments, shop_purchases, post_comments, pen_pal_profiles, pen_pal_shown, push_tokens, push_consent_events, sms_codes.")
    pdf.body("Схема: drizzle/schema.ts, миграции drizzle/*.sql")

    pdf.h1("16. Интеграции")
    pdf.bullet("Timeweb MySQL, S3, VPS")
    pdf.bullet("SMS.ru - OTP")
    pdf.bullet("Prodamus - платежи")
    pdf.bullet("YouTube - превью видео")
    pdf.bullet("Expo Push - native уведомления")

    pdf.h1("17. Автотесты")
    pdf.bullet("__tests__/regression.test.ts - 18 тестов UI")
    pdf.bullet("__tests__/quiz-data.test.ts - 12 тестов")
    pdf.bullet("npm run verify - 30 тестов перед деплоем")

    pdf.h1("18. Известные ограничения")
    pdf.bullet("Нет staging-домена")
    pdf.bullet("Нет E2E (Playwright/Detox)")
    pdf.bullet("Email-регистрация без checkbox согласия на ПД")
    pdf.bullet("anonymizeUserComments - stub (имя «Удалённый аккаунт» через users, текст комментария не меняется)")
    pdf.bullet("4 club-поста без видеофайла - нужен re-import")
    pdf.bullet("ADMIN_TOTP_SECRET не задан - 2FA выключена до настройки")
    pdf.bullet("Promo-карусель - временные обложки, ждут финальные от Дарьи")
    pdf.bullet("10 устаревших тестов screens.test.ts")

    pdf.h1("19. Правила аудита на production")
    pdf.h3("Разрешено")
    pdf.bullet("Просмотр публичных разделов, UI/UX, responsive")
    pdf.bullet("Тестовые аккаунты (не owner admin)")
    pdf.bullet("npm run smoke")
    pdf.h3("Запрещено")
    pdf.bullet("Редактирование реальных постов без согласования")
    pdf.bullet("Нагрузочное тестирование, реальные платежи")
    pdf.bullet("Доступ к .env, SSH, БД, S3-ключам")
    pdf.bullet("Экспорт персональных данных")

    pdf.h1("20. Комплект поставки")
    pdf.bullet("Архив исходников: daryadarcy_app_backup_YYYY-MM-DD.zip (~230 МБ)")
    pdf.bullet("docs/ - AUDIT-PACKAGE, API, DATABASE-SCHEMA, INTEGRATIONS, KNOWN-ISSUES")
    pdf.bullet("README.md, .env.example")
    pdf.bullet("Не входит: .env, пароли, PII, полные server logs")
    pdf.bullet("Тестовые аккаунты и NDA - отдельно")

    pdf.h1("21. Push-уведомления (сервисные и рекламные)")
    pdf.table_row(["Тип", "Примеры / согласие"], bold=True)
    pdf.table_row(["Сервисные", "Оплата, подписка - без marketing opt-in"])
    pdf.table_row(["Рекламные", "Новые посты, акции - только после явного согласия"])
    pdf.body(
        "В профиле (native): переключатель «Получать новости, новые публикации, акции». "
        "По умолчанию выключен. Backend: notifications.marketingConsent, "
        "setMarketingConsent, sendMarketingPostNotification фильтрует по согласию."
    )
    pdf.body(
        "Трансграничная передача: Backend (РФ) -> Expo Push API (США) -> APNS/FCM. "
        "В push не передаются ФИО, адреса, платёжные данные - только заголовок и превью."
    )
    pdf.bullet("Журнал: push_consent_events (userId, type, status, version, platform, date)")
    pdf.bullet("Admin: purgeUserPushData при удалении аккаунта")
    pdf.bullet("Документация: docs/architecture/push.md")

    pdf.h1("22. Список задач по приложению (22 пункта)")
    pdf.body(
        "Источник: «Задачи по приложению daryadarcy». "
        "Статус на 02.09.2026. DONE = реализовано; PARTIAL = частично; WAIT = нужны материалы/решение."
    )
    pdf.ln(1)
    tasks = [
        (1, "Загрузка: boot-видео, спиннер, Retry, WebP-сжатие", "DONE 02.09"),
        (2, "Email daryadarcyapp@yandex.ru везде для связи", "DONE 02.09"),
        (3, "Prodamus: зарубежные карты, 6 мес = 4740 руб, 180 дней клуба", "DONE"),
        (4, "Блокировка нарушителей в клубе (API + админка)", "DONE 02.09"),
        (5, "Юр. раздел: оферта, ПД, cookie, реквизиты", "PARTIAL реквизиты"),
        (6, "Push: сервисные / рекламные с opt-in", "DONE"),
        (7, "Pen pals: 18+, mutual confirm, FIO, purge", "DONE 02.09"),
        (8, "Профиль: подписка, отмена автопродления, возврат", "DONE"),
        (9, "Удаление аккаунта 30 дней, обезличить комментарии", "PARTIAL cron"),
        (10, "Комментарии среды: 48 ч, 2 фото, ссылки, replies", "DONE 02.09"),
        (11, "Модерация: delete, report, moderator, block", "DONE"),
        (12, "Безопасность: роли, 2FA, audit log, бэкапы", "PARTIAL 2FA secret"),
        (13, "Согласия: checkbox, версия, полный текст", "PARTIAL email-reg"),
        (14, "Автоотправка пособия/МК на email за 15 мин", "PARTIAL SMTP"),
        (15, "Клуб: оригинальная ориентация постов", "DONE"),
        (16, "Качество обложек видео в клубе", "WAIT исходники"),
        (17, "Rich text / ссылки", "DONE"),
        (18, "Шрифт DARYADARCY -> Woolen", "DONE"),
        (19, "Главная: карусель promo", "PARTIAL обложки"),
        (20, "Видео: шиповники как на Интерактив", "DONE"),
        (21, "Видео: жирные названия", "DONE"),
        (22, "Эффект «Таинственный сад» + кнопка слева", "DONE 02.09"),
    ]
    for num, task, status in tasks:
        pdf.task_row(num, task, status)
    pdf.ln(2)
    pdf.body("Итого: ~14 выполнено, ~8 частично, 0 не начато.")

    pdf.h1("23. Сведения для Роскомнадзора (кратко)")
    pdf.h3("Оператор")
    pdf.body("ИП Левина Дарья Сергеевна. Сайт: https://daryadarcy.com")
    pdf.h3("Инфраструктура Timeweb (данные из панели, 31.08.2026)")
    pdf.table_row(["Сервис", "Параметры"], bold=True)
    pdf.table_row(["MySQL Charming Aquila", "ID 4202401, IP 77.95.206.157, MySQL 8.4"])
    pdf.table_row(["Зона MySQL / S3", "ru-1 = SPB-3, Санкт-Петербург"])
    pdf.table_row(["Адрес ЦОД SPB-3", "Dataline, ул. Жукова, д. 43, СПб"])
    pdf.table_row(["S3 daryadarcy-s3", "ID 513637, регион ru-1, endpoint s3.twcstorage.ru"])
    pdf.table_row(["VPS daryadarcy-main", "ID 8271015, IP 200.165.234.36, тариф Cloud MSK 50, зона MSK-1 (Москва)"])
    pdf.ln(1)
    pdf.h3("Даты начала (история Timeweb)")
    pdf.bullet("S3 daryadarcy-s3: 5 июня 2026")
    pdf.bullet("VPS daryadarcy-main (Ubuntu 24.04): 5 июня 2026")
    pdf.bullet("MySQL Charming Aquila: 24 августа 2026")
    pdf.bullet("Для заявления: начало обработки ПДн - не ранее 5 июня 2026 (инфраструктура); уточнить дату первых пользователей")
    pdf.h3("Резервные копии")
    pdf.bullet("MySQL: физические бэкапы включены, ежедневно с 00:15 МСК, хранится 1 копия (с 24.08.2026)")
    pdf.bullet("MySQL: логические бэкапы выключены")
    pdf.bullet("VPS: автобэкапы диска включены (последний: 31.08.2026 13:00); регион хранения - запрос Timeweb")
    pdf.bullet("nginx logs: logrotate daily, rotate 14 (14 суток), compress - проверено на VPS 02.09.2026")
    pdf.bullet(
        "PM2 logs: pm2-logrotate установлен 15.09.2026 (max_size 10M, retain 14, compress, rotate 00:00 UTC)"
    )
    pdf.bullet(
        "App MySQL backup: mysqldump -> gzip -> S3 backups/mysql/ ежедневно (последний 15.09.2026, ~479 KB)"
    )
    pdf.h3("Обработчики / инфраструктура")
    pdf.table_row(["Контрагент", "ИНН / роль"], bold=True)
    pdf.table_row(["ООО ТАЙМВЭБ.КЛАУД", "7810945525 - VPS, MySQL, S3, РФ"])
    pdf.table_row(["ООО СМС.РУ", "7713461582 - OTP SMS, РФ"])
    pdf.table_row(["ООО Продамус", "1215156909 - платежи, РФ"])
    pdf.table_row(["Expo / Apple APNS / Google FCM", "push-токены, текст push, США"])
    pdf.table_row(["Google (YouTube CDN)", "превью видео, США"])
    pdf.ln(1)
    pdf.h3("Категории персональных данных")
    pdf.bullet("Профиль: имя, email, телефон, пол, аватар, хеш пароля -> MySQL users")
    pdf.bullet("SMS OTP: телефон, хеш кода -> sms_codes (TTL 5 мин)")
    pdf.bullet("Подписка/оплата: orderId, email, сумма -> club_payments, club_subscriptions")
    pdf.bullet("Магазин: orderId, email, productId -> shop_purchases")
    pdf.bullet("Pen pals (опционально): интересы, город, почтовый адрес -> pen_pal_profiles")
    pdf.bullet("Push: Expo token, platform; marketing consent -> push_tokens, push_consent_events")
    pdf.bullet("Не храним: банковские карты (Prodamus), дату рождения, результат квиза (локально)")
    pdf.h3("Трансграничная передача")
    pdf.body(
        "Да: native push через Expo/APNS/FCM (США); превью YouTube (США). "
        "Цель: доставка уведомлений и отображение превью. "
        "Полная карта: docs/compliance/data-map.md"
    )
    pdf.h3("Чеклист перед подачей (для ИП)")
    pdf.bullet("Реквизиты ИП и дата начала сбора ПДн")
    pdf.bullet("Скрин Timeweb: зона MySQL/S3 и параметры бэкапов")
    pdf.bullet("Обновить политику конфиденциальности (push, Timeweb, трансграничная передача)")
    pdf.bullet("NDA с техническим специалистом (организационно)")

    pdf.h1("24. Шрифт Woolen (бренд)")
    pdf.bullet("Лицензия: куплена для сайтов; EULA в assets/fonts/Woolen-EULA.txt")
    pdf.bullet("Файлы: Woolen-Regular.ttf (app), .woff / .woff2 (web)")
    pdf.bullet("Применение: надпись DARYADARCY на главной, login, privacy, site")
    pdf.bullet("Извлечение: npm run extract:woolen (из Woolen.zip)")
    pdf.bullet("Google Fonts CDN не используется - все шрифты локально")

    pdf.h1("25. Ответы на вопросы (31.08.2026)")
    pdf.body("Краткие ответы для ИП и заявления в Роскомнадзор.")

    pdf.h2("Регистрация и аккаунт без клуба")
    pdf.body(
        "Отдельная бесплатная регистрация ради регистрации не обязательна. "
        "Основной путь в клуб: оплата -> запись в базе -> вход."
    )
    pdf.bullet("Без входа: лента, видео, магазин, часть библиотеки - как гость")
    pdf.bullet("Клуб - только после оплаты; при оплате указывается email или аккаунт")
    pdf.bullet("Вход: SMS (телефон) или email + пароль")
    pdf.bullet("Полный личный кабинет DARCY (профиль, сохраненное, клуб) - только для участниц клуба")
    pdf.body(
        "Итого: основные пользователи клуба - оплатившие и авторизовавшиеся; "
        "гостевой просмотр без регистрации тоже есть."
    )

    pdf.h2("Подписка 6 мес. / 4740 руб. (зарубежные карты)")
    pdf.body(
        "В коде: ровно 180 календарных дней с даты оплаты "
        "(или с конца текущего доступа, если подписка уже была). "
        "Это не 6 календарных месяцев (напр. 15 января -> 15 июля)."
    )
    pdf.body(
        "В тексте оплаты написано «6 месяцев», в системе считается 180 дней. "
        "Для документов рекомендуется: «180 дней (6 месяцев) с даты оплаты»."
    )

    pdf.h2("Push-уведомления")
    pdf.bullet("Web/PWA: push сейчас нет - ни технически, ни в интерфейсе")
    pdf.bullet("Переключатель согласия на рекламные push - только native iOS/Android")
    pdf.bullet("На сайте переключатель не показываем до запуска push в PWA")
    pdf.bullet("Backend-логика согласия готова про запас; для web не активируем")
    pdf.body("Для РКН: Expo Push в web/PWA сейчас не используется.")

    pdf.h2("Роскомнадзор - дополнения")
    pdf.h3("1. ЦОД MySQL, S3 и бэкапов")
    pdf.body(
        "MySQL (Charming Aquila, 4202401) и S3 (daryadarcy-s3): зона ru-1 / SPB-3, "
        "Санкт-Петербург, Dataline, ул. Жукова, д. 43. "
        "VPS API (daryadarcy-main): Cloud MSK 50, Москва (ПД хранятся в MySQL SPB, не на диске VPS). "
        "Бэкапы MySQL: ежедневно, 1 копия. Бэкапы VPS: включены."
    )
    pdf.h3("2. Срок логов, бэкапов, дата начала обработки")
    pdf.bullet("Бэкапы MySQL: ежедневно с 00:15 МСК, хранится 1 копия")
    pdf.bullet("Бэкапы VPS: автоматические, на диске сервера")
    pdf.bullet("Логи PM2/nginx: срок ротации - уточнить на VPS")
    pdf.bullet("Инфраструктура с 5.06.2026 (S3/VPS), MySQL с 24.08.2026")
    pdf.bullet("Дата первых пользователей с ПДн - указывает ИП")
    pdf.h3("3. Expo Push в web/PWA")
    pdf.body("Нет, не используется. Только для будущих native-сборок iOS/Android.")
    pdf.h3("4. Запросы к YouTube/Google до действия пользователя")
    pdf.table_row(["Что", "Когда"], bold=True)
    pdf.table_row(["Превью видео (обложки)", "Да - вкладка Видео; proxy -> i.ytimg.com; без ФИО/email"])
    pdf.table_row(["Само видео", "Нет - только по нажатию play"])
    pdf.table_row(["Переход на youtube.com", "Только если пользователь сам нажал ссылку"])
    pdf.table_row(["Google Fonts", "Нет - шрифты локально на сервере"])
    pdf.h3("5. Меры защиты - уже внедрено")
    pdf.bullet("HTTPS (TLS), пароли scrypt, SMS-коды SHA-256 TTL 5 мин")
    pdf.bullet("JWT-сессии, роли user/admin, проверка подписи Prodamus webhook")
    pdf.bullet("Рекламные push - только после согласия + журнал push_consent_events")
    pdf.bullet("Банковские карты не храним (Prodamus), политика конфиденциальности в app")
    pdf.h3("Не внедрено (указать в заявлении честно)")
    pdf.bullet("Автоудаление аккаунтов по таймеру (30 дней после отмены подписки - в политике, автоматизация частичная)")
    pdf.bullet("Native push (EAS/APNs/FCM) - до настройки credentials")
    pdf.body("Полные ответы на 14 вопросов для уведомления РКН - раздел 27.")

    pdf.h1("27. Уведомление Роскомнадзора - ответы (14 пунктов)")
    pdf.body(
        "Только подтвержденные данные: код, nginx-конфиг, панель Timeweb 31.08.2026. "
        "Без предположений там, где указано «уточнить»."
    )

    pdf.h2("1. Адрес ЦОД MySQL и S3 (ФИAS)")
    pdf.body(
        "MySQL Charming Aquila ID 4202401, IP 77.95.206.157. S3 daryadarcy-s3 ID 513637, регион ru-1. "
        "Зона ru-1 = SPB-3 (таблица Timeweb Cloud). Площадка SPB-3: Dataline, "
        "г. Санкт-Петербург, ул. Жукова, д. 43. "
        "Для формы: адрес в формате ФИAS - подобрать код на fias.nalog.ru по этому адресу "
        "(в коде приложения кода ФИAS нет)."
    )

    pdf.h2("2. Московский VPS и персональные данные")
    pdf.body(
        "VPS daryadarcy-main, IP 200.165.234.36, Cloud MSK 50 (Москва). "
        "Основная БД ПДн - MySQL в Санкт-Петербурге, не на диске VPS. "
        "На VPS: журналы nginx/PM2, временная обработка запросов. Локальной копии БД пользователей нет. "
        "В уведомлении: БД - СПб; VPS - место обработки и хранения технических журналов, не основная база ПДн."
    )

    pdf.h2("3. Адрес московского ЦОД (MSK-1, VPS API)")
    pdf.body(
        "VPS daryadarcy-main: тариф Cloud MSK 50, зона доступности MSK-1 (Terraform ru-3), Москва. "
        "Cloud MSK 50 - название тарифа (2 CPU, 2 GB RAM, 50 GB NVMe), не отдельный ЦОД."
    )
    pdf.body(
        "По официальной документации Timeweb Cloud (timeweb.cloud/docs/nashi-data-centry): "
        "облачные серверы в Москве размещаются в MSK-1, адреса площадок включают "
        "IXcellerate, ул. Подольских Курсантов, 15Б, ст1, Москва. "
        "Для уведомления РКН: указать этот адрес с пометкой «по данным Timeweb Cloud» "
        "ИЛИ получить письменное подтверждение от поддержки для VPS ID 8271015."
    )

    pdf.h2("4. ПДн в журналах PM2/nginx")
    pdf.bullet("Да: IP-адрес, URL запроса, User-Agent, метод, код ответа, время")
    pdf.bullet("Нет намеренно: телефон, email, ФИО, пароли, SMS-коды, содержимое JWT")
    pdf.bullet("PM2: возможны orderId/userId в отладочных строках webhook Prodamus - не полные ПДн")

    pdf.h2("5. Срок хранения и ротация журналов PM2/nginx")
    pdf.body(
        "Проверено на VPS daryadarcy-main (Ubuntu 24.04, hostname daryadarcy-main):"
    )
    pdf.bullet("nginx (/var/log/nginx/*.log): logrotate daily, rotate 14, compress, delaycompress - хранение ~14 суток")
    pdf.bullet(
        "PM2 (/root/.pm2/logs/daryadarcy-api-*.log): pm2-logrotate 3.0.0, max_size 10M, retain 14, "
        "compress true, rotateInterval 0 0 * * * (настроено 15.09.2026)"
    )

    pdf.h2("6. Резервные копии VPS")
    pdf.body(
        "Из панели Timeweb: автобэкапы диска VPS включены, последняя копия 31.08.2026 13:00. "
        "Не подтверждено из панели: физический ЦОД хранения бэкапов, число копий, срок удаления. "
        "Ожидаемо: РФ, инфраструктура Timeweb - уточнить в поддержке или скрином раздела Бэкапы VPS."
    )

    pdf.h2("7. MySQL backup - подтверждение")
    pdf.body(
        "Timeweb MySQL (физические): включены, ежедневно с 00:15 МСК, хранится 1 копия "
        "(кластер 4202401, панель 31.08.2026)."
    )
    pdf.body(
        "Приложение (логические): server/_core/backup.ts - mysqldump --single-transaction, gzip; "
        "не чаще 1 раза в 24 ч (проверка каждые 6 ч); локально /var/www/daryadarcy/backups/; "
        "копия в S3 daryadarcy-s3/backups/mysql/. Последний успешный upload: 15.09.2026 07:07 UTC, ~479 KB."
    )

    pdf.h2("8. Шифрование HTTPS/TLS - поля формы РКН")
    pdf.bullet("Сертификат: Let's Encrypt (/etc/letsencrypt/live/daryadarcy.com/)")
    pdf.bullet("Протоколы: TLS 1.2, TLS 1.3 (nginx deploy/nginx-daryadarcy.conf)")
    pdf.bullet("Реализация: nginx 1.24.0 + OpenSSL 3.0.13 (Ubuntu 24.04, проверено 02.09.2026)")
    pdf.bullet("Сертифицированные СКЗИ (ГОСТ, КриптоПро): в ИСПДн daryadarcy.com не используются")
    pdf.ln(1)
    pdf.h3("Как заполнить раздел «Шифровальные (криптографические) средства»")
    pdf.body(
        "Раздел формы pd.rkn.gov.ru - отдельный блок «Использование шифровальных (криптографических) средств». "
        "Для daryadarcy.com (HTTPS без ГОСТ-СКЗИ):"
    )
    pdf.bullet("Используются: да (TLS для HTTPS сайта и API)")
    pdf.bullet("Наименование: OpenSSL 3.0.13 + nginx TLS 1.2/1.3 + сертификат Let's Encrypt (ISRG Root X1)")
    pdf.bullet("Изготовитель OpenSSL: OpenSSL Project; сертификат: Let's Encrypt / ISRG")
    pdf.bullet("Класс СКЗИ по приказу ФСБ: не применяется (не сертифицированные СКЗИ; TLS для транспорта)")
    pdf.bullet("ЭЦП для подачи уведомления (КриптоПро на ПК ИП): указывать отдельно, если используется только для подписи формы, не в приложении")
    pdf.body(
        "Скриншот выпадающих вариантов поля - см. docs/compliance/crypto-form-guide.md "
        "(сделать при заполнении формы на pd.rkn.gov.ru под учётной записью ИП)."
    )

    pdf.h2("9. YouTube - встроенный плеер или внешняя ссылка")
    pdf.bullet("В приложении: HTML5 video, src=/api/yt/{id} - proxy через backend, не iframe YouTube")
    pdf.bullet("Кнопка «Смотреть на YouTube» - внешняя ссылка только по нажатию пользователя")
    pdf.bullet("Если videoUrl на S3 - воспроизведение с Timeweb S3 без YouTube")

    pdf.h2("10. Загрузка ресурсов YouTube/Google до действия пользователя")
    pdf.table_row(["Сценарий", "До действия пользователя"], bold=True)
    pdf.table_row(["Список видео (превью)", "Да - /media/yt-thumb/ -> i.ytimg.com; ID ролика; cookie Google отбрасываются"])
    pdf.table_row(["iframe/скрипты/cookie Google на странице", "Нет"])
    pdf.table_row(["Google Fonts CDN", "Нет - шрифты локально"])
    pdf.table_row(["Страница ролика", "Запрос /api/yt при открытии страницы ролика"])
    pdf.body(
        "При воспроизведении: IP и User-Agent браузера; email/телефон/userId DARYADARCY в YouTube не передаются."
    )

    pdf.h2("11. Передает ли backend данные пользователя в YouTube/Google")
    pdf.body(
        "При /api/yt/{id}: yt-dlp запрашивает youtube.com/watch?v={id}. "
        "Email, телефон, userId, имя не передаются. User-Agent и IP VPS (200.165.234.36). "
        "Превью: nginx -> i.ytimg.com, только ID ролика. "
        "Переход на youtube.com - из браузера пользователя, backend не участвует."
    )

    pdf.h2("12. Push в web/PWA")
    pdf.body(
        "Подтверждаем: Expo Push, APNs, FCM в web/PWA не используются. "
        "Push-тokens не собираются и не хранятся (registerNativePush только при Platform.OS != web). "
        "UI согласия на push в профиле на web скрыт."
    )

    pdf.h2("13. Google Fonts, Analytics, Metrika, Firebase, Sentry")
    pdf.body(
        "Подтверждаем - не используются в production web/PWA: "
        "Google Fonts CDN, Google Analytics, Яндекс.Метрика, Firebase Analytics, Sentry. "
        "Шрифты - локально в assets/fonts. @expo-google-fonts - npm-пакет с локальными файлами."
    )

    pdf.h2("14. Меры защиты - фактически работают")
    pdf.table_row(["Мера", "Статус"], bold=True)
    pdf.table_row(["HTTPS/TLS Let's Encrypt", "работает"])
    pdf.table_row(["Пароли scrypt", "работает"])
    pdf.table_row(["SMS SHA-256, TTL 5 мин", "работает"])
    pdf.table_row(["JWT-сессии (jose)", "работает"])
    pdf.table_row(["Подпись webhook Prodamus", "работает"])
    pdf.table_row(["Роли user/moderator/admin + block", "работает"])
    pdf.table_row(["admin_audit_log", "работает"])
    pdf.table_row(["2FA TOTP admin", "код готов, нужен ADMIN_TOTP_SECRET"])
    pdf.table_row(["Бэкап MySQL ежедневно", "работает (Timeweb)"])
    pdf.table_row(["Бэкап MySQL app->S3", "работает (cron 24ч)"])
    pdf.table_row(["Бэкап VPS", "включен (Timeweb)"])
    pdf.table_row(["SMTP Yandex shop delivery", "настроен на VPS"])
    pdf.ln(1)
    pdf.body("Частично: anonymize комментариев - stub.")

    pdf.h2("Чеклист перед подачей (осталось у ИП / Timeweb)")
    pdf.bullet("Код ФIAS для ул. Жукова, д. 43, СПб - fias.nalog.ru")
    pdf.bullet("Письменное подтверждение Timeweb: адрес ЦОД для VPS 8271015 (MSK-1) - см. docs/compliance/timeweb-requests.md")
    pdf.bullet("Параметры бэкапов VPS: число копий, регион/ЦОД хранения - скрин + запрос Timeweb")
    pdf.bullet("Скрин поля «криптографические средства» на pd.rkn.gov.ru - см. docs/compliance/crypto-form-guide.md")
    pdf.bullet("Дата начала обработки ПДн пользователями - указывает ИП")

    pdf.h1("29. Обновление для РКН (15.09.2026)")
    pdf.body(
        "Сводка по запросу ИП для подготовки уведомления в Роскомнадзор и текущий статус продукта."
    )

    pdf.h2("29.1. Ротация логов PM2")
    pdf.bullet("Статус: выполнено 15.09.2026 на VPS daryadarcy-main (200.165.234.36)")
    pdf.bullet("Модуль: pm2-logrotate 3.0.0 (pm2 install pm2-logrotate)")
    pdf.bullet("Параметры: max_size 10M, retain 14 файлов, compress true, rotateInterval 0 0 * * *")
    pdf.bullet("nginx: без изменений - logrotate daily, rotate 14, compress (~14 суток)")

    pdf.h2("29.2. Согласие на обработку ПД при регистрации по email")
    pdf.bullet("Статус: реализовано (app/login.tsx, mode=register)")
    pdf.bullet("Отдельный чекбокс с текстом из shared/consent-texts.ts (EMAIL_REGISTER_CONSENT_LABEL)")
    pdf.bullet("Без галочки кнопка «Создать аккаунт» неактивна; backend требует consentVersion")
    pdf.bullet("Согласие логируется в БД (logUserConsent, consentKey email_register)")
    pdf.bullet("SMS-вход: отдельный чекбокс (SmsCodeForm, SMS_LOGIN_CONSENT_LABEL)")
    pdf.bullet("Для заявления: скрин экрана /login -> Регистрация с отмеченным чекбоксом")

    pdf.h2("29.3. Поле СКЗИ в форме pd.rkn.gov.ru")
    pdf.body(
        "Отдельной опции «класс СКЗИ не применяется» в форме обычно нет. "
        "Блок «Использование шифровальных (криптографических) средств»: сначала «используются» / «не используются»; "
        "при «используются» - наименование, изготовитель, класс КСЗИ (КС1/КС2/КС3 или «иное»)."
    )
    pdf.body(
        "Для daryadarcy.com: HTTPS через OpenSSL 3.0.13 + nginx TLS 1.2/1.3 + Let's Encrypt - "
        "не сертифицированные СКЗИ ФСБ. Рекомендация: «Используются» = да; "
        "класс - «Не применяется» в текстовом поле или «иное» + пояснение про TLS."
    )
    pdf.bullet("Подробно: docs/compliance/crypto-form-guide.md")
    pdf.bullet("Скрин выпадающего списка - сделать ИП при заполнении формы (pd.rkn.gov.ru)")

    pdf.h2("29.4. Параметры резервного копирования (для формы)")
    pdf.table_row(["Уровень", "Что / как / где"], bold=True)
    pdf.table_row(
        [
            "Timeweb MySQL",
            "Физические бэкапы, ежедневно 00:15 МСК, 1 копия; кластер 4202401, SPB-3",
        ]
    )
    pdf.table_row(
        [
            "Timeweb VPS",
            "Автобэкапы диска включены (параметры retention/ЦОД - скрин панели + запрос в поддержку)",
        ]
    )
    pdf.table_row(
        [
            "Приложение",
            "mysqldump -> .sql.gz -> /var/www/daryadarcy/backups/ + S3 backups/mysql/",
        ]
    )
    pdf.table_row(["Расписание app", "Не чаще 1 раза в 24 ч; проверка каждые 6 ч при работе API"])
    pdf.table_row(["Локально на VPS", "/var/www/daryadarcy/backups/*.sql.gz - хранение 14 суток, автоудаление"])
    pdf.table_row(["S3", "backups/mysql/*.sql.gz - хранение 90 суток, автоудаление"])
    pdf.table_row(["Последний S3 backup", "15.09.2026, daryadarcy-2026-09-15T07-07-16-869Z.sql.gz, ~479 KB"])
    pdf.table_row(["S3 бакет", "daryadarcy-s3, endpoint s3.twcstorage.ru, регион ru-1 (SPB-3)"])
    pdf.body(
        "Timeweb: физический адрес ЦОД VPS MSK-1 и параметры автобэкапов диска VPS - "
        "запрос в поддержку + скрин панели (docs/compliance/timeweb-requests.md). "
        "Локальные .sql.gz на VPS MSK-1 - копии ПДн на диске API-сервера; срок 14 суток."
    )

    pdf.h2("29.5. Аккаунт после окончания Клуба")
    pdf.bullet(
        "Модель: после окончания подписки аккаунт сохраняется (бесплатный режим, без доступа к закрытым материалам)"
    )
    pdf.bullet(
        "Автоудаление аккаунта при отмене подписки НЕ выполняется - только по явному запросу пользователя"
    )
    pdf.bullet(
        "processScheduledAccountDeletions: удаление/обезличивание только если accountDeletionRequestedAt установлен; "
        "не ранее 30 дней после окончания оплаченного периода Клуба"
    )
    pdf.bullet("Тексты: privacy.tsx, legal personal-data, диалог удаления в profile - согласованы 15.09.2026")

    pdf.h2("29.6. Продукт - критичное после запуска (не РКН)")

    pdf.table_row(["Приоритет", "Задача", "Срок", "Статус"], bold=True, widths=[18, 62, 22, 38])
    pdf.table_row(["P0", "EAS + push credentials + тест на устройстве", "0.5-1 д", "Не начато"])
    pdf.table_row(["P1", "Native boot lock (expo-video)", "1-2 d", "На native отключен"])
    pdf.table_row(["P2", "Push по подписке / web push", "0.5-1 d", "Частично"])

    pdf.h2("29.7. Недавние исправления (15.09.2026)")
    pdf.bullet("Web deploy: курсив постов EB Garamond Italic; лицензия на музыку без ПД композитора")
    pdf.bullet("Club music: Darcy's Autumn (лицензия в юр. документах, без скана с паспортными данными)")
    pdf.bullet("Prodamus: исправлена привязка subscription ID при CLUB_PRICE=790 (требует deploy API)")
    pdf.bullet("Backup retention: local 14 d, S3 90 d (server/_core/backup.ts)")
    pdf.bullet("Политика ПД: аккаунт после Клуба сохраняется; удаление только по запросу")

    pdf.h1("30. Контакты")
    pdf.body("Владелец / оператор: ИП Левина Дарья Сергеевна")
    pdf.body("Email для пользователей и Prodamus: daryadarcyapp@yandex.ru")
    pdf.body("Сайт: https://daryadarcy.com")
    pdf.body("Технические вопросы аудита - к разработчику проекта.")
    pdf.body("Полный комплект markdown: docs/audits/package.md, ROSKOMNADZOR-DATA-MAP.md, PUSH-NOTIFICATIONS.md")


def main():
    if not FONT.exists():
        raise SystemExit(f"Font not found: {FONT}")
    pdf = ReportPDF()
    pdf.set_margins(12, 12, 12)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_font("Arial", "", str(FONT))
    pdf.add_font("Arial", "B", str(FONT_BOLD if FONT_BOLD.exists() else FONT))
    build(pdf)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    downloads = Path.home() / "Downloads" / OUT.name
    pdf.output(str(downloads))
    print(f"Created: {OUT}")
    print(f"Copied:  {downloads}")


if __name__ == "__main__":
    main()
