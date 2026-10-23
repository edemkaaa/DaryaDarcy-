"use client";
import { StatusNotice, StatusNoticeAction } from "@/shared/ui/status-notice";
import { ScreenStatus } from "@/shared/ui/screen-status";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <ScreenStatus>
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
    </ScreenStatus>
  );
}
