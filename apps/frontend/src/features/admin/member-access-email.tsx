"use client";
import { useId } from "react";
import { Action, Typography } from "@/shared/ui/elements";
import type {
  AccessEmailMember,
  AccessEmailResult,
} from "./use-access-email-resend";
import classes from "./admin-screen.module.scss";

export function MemberAccessEmail({
  member,
  result,
  pending,
  disabled,
  onSend,
}: {
  member: AccessEmailMember;
  result?: AccessEmailResult;
  pending: boolean;
  disabled: boolean;
  onSend: (member: AccessEmailMember) => Promise<void>;
}) {
  const noticeId = useId();
  const blocked = disabled || pending || (result && result.status !== "error");
  return (
    <>
      <Action
        disabled={Boolean(blocked)}
        aria-busy={pending}
        aria-describedby={result ? noticeId : undefined}
        className={`${classes.action} ${blocked ? classes.opacityState : ""}`}
        onClick={() => {
          if (
            window.confirm(`Повторить письмо с доступом для ${member.email}?`)
          )
            void onSend(member);
        }}
      >
        <Typography className={classes.grantBtnText}>
          {pending
            ? "Ставим в очередь…"
            : result?.status === "queued"
              ? "Письмо в очереди"
              : "Повторить письмо"}
        </Typography>
      </Action>
      {result ? (
        <Typography
          id={noticeId}
          role={pending || result.status === "queued" ? "status" : "alert"}
          className={`${classes.memberEmailDraft} ${classes.memberEmailNotice}`}
        >
          {pending ? "Ставим письмо с доступом в очередь…" : result.message}
        </Typography>
      ) : null}
    </>
  );
}
