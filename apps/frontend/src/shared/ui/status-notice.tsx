"use client";
import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { Action } from "./action";
import { MaterialIcons } from "./icons";
import classes from "./status-notice.module.scss";

type Tone = "info" | "error" | "success";
export function StatusNotice({
  children,
  tone = "info",
  actions,
  compact = false,
  role = tone === "error" ? "alert" : "status",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  actions?: ReactNode;
  compact?: boolean;
  role?: "alert" | "status";
  className?: string;
}) {
  return (
    <div
      role={role}
      className={[
        "ui-stack",
        classes.notice,
        classes[tone],
        compact ? classes.compact : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={`ui-stack ${classes.content}`}>
        <span className={classes.icon} aria-hidden="true">
          <MaterialIcons
            name={
              tone === "error"
                ? "error-outline"
                : tone === "success"
                  ? "check-circle-outline"
                  : "info-outline"
            }
            size={16}
            color="currentColor"
          />
        </span>
        <div className={`ui-stack ${classes.message}`}>{children}</div>
      </div>
      {actions ? (
        <div className={`ui-stack ${classes.actions}`}>{actions}</div>
      ) : null}
    </div>
  );
}

export function StatusNoticeAction(
  props: Omit<ComponentProps<typeof Action>, "className" | "style">,
) {
  return <Action {...props} className={classes.action} />;
}

export function StatusNoticeLink(
  props: Omit<ComponentProps<typeof Link>, "className" | "style">,
) {
  return <Link {...props} className={classes.action} />;
}
