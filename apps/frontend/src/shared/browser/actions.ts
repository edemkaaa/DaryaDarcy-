"use client";
export async function openExternalUrl(url: string) {
  if (/^(mailto:|tel:)/i.test(url)) window.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
}
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
