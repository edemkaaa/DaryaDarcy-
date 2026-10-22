"use client";
import classes from "./query-retry-state.module.scss";
import { type CSSProperties, mergeStyles } from "@/shared/ui/css";
import { StatusNotice, StatusNoticeAction } from "./status-notice";
import { LoadingIndicator } from "./loading-indicator";
type Props = {
  isLoading: boolean;
  isError: boolean;
  hasData?: boolean;
  onRetry: () => void;
  message?: string;
  style?: CSSProperties;
  className?: string;
  children?: React.ReactNode;
  loadingContent?: React.ReactNode;
  loadingSize?: "small" | "large";
};
export function QueryRetryState({
  isLoading,
  isError,
  hasData = false,
  onRetry,
  message = "Не удалось загрузить данные",
  style,
  className = "",
  children,
  loadingContent,
  loadingSize = "large",
}: Props) {
  if (isLoading && !hasData) {
    if (loadingContent !== undefined) return <>{loadingContent}</>;
    return (
      <div
        style={mergeStyles(style)}
        className={["ui-stack ", classes.div, className]
          .filter(Boolean)
          .join(" ")}
      >
        <LoadingIndicator size={loadingSize} />
      </div>
    );
  }
  if (isError && !hasData) {
    return (
      <div
        style={mergeStyles(style)}
        className={["ui-stack ", classes.div, className]
          .filter(Boolean)
          .join(" ")}
      >
        <StatusNotice
          tone="error"
          actions={
            <StatusNoticeAction onClick={onRetry}>Повторить</StatusNoticeAction>
          }
        >
          {message}
        </StatusNotice>
      </div>
    );
  }
  return <>{children}</>;
}
