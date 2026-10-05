"use client";
import classes from "./query-retry-state.module.scss";
import { type CSSProperties, mergeStyles } from "@/shared/ui/css";
import { Spinner, Typography, Action } from "@/shared/ui/elements";
type Props = {
  isLoading: boolean;
  isError: boolean;
  hasData?: boolean;
  onRetry: () => void;
  message?: string;
  style?: CSSProperties;
  className?: string;
  children?: React.ReactNode;
};
const OLIVE = "#6B7B5E";
export function QueryRetryState({
  isLoading,
  isError,
  hasData = false,
  onRetry,
  message = "Не удалось загрузить данные",
  style,
  className = "",
  children,
}: Props) {
  if (isLoading && !hasData) {
    return (
      <div
        style={mergeStyles(style)}
        className={["ui-stack ", classes.div, className]
          .filter(Boolean)
          .join(" ")}
      >
        <Spinner size="large" color={OLIVE} />
        <Typography className={classes.hint}>Загрузка…</Typography>
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
