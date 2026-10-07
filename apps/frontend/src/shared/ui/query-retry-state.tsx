"use client";
import classes from "./query-retry-state.module.scss";
import { type CSSProperties, mergeStyles } from "@/shared/ui/css";
import { Typography, Action } from "@/shared/ui/elements";
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
        role="alert"
        style={mergeStyles(style)}
        className={["ui-stack ", classes.div, className]
          .filter(Boolean)
          .join(" ")}
      >
        <Typography className={classes.message}>{message}</Typography>
        <Action
          onClick={onRetry}
          className={({ pressed }) =>
            [classes.action, pressed ? classes.opacityState : ""]
              .filter(Boolean)
              .join(" ")
          }
        >
          <Typography className={classes.buttonText}>Повторить</Typography>
        </Action>
      </div>
    );
  }
  return <>{children}</>;
}
