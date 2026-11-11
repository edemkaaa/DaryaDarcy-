"use client";
/** Действия браузера проверяют внешние URL и используют доступные возможности отправки или копирования ссылки. */
import { safeExternalUrl } from "@/shared/navigation/external-url";
/** Проверяем URL перед открытием; mailto/tel передаются текущему браузеру, обычные ссылки открываются без opener. */
export async function openExternalUrl(url: string) {
  const safe = safeExternalUrl(url);
  if (!safe) return;
  if (/^(mailto:|tel:)/i.test(safe)) window.location.href = safe;
  else window.open(safe, "_blank", "noopener,noreferrer");
}
/** Используем системный share, а при его отсутствии копируем сообщение и URL; отказ разрешения не маскируем как успех. */
export async function shareContent({
  message,
  title,
  url,
}: {
  message?: string;
  title?: string;
  url?: string;
}) {
  if (navigator.share) await navigator.share({ text: message, title, url });
  else
    await navigator.clipboard.writeText(
      [message, url].filter(Boolean).join("\n"),
    );
}
/** Совместимую конфигурацию кнопок сводим к native confirm/alert: это не произвольный много-кнопочный диалог приложения. */
export function showAlert(
  title: string,
  message?: string,
  buttons?: Array<{
    text?: string;
    style?: "cancel" | "default" | "destructive";
    onClick?: () => void;
  }>,
) {
  if (buttons && buttons.length > 1) {
    const ok = window.confirm([title, message].filter(Boolean).join("\n"));
    (ok
      ? buttons.find((b) => b.style !== "cancel")
      : buttons.find((b) => b.style === "cancel")
    )?.onClick?.();
  } else {
    window.alert([title, message].filter(Boolean).join("\n"));
    buttons?.[0]?.onClick?.();
  }
}
