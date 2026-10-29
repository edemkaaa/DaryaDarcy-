"use client";
import { useId, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { Field, Typography } from "@/shared/ui/elements";
import { BROWN_MUTED } from "./club-screen.content";
import classes from "./club-screen.module.scss";
import { formatSupportPhone } from "./support-phone";

export function GuestContactFields({
  email,
  phone,
  disabled,
  readOnly,
  onEmailChange,
  onPhoneChange,
}: {
  email: string;
  phone: string;
  disabled: boolean;
  readOnly: boolean;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
}) {
  const phoneHintId = useId();
  const phoneRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    phoneRef.current?.setSelectionRange(
      pendingCaret.current,
      pendingCaret.current,
    );
    pendingCaret.current = null;
  }, [phone]);
  const restoreCaret = (
    formatted: string,
    digitCount: number,
    atEnd = false,
  ) => {
    let position = formatted.length;
    if (!atEnd) {
      let count = 0;
      position = 0;
      for (let index = 0; index < formatted.length; index++) {
        if (/\d/.test(formatted[index])) count++;
        if (count === digitCount) {
          position = index + 1;
          break;
        }
      }
    }
    pendingCaret.current = position;
  };
  const changePhone = (value: string) => {
    const caret = phoneRef.current?.selectionStart ?? value.length;
    const formatted = formatSupportPhone(value);
    onPhoneChange(formatted);
    restoreCaret(
      formatted,
      value.slice(0, caret).replace(/\D/g, "").length,
      caret === value.length,
    );
  };
  const editPhone = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (event.ctrlKey || event.metaKey || event.altKey || readOnly) return;
    if (event.key.length === 1 && !/\d/.test(event.key)) {
      event.preventDefault();
      return;
    }
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    const input = event.currentTarget;
    if (input.selectionStart !== input.selectionEnd) return;
    const caret = input.selectionStart ?? 0;
    const backwards = event.key === "Backspace";
    let index = backwards ? caret - 1 : caret;
    while (index >= 0 && index < phone.length && !/\d/.test(phone[index]))
      index += backwards ? -1 : 1;
    event.preventDefault();
    if (index <= 1 || index >= phone.length) {
      if (phone === "+7" && backwards) onPhoneChange("");
      return;
    }
    const formatted = formatSupportPhone(
      phone.slice(0, index) + phone.slice(index + 1),
    );
    onPhoneChange(formatted);
    restoreCaret(
      formatted,
      phone.slice(0, backwards ? index : caret).replace(/\D/g, "").length,
    );
  };
  return (
    <>
      <Field
        placeholder="Почта для чека и входа"
        placeholderColor={BROWN_MUTED}
        autoCapitalize="off"
        inputMode="email"
        type="email"
        aria-label="Почта для чека и входа"
        autoComplete="email"
        maxLength={320}
        disabled={disabled}
        value={email}
        readOnly={readOnly}
        onValueChange={onEmailChange}
        className={classes.guestEmail}
      />
      <Field
        ref={phoneRef}
        placeholder="+7 (999) 123-45-67"
        placeholderColor={BROWN_MUTED}
        inputMode="numeric"
        type="tel"
        required
        aria-label="Номер телефона"
        aria-describedby={phoneHintId}
        autoComplete="tel"
        pattern="\+7 \([0-9]{3}\) [0-9]{3}-[0-9]{2}-[0-9]{2}"
        maxLength={40}
        disabled={disabled}
        value={phone}
        readOnly={readOnly}
        onValueChange={changePhone}
        onKeyDown={editPhone}
        className={`${classes.guestEmail} ${classes.guestPhone}`}
      />
      <Typography id={phoneHintId} className={classes.guestPhoneHint}>
        (Для тех. поддержки)
      </Typography>
    </>
  );
}
