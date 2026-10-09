"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "@/shared/navigation/router";
import classes from "./login-screen.module.scss";
import {
  Background,
  ScrollArea,
  Typography,
  Field,
  Action,
  Spinner,
} from "@/shared/ui/elements";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { SmsCodeForm } from "./sms-code-form";
import * as Api from "@/shared/api/auth";
import { useCapabilities } from "@/shared/api/capabilities";
import { useAuth } from "@/domain/session/session-context";
import { PAPER_TEXTURE_URI, BROWN_MUTED, CREAM } from "./login-screen.content";
import {
  EMAIL_REGISTER_CONSENT_LABEL,
  EMAIL_REGISTER_CONSENT_VERSION,
} from "@shared/consent-texts";
import { prepareLoginPage } from "@/shared/navigation/navigation-intent";
import { getRequestErrorMessage } from "@/shared/api/errors";
import { SessionStatus } from "@/domain/session/session-status";

type Mode = "login" | "register" | "recover";
export default function LoginScreen({
  next,
  formUnavailable = false,
}: {
  next?: string | string[];
  formUnavailable?: boolean;
}) {
  const router = useRouter();
  const { applySession, authenticate, status: sessionStatus } = useAuth();
  const { smsLogin } = useCapabilities();
  const [method, setMethod] = useState<"sms" | "email">("email");
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(
    formUnavailable ? "Форма ещё не была готова. Повторите вход." : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const inFlight = useRef(false);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const [ready, setReady] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);
  useEffect(() => {
    mounted.current = true;
    prepareLoginPage(next);
    setReady(true);
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, [next]);
  useEffect(() => {
    if (!retryAt) return;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
      setRetrySeconds(seconds);
      if (!seconds) setRetryAt(0);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  const sms = smsLogin && method === "sms";
  const goNext = async (user: Api.AuthUser | null) => {
    if (!user) throw new Error("Не удалось получить профиль. Повторите вход.");
    await applySession(user);
    router.finishLogin();
  };
  const changeMode = (value: Mode) => {
    setMode(value);
    setError(null);
    setNotice(null);
    setNeedsTotp(false);
    setTotp("");
    setPassword("");
  };
  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready || inFlight.current || retryAt > Date.now()) return;
    setError(null);
    setNotice(null);
    if (mode === "register" && !consentChecked) {
      setError("Подтвердите согласие на обработку персональных данных");
      return;
    }
    setBusy(true);
    inFlight.current = true;
    const task = new AbortController();
    request.current = task;
    try {
      if (mode === "login") {
        const accepted = await authenticate(async (signal) => {
          const cancel = () => task.abort();
          signal.addEventListener("abort", cancel, { once: true });
          if (signal.aborted) cancel();
          try {
            return await Api.loginWithEmail(
              email.trim(),
              password,
              totp || undefined,
              task.signal,
            );
          } finally {
            signal.removeEventListener("abort", cancel);
          }
        });
        if (accepted) router.finishLogin();
      } else {
        const result =
          mode === "register"
            ? await Api.registerWithEmail(
                email.trim(),
                name.trim(),
                EMAIL_REGISTER_CONSENT_VERSION,
                task.signal,
              )
            : await Api.requestPasswordInstructions(email.trim(), task.signal);
        if (!mounted.current || task.signal.aborted) return;
        setNotice(result.message);
        setMode("login");
        setConsentChecked(false);
      }
    } catch (err) {
      if (!mounted.current || task.signal.aborted) return;
      if (err instanceof Api.ApiError && err.requiresTotp) setNeedsTotp(true);
      if (err instanceof Api.ApiError && err.status === 429) {
        const seconds = err.retryAfterSec ?? 60;
        setRetrySeconds(seconds);
        setRetryAt(Date.now() + seconds * 1000);
      }
      setError(getRequestErrorMessage(err));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  if (sessionStatus === "logging-out" || sessionStatus === "logout-error")
    return <SessionStatus />;
  return (
    <ScreenContainer backgroundColor="#FDF8F0">
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.background}
      >
        <div className={`ui-stack ${classes.background}`}>
          <ScrollArea contentClassName={classes.scroll}>
            <Typography className={classes.kicker}>DARYADARCY</Typography>
            <h1 className={classes.title}>
              {sms
                ? "Вход"
                : mode === "register"
                  ? "Регистрация"
                  : mode === "recover"
                    ? "Восстановление доступа"
                    : "Вход по почте"}
            </h1>
            <Typography className={classes.subtitle}>
              {sms
                ? "Введите номер — код придёт в SMS в течение минуты"
                : mode === "register"
                  ? "Введите почту. Подтвердите её по ссылке из письма и установите пароль, затем войдите."
                  : mode === "recover"
                    ? "Введите почту аккаунта. Если он доступен, мы отправим письмо с инструкцией."
                    : "Войдите, чтобы сохранять посты и пользоваться клубом"}
            </Typography>
            {notice && (
              <Typography role="status" className={classes.notice}>
                {notice}
              </Typography>
            )}
            <noscript>
              <p className={classes.error}>
                Для входа включите JavaScript в браузере и обновите страницу.
              </p>
            </noscript>
            {sms ? (
              <SmsCodeForm purpose="login" onSuccess={goNext} />
            ) : (
              <form
                method="post"
                action="/login/submit"
                onSubmit={submitEmail}
                aria-busy={busy}
                className="ui-stack"
              >
                {mode === "register" && (
                  <Field
                    aria-label="Имя"
                    name="name"
                    autoComplete="name"
                    placeholder="Имя"
                    placeholderColor={BROWN_MUTED}
                    value={name}
                    onValueChange={setName}
                    className={classes.input}
                    disabled={!ready || busy}
                  />
                )}
                <Field
                  aria-label="Email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Email"
                  placeholderColor={BROWN_MUTED}
                  value={email}
                  onValueChange={setEmail}
                  autoCapitalize="off"
                  autoCorrect="off"
                  className={classes.input}
                  disabled={!ready || busy}
                />
                {mode === "login" && (
                  <Field
                    aria-label="Пароль"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Пароль"
                    placeholderColor={BROWN_MUTED}
                    value={password}
                    onValueChange={setPassword}
                    className={classes.input}
                    disabled={!ready || busy}
                  />
                )}
                {mode === "login" && needsTotp && (
                  <Field
                    aria-label="Код двухфакторной аутентификации"
                    name="totp"
                    placeholder="Код 2FA (6 цифр)"
                    value={totp}
                    onValueChange={(value) =>
                      setTotp(value.replace(/\D/g, "").slice(0, 6))
                    }
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className={classes.input}
                    disabled={!ready || busy}
                  />
                )}
                {mode === "register" && (
                  <label className={classes.consent}>
                    <input
                      type="checkbox"
                      required
                      checked={consentChecked}
                      onChange={(event) =>
                        setConsentChecked(event.target.checked)
                      }
                    />
                    {EMAIL_REGISTER_CONSENT_LABEL}
                  </label>
                )}
                {error && (
                  <Typography role="alert" className={classes.error}>
                    {error}
                  </Typography>
                )}
                {retrySeconds > 0 && (
                  <Typography role="status" className={classes.notice}>
                    Повторить можно через {retrySeconds} сек.
                  </Typography>
                )}
                <Action
                  type="submit"
                  aria-busy={busy}
                  aria-label={
                    mode === "register"
                      ? "Получить письмо"
                      : mode === "recover"
                        ? "Отправить инструкцию"
                        : "Войти"
                  }
                  disabled={
                    !ready ||
                    busy ||
                    retrySeconds > 0 ||
                    (mode === "register" && !consentChecked)
                  }
                  className={classes.action2}
                >
                  {busy ? (
                    <Spinner color={CREAM} />
                  ) : (
                    <Typography className={classes.buttonText}>
                      {mode === "register"
                        ? "Получить письмо"
                        : mode === "recover"
                          ? "Отправить инструкцию"
                          : "Войти"}
                    </Typography>
                  )}
                </Action>
              </form>
            )}
            {!sms && (
              <>
                <Action
                  disabled={busy}
                  onClick={() =>
                    changeMode(mode === "register" ? "login" : "register")
                  }
                >
                  <Typography className={classes.switchText}>
                    {mode === "register"
                      ? "Уже есть аккаунт? Войти"
                      : "Нет аккаунта? Зарегистрироваться"}
                  </Typography>
                </Action>
                <Action
                  disabled={busy}
                  onClick={() =>
                    changeMode(mode === "recover" ? "login" : "recover")
                  }
                >
                  <Typography className={classes.switchText}>
                    {mode === "recover"
                      ? "Вернуться ко входу"
                      : "Забыли пароль или ещё не установили его?"}
                  </Typography>
                </Action>
              </>
            )}
            {smsLogin && (
              <Action
                disabled={busy}
                onClick={() => {
                  setMethod(sms ? "email" : "sms");
                  changeMode("login");
                }}
              >
                <Typography className={classes.switchText}>
                  {sms ? "Войти по почте" : "Войти по телефону"}
                </Typography>
              </Action>
            )}
            <Action onClick={() => router.back()}>
              <Typography className={classes.backText}>Назад</Typography>
            </Action>
          </ScrollArea>
        </div>
      </Background>
    </ScreenContainer>
  );
}
