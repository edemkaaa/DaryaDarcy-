"use client";
import classes from "./screen-error-boundary.module.scss";

import { Typography, Action } from "@/shared/ui/elements";
import { Component, type ReactNode } from "react";
type Props = {
  children: ReactNode;
  message?: string;
  onRetry?: () => void;
};
type State = {
  error: Error | null;
};
/** Catches render errors so Safari/WebKit does not reload the page in a crash loop. */
export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[ScreenErrorBoundary]", error);
    }
  }
  private handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };
  render() {
    if (this.state.error) {
      return (
        <div className={["ui-stack ", classes.wrap].filter(Boolean).join(" ")}>
          <Typography className={classes.title}>
            {this.props.message || "Не удалось показать раздел"}
          </Typography>
          <Typography className={classes.body}>
            Обновите страницу или попробуйте ещё раз.
          </Typography>
          <Action onClick={this.handleRetry} className={classes.btn}>
            <Typography className={classes.btnText}>Повторить</Typography>
          </Action>
        </div>
      );
    }
    return this.props.children;
  }
}
