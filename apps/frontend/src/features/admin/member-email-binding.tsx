"use client";

import { useId, useState } from "react";
import { Action, Field, Typography } from "@/shared/ui/elements";
import { normalizeMemberEmailBindingEmail } from "@/shared/api/member-email-binding";
import classes from "./admin-screen.module.scss";
import {
  memberEmailBindingEnabled,
  type BindingResult,
} from "./use-member-email-bindings";

export function MemberEmailBinding({
  memberId,
  memberName,
  disabled,
  result,
  error,
  onSend,
  onInspect,
}: {
  memberId: number;
  memberName: string | null;
  disabled: boolean;
  result?: BindingResult;
  error?: string;
  onSend: (id: number, email: string) => Promise<void>;
  onInspect: (id: number) => Promise<void>;
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
          onSubmit={(event) => {
            event.preventDefault();
            if (!memberEmailBindingEnabled || disabled || result) return;
            if (!event.currentTarget.checkValidity()) {
              setInvalid(true);
              return;
            }
            try {
              void onSend(memberId, normalizeMemberEmailBindingEmail(email));
            } catch {
              setInvalid(true);
            }
          }}
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
            disabled={disabled || Boolean(result)}
            value={result?.email ?? email}
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
            role="status"
            className={classes.memberEmailNotice}
          >
            {result?.message ??
              (memberEmailBindingEnabled
                ? "Отправим ссылку подтверждения. Только после её подтверждения почта появится в аккаунте; пароль и доступ не изменятся."
                : "Привязка пока недоступна. Данные не отправляются и будут удалены при закрытии формы.")}
          </Typography>
          {error ? (
            <Typography role="alert" className={classes.memberEmailNotice}>
              {error}
            </Typography>
          ) : null}
          {result ? (
            <Typography className={classes.memberEmailNotice}>
              Закрытие формы не отменяет заявку. На этом устройстве сохранён
              только ключ проверки; почта не сохраняется. После перезагрузки
              используйте «Восстановить заявку».
            </Typography>
          ) : null}
          <div className={`ui-stack ${classes.postItemActions}`}>
            {!result && memberEmailBindingEnabled ? (
              <Action
                type="button"
                disabled={disabled}
                onClick={() => void onInspect(memberId)}
                className={classes.action}
              >
                <Typography className={classes.grantBtnText}>
                  Восстановить заявку
                </Typography>
              </Action>
            ) : null}
            {result ? (
              <>
                <Action
                  type="button"
                  disabled={disabled}
                  onClick={() => void onInspect(memberId)}
                  className={classes.action}
                >
                  <Typography className={classes.grantBtnText}>
                    Проверить заявку
                  </Typography>
                </Action>
                {result.phase === "unknown" && result.email ? (
                  <Action
                    type="button"
                    disabled={disabled}
                    onClick={() => void onSend(memberId, result.email)}
                    className={classes.action}
                  >
                    <Typography className={classes.grantBtnText}>
                      Повторить эту заявку
                    </Typography>
                  </Action>
                ) : null}
              </>
            ) : (
              <Action
                type="submit"
                disabled={disabled || !memberEmailBindingEnabled}
                className={`${classes.action} ${!memberEmailBindingEnabled ? classes.opacityState : ""}`}
              >
                <Typography className={classes.grantBtnText}>
                  {memberEmailBindingEnabled
                    ? "Отправить подтверждение"
                    : "Привязать"}
                </Typography>
              </Action>
            )}
            <Action type="button" onClick={close} className={classes.action}>
              <Typography className={classes.grantBtnText}>
                {result ? "Закрыть" : "Отмена"}
              </Typography>
            </Action>
          </div>
        </form>
      ) : null}
    </>
  );
}
