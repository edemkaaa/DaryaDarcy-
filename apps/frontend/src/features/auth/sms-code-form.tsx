"use client";
/** Условный SMS-вход хранит номер, код и задержку повтора отдельно от email-формы; серверная доступность проверяется владельцем экрана. */
import classes from "./sms-code-form.module.scss";
import { Typography, Field, Action, Spinner } from "@/shared/ui/elements";
import { useEffect, useRef, useState } from "react";
import { MaterialIcons } from "@/shared/ui/icons";
import { useRouter } from "@/shared/navigation/router";
import * as Api from "@/shared/api/auth";
import {
  formatPhoneInput,
  formatRuPhone,
  normalizeRuPhone,
} from "@/domain/session/phone";
import {
  SMS_LOGIN_CONSENT_LABEL,
  SMS_LOGIN_CONSENT_VERSION,
} from "@/domain/session/consent-texts";
import { BROWN_MUTED, CREAM, OLIVE } from "./sms-code-form.content";
type Props = {
  purpose: "login" | "bind";
  onSuccess: (user: Api.AuthUser) => void | Promise<void>;
};
/** Совместимая SMS-форма отделяет отправку кода от подтверждения; видимость функции управляется capabilities родительского экрана. */
export function SmsCodeForm({ purpose, onSuccess }: Props) {
  const router = useRouter();
  const [phoneInput, setPhoneInput] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [consentChecked, setConsentChecked] = useState(false);
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const verifyingRef = useRef(false);
  const phone = normalizeRuPhone(phoneInput);
  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = setTimeout(
      () => setRetryAfter((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [retryAfter]);
  /** Проверяем номер и нужное согласие до запроса SMS; серверный retryAfter удерживает повторную отправку. */
  const send = async () => {
    setError(null);
    if (!phone) {
      setError("Укажите российский номер: +7 9XX XXX-XX-XX");
      return;
    }
    if (purpose === "login" && !consentChecked) {
      setError("Подтвердите согласие на обработку персональных данных");
      return;
    }
    setBusy(true);
    try {
      const result = await Api.sendSmsCode(phone);
      setStep("code");
      setRetryAfter(result.retryAfterSec || 60);
    } catch (err) {
      const retryAfterSec = (
        err as Error & {
          retryAfterSec?: number;
        }
      ).retryAfterSec;
      if (retryAfterSec) {
        setStep("code");
        setRetryAfter(retryAfterSec);
      }
      setError(err instanceof Error ? err.message : "Не удалось отправить SMS");
    } finally {
      setBusy(false);
    }
  };
  /** Ref блокирует параллельную проверку при автозаполнении и ручном submit; результат передаём владельцу формы. */
  const verify = async (submittedCode = code) => {
    setError(null);
    if (!phone || submittedCode.trim().length < 4) {
      setError("Введите код из SMS");
      return;
    }
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setBusy(true);
    try {
      const result = await Api.verifySmsCode(
        phone,
        submittedCode.trim(),
        purpose === "login" ? SMS_LOGIN_CONSENT_VERSION : undefined,
        totp.trim() || undefined,
      );
      await onSuccess(result.user);
    } catch (err) {
      const authErr = err as Error & {
        requiresTotp?: boolean;
      };
      if (authErr.requiresTotp) setNeedsTotp(true);
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      verifyingRef.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="ui-stack ">
      {step === "phone" ? (
        <>
          <div
            className={["ui-stack ", classes.phoneRow]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.prefix}>+7</Typography>
            <Field
              placeholder="900 000-00-00"
              placeholderColor={BROWN_MUTED}
              value={phoneInput}
              onValueChange={(value) => setPhoneInput(formatPhoneInput(value))}
              inputMode="tel"
              autoComplete="tel"
              onSubmit={() => {
                if (!busy) void send();
              }}
              className={classes.phoneInput}
            />
          </div>
          {error ? (
            <Typography className={classes.error}>{error}</Typography>
          ) : null}
          {purpose === "login" ? (
            <Action
              onClick={() => setConsentChecked((v) => !v)}
              className={classes.consentRow}
            >
              <MaterialIcons
                name={consentChecked ? "check-box" : "check-box-outline-blank"}
                size={22}
                color={consentChecked ? OLIVE : BROWN_MUTED}
              />
              <Typography className={classes.consentCheckboxText}>
                {SMS_LOGIN_CONSENT_LABEL}
              </Typography>
            </Action>
          ) : null}
          <Action
            onClick={send}
            disabled={busy || (purpose === "login" && !consentChecked)}
            className={({ pressed }) =>
              [
                classes.action,
                pressed
                  ? classes.opacityState
                  : busy || (purpose === "login" && !consentChecked)
                    ? classes.opacityState2
                    : "",
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            {busy ? (
              <Spinner color={CREAM} />
            ) : (
              <Typography className={classes.buttonText}>
                Получить код
              </Typography>
            )}
          </Action>
          {purpose === "login" ? (
            <Typography className={classes.consent}>
              Также доступны{" "}
              <Typography
                onClick={() => router.push("/privacy")}
                className={classes.consentLink}
              >
                Политика конфиденциальности
              </Typography>{" "}
              и{" "}
              <Typography
                onClick={() => router.push("/legal")}
                className={classes.consentLink}
              >
                юридические документы
              </Typography>
              .
            </Typography>
          ) : (
            <Typography className={classes.consent}>
              Код придёт в SMS. Номер сохранится в аккаунте.
            </Typography>
          )}
        </>
      ) : (
        <>
          <Typography className={classes.sentTo}>
            Код отправлен на {formatRuPhone(phone || "")}
          </Typography>
          <Typography className={classes.hint}>
            Действует 5 минут. Имя отправителя может быть служебным, пока
            модерация не подтвердит daryadarcy.
          </Typography>
          <Action
            onClick={() => {
              setStep("phone");
              setCode("");
              setError(null);
            }}
          >
            <Typography className={classes.changeNumber}>
              Изменить номер
            </Typography>
          </Action>
          <Field
            autoFocus
            placeholder="Код из SMS"
            placeholderColor={BROWN_MUTED}
            value={code}
            onValueChange={(value) => {
              const nextCode = value.replace(/\D/g, "").slice(0, 6);
              setCode(nextCode);
              if (nextCode.length === 6 && !busy && !needsTotp)
                void verify(nextCode);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            onSubmit={() => {
              if (!busy) void verify();
            }}
            className={classes.input}
          />
          {needsTotp ? (
            <Field
              placeholder="Код 2FA (6 цифр)"
              placeholderColor={BROWN_MUTED}
              value={totp}
              onValueChange={(value) =>
                setTotp(value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              maxLength={6}
              className={classes.input}
            />
          ) : null}
          {error ? (
            <Typography className={classes.error}>{error}</Typography>
          ) : null}
          <Action
            onClick={() => void verify()}
            disabled={busy}
            className={({ pressed }) =>
              [classes.action, pressed ? classes.opacityState3 : ""]
                .filter(Boolean)
                .join(" ")
            }
          >
            {busy ? (
              <Spinner color={CREAM} />
            ) : (
              <Typography className={classes.buttonText}>
                {purpose === "bind" ? "Привязать" : "Войти"}
              </Typography>
            )}
          </Action>
          <Action onClick={send} disabled={busy || retryAfter > 0}>
            <Typography
              className={[
                classes.typography,
                retryAfter > 0 ? classes.opacityState4 : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {retryAfter > 0
                ? `Отправить ещё раз через ${retryAfter} с`
                : "Отправить код ещё раз"}
            </Typography>
          </Action>
        </>
      )}
    </div>
  );
}
