"use client";
import { StatusNotice, StatusNoticeAction } from "@/shared/ui/status-notice";

const labels: Record<string, string> = {
  text: "Текст",
  title: "Название",
  photos: "Фотографии",
  videos: "Видео",
  tags: "Теги",
  target: "Размещение",
  status: "Статус",
  published: "Опубликовано",
  sortOrder: "Порядок",
  scheduledAt: "Запланировано на",
  publishedAt: "Дата публикации",
  richText: "Форматирование",
  coverUrl: "Обложка",
  access: "Доступ",
  sections: "Блоки статьи",
  attachments: "Вложения",
  removedMediaIds: "Удаляемые вложения",
};
function display(value: unknown, key?: string): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const names: Record<string, string> = {
      published: "Опубликовано",
      draft: "Черновик",
      scheduled: "Запланировано",
      feed: "Лента",
      club: "Клуб",
      both: "Лента и клуб",
      public: "Без подписки",
    };
    return key && ["status", "target", "access"].includes(key)
      ? (names[value] ?? value)
      : value;
  }
  if (Array.isArray(value))
    return value.map((item) => display(item)).join("\n") || "—";
  if (typeof value === "object") {
    const item = value as Record<string, unknown>;
    if (Array.isArray(item.children)) return display(item.children);
    return (
      [
        item.filename ?? item.name,
        item.text,
        item.label,
        item.caption,
        item.url,
        item.urls,
      ]
        .filter((part) => part !== undefined && part !== null && part !== "")
        .map((part) => display(part))
        .join("\n") || "Без текста"
    );
  }
  return String(value);
}
export function EditComparison({
  current,
  server,
  busy,
  error,
  onRead,
  onAccept,
}: {
  current: Record<string, unknown>;
  server?: Record<string, unknown>;
  busy: boolean;
  error?: string | null;
  onRead: () => void;
  onAccept?: () => void;
}) {
  return (
    <StatusNotice tone="error">
      <p>
        Ваш ввод и выбранные файлы сохранены. Сравните изменения перед новой
        записью.
      </p>
      {error && <p role="alert">{error}</p>}
      <StatusNoticeAction disabled={busy} onClick={onRead}>
        Сравнить с серверной версией
      </StatusNoticeAction>
      {server && (
        <>
          {[
            ["Ваш вариант", current],
            ["Сейчас на сервере", server],
          ].map(([title, data]) => (
            <details key={String(title)} open>
              <summary>{String(title)}</summary>
              <dl>
                {Object.entries(data as Record<string, unknown>)
                  .filter(([key]) => key in labels)
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{labels[key]}</dt>
                      <dd
                        style={{
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          marginInlineStart: 0,
                        }}
                      >
                        {display(value, key)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </details>
          ))}
          {onAccept && (
            <StatusNoticeAction disabled={busy} onClick={onAccept}>
              Продолжить с моими изменениями после сравнения
            </StatusNoticeAction>
          )}
        </>
      )}
    </StatusNotice>
  );
}
