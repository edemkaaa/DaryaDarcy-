"use client";
/** Неподтверждённая административная команда требует чтения сохранённой операции, а не повторного нажатия действия. */
import { StatusNotice, StatusNoticeAction } from "@/shared/ui/status-notice";
import type { AdminActionRecovery } from "./use-admin-action-recovery";

export function AdminActionRecoveryNotice({
  recovery,
}: {
  recovery: AdminActionRecovery;
}) {
  const { intent, error, busy, cooldown } = recovery;
  if (!intent && !error) return null;
  const outcome = intent?.outcome;
  const message = !outcome
    ? "Результат сохранённого действия не подтверждён. Проверка не отправляет письмо и не продлевает клуб."
    : outcome.state === "rejected"
      ? `Сервер подтвердил отказ: ${outcome.code === "NOT_FOUND" ? "участница не найдена" : "действие недоступно"}.`
      : outcome.kind === "grantClub"
        ? `Продление подтверждено для участницы №${outcome.userId}: клуб продлён до ${new Date(outcome.expiresAt).toLocaleDateString("ru-RU")}.`
        : "Письмо с доступом поставлено в очередь. Доставка ещё не подтверждена.";
  return (
    <StatusNotice
      compact
      tone={
        error || outcome?.state === "rejected"
          ? "error"
          : outcome
            ? "success"
            : "info"
      }
      actions={
        <>
          <StatusNoticeAction
            disabled={busy}
            onClick={() => void recovery.check()}
          >
            {recovery.checking
              ? "Проверяем результат…"
              : "Проверить результат действия"}
          </StatusNoticeAction>
          {intent && !outcome ? (
            <StatusNoticeAction
              disabled={busy || cooldown}
              onClick={() => {
                const action =
                  intent.kind === "grantClub"
                    ? "продление клуба"
                    : "постановку письма в очередь";
                if (
                  window.confirm(
                    `Повторить исходное ${action} для участницы №${intent.userId} с прежним ключом?`,
                  )
                )
                  void recovery.replay();
              }}
            >
              Повторить исходное действие
            </StatusNoticeAction>
          ) : null}
        </>
      }
    >
      {intent ? <div>{message}</div> : null}
      {error ? <div>{error}</div> : null}
      {cooldown ? (
        <div>
          Отправка письма доступна после указанной сервером задержки. Проверка
          результата доступна сейчас.
        </div>
      ) : null}
    </StatusNotice>
  );
}
