"use client";

import { useId, useState } from "react";
import { Action, Field, Typography } from "@/shared/ui/elements";
import classes from "./admin-screen.module.scss";

/** Local preparation only. Connect a confirmed server operation once its contract exists. */
export function MemberEmailBinding({
  memberId,
  memberName,
  disabled,
}: {
  memberId: number;
  memberName: string | null;
  disabled: boolean;
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);
  const close = () => {
    setOpen(false);
    setEmail("");
    setInvalid(false);
  };

  return (
    <>
      <Action
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={open ? formId : undefined}
        className={classes.action}
      >
        <Typography className={classes.grantBtnText}>
          Привязать почту
        </Typography>
      </Action>
      {open ? (
        <form
          id={formId}
          aria-label="Первая привязка почты"
          className={`ui-stack ${classes.memberEmailDraft}`}
          noValidate
          onSubmit={(event) => event.preventDefault()}
        >
          <Typography className={classes.postItemDate}>
            Аккаунт: {memberName || "Без имени"} · ID {memberId}
          </Typography>
          <Typography className={classes.memberEmailNotice}>
            Сначала сверьте оплату и принадлежность аккаунта участнице.
          </Typography>
          <label htmlFor={`${formId}-email`} className={classes.formLabel}>
            Почта участницы
          </label>
          <Field
            id={`${formId}-email`}
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={320}
            required
            disabled={disabled}
            value={email}
            onValueChange={(value) => {
              setEmail(value);
              setInvalid(false);
            }}
            onBlur={(event) => setInvalid(!event.currentTarget.validity.valid)}
            aria-invalid={invalid}
            aria-describedby={`${formId}-notice${invalid ? ` ${formId}-error` : ""}`}
            className={`${classes.sortInput} ${classes.memberEmailInput}`}
          />
          {invalid ? (
            <Typography
              id={`${formId}-error`}
              role="alert"
              className={classes.memberEmailNotice}
            >
              Укажите корректный email.
            </Typography>
          ) : null}
          <Typography
            id={`${formId}-notice`}
            className={classes.memberEmailNotice}
          >
            Привязка пока недоступна. Данные не отправляются и будут удалены при
            закрытии формы.
          </Typography>
          <div className={`ui-stack ${classes.postItemActions}`}>
            <Action
              type="submit"
              disabled
              className={`${classes.action} ${classes.opacityState}`}
            >
              <Typography className={classes.grantBtnText}>
                Привязать
              </Typography>
            </Action>
            <Action type="button" onClick={close} className={classes.action}>
              <Typography className={classes.grantBtnText}>Отмена</Typography>
            </Action>
          </div>
        </form>
      ) : null}
    </>
  );
}
