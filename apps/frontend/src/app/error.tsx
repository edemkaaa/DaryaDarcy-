"use client";
import { StatusNotice, StatusNoticeAction } from "@/shared/ui/status-notice";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="ui-stack route-error">
      <StatusNotice
        tone="error"
        actions={
          <StatusNoticeAction onClick={reset}>
            Попробовать ещё раз
          </StatusNoticeAction>
        }
      >
        Не удалось открыть страницу.
      </StatusNotice>
    </div>
  );
}
