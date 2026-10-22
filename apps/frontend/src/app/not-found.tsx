import { StatusNotice, StatusNoticeLink } from "@/shared/ui/status-notice";
export default function NotFound() {
  return (
    <div className="ui-stack route-error">
      <StatusNotice
        actions={
          <StatusNoticeLink href="/">Вернуться на главную →</StatusNoticeLink>
        }
      >
        Страница не найдена.
      </StatusNotice>
    </div>
  );
}
