"use client";
/** Вход, регистрация и запрос восстановления используют разные REST-действия; успешная отправка инструкции не устанавливает пароль. */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
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
import { MaterialIcons } from "@/shared/ui/icons";
import { useViewport } from "@/shared/browser/viewport";
import { SmsCodeForm } from "./sms-code-form";
import * as Api from "@/shared/api/auth";
import { useCapabilities } from "@/shared/api/capabilities";
import { useAuth } from "@/domain/session/session-context";
import {
  PAPER_TEXTURE_URI,
  BROWN_MUTED,
  CREAM,
  OLIVE,
} from "./login-screen.content";
import {
  EMAIL_REGISTER_CONSENT_LABEL,
  EMAIL_REGISTER_CONSENT_VERSION,
} from "@shared/consent-texts";
import { prepareLoginPage } from "@/shared/navigation/navigation-intent";
import { getRequestErrorMessage } from "@/shared/api/errors";
import { SessionStatus } from "@/domain/session/session-status";

type Mode = "login" | "register" | "recover";
/** Управляем email-входом, регистрацией и запросом письма раздельно; до готовности JS и окончания предыдущего запроса повтор заблокирован. */
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
  const { height } = useViewport();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [method, setMethod] = useState<"sms" | "email">("email");
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const passwordRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const passwordSelection = useRef<{
    start: number;
    end: number;
    direction: "forward" | "backward" | "none";
  } | null>(null);
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
  useLayoutEffect(() => {
    const field = passwordRef.current;
    const selection = passwordSelection.current;
    passwordSelection.current = null;
    // Restore after the input type and browser selection have both updated.
    if (!field || !selection) return;
    const frame = requestAnimationFrame(() => {
      if (document.activeElement === field)
        field.setSelectionRange(
          selection.start,
          selection.end,
          selection.direction,
        );
    });
    return () => cancelAnimationFrame(frame);
  }, [passwordVisible]);
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
    // Keyboard resize can leave the focused input below this screen's scroll area.
    // Measure after the viewport height and the form layout have updated.
    const frame = requestAnimationFrame(() => {
      const scroll = scrollRef.current;
      const field = document.activeElement;
      if (
        !scroll ||
        !(field instanceof HTMLInputElement) ||
        !field.matches(".ui-field") ||
        !scroll.contains(field)
      )
        return;
      const area = scroll.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const top = Math.max(area.top, viewportTop) + 12;
      const bottom =
        Math.min(area.bottom, viewportTop + (viewport?.height ?? innerHeight)) -
        12;
      const box = field.getBoundingClientRect();
      if (box.bottom > bottom) scroll.scrollTop += box.bottom - bottom;
      else if (box.top < top) scroll.scrollTop += box.top - top;
    });
    return () => cancelAnimationFrame(frame);
  }, [height]);
  useEffect(() => {
    if (!retryAt) return;
    /** Считаем cooldown от абсолютного retryAt, чтобы фоновые ограничения таймеров не продлевали искусственно блокировку. */
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
  /** После условного SMS-входа применяем подтверждённого пользователя и расходуем сохранённое намерение навигации. */
  const goNext = async (user: Api.AuthUser | null) => {
    if (!user) throw new Error("Не удалось получить профиль. Повторите вход.");
    await applySession(user);
    router.finishLogin();
  };
  /** Смена режима сохраняет email, но удаляет пароль, TOTP и прежние сообщения, чтобы не смешивать разные действия. */
  const changeMode = (value: Mode) => {
    setMode(value);
    setError(null);
    setNotice(null);
    setNeedsTotp(false);
    setTotp("");
    setPassword("");
    setPasswordVisible(false);
  };
  /** Сериализуем отправку и соблюдаем Retry-After; письмо означает принятую инструкцию, а успешный вход подтверждает SessionController. */
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
          /** Связываем отмену контроллера сессии с локальным запросом формы и снимаем listener после ответа. */
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
        // Acceptance means queued instructions, not delivery or an installed password.
        // Keep the current form available for a deliberate resend.
        setPassword("");
        setPasswordVisible(false);
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
          <ScrollArea ref={scrollRef} contentClassName={classes.scroll}>
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
                  <div className={classes.passwordField}>
                    <Field
                      ref={passwordRef}
                      aria-label="Пароль"
                      name="password"
                      type={passwordVisible ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="Пароль"
                      placeholderColor={BROWN_MUTED}
                      value={password}
                      onValueChange={setPassword}
                      className={`${classes.input} ${classes.passwordInput}`}
                      disabled={!ready || busy}
                    />
                    <Action
                      type="button"
                      aria-label={
                        passwordVisible ? "Скрыть пароль" : "Показать пароль"
                      }
                      aria-pressed={passwordVisible}
                      className={classes.passwordToggle}
                      disabled={!ready || busy}
                      onPointerDown={(event) => {
                        // Keep input focus and the phone keyboard when tapping the eye.
                        if (event.isPrimary && event.button === 0)
                          event.preventDefault();
                      }}
                      onClick={() => {
                        const field = passwordRef.current;
                        passwordSelection.current =
                          field && document.activeElement === field
                            ? {
                                start: field.selectionStart ?? 0,
                                end: field.selectionEnd ?? 0,
                                direction: field.selectionDirection ?? "none",
                              }
                            : null;
                        setPasswordVisible((visible) => !visible);
                      }}
                    >
                      <MaterialIcons
                        name={passwordVisible ? "visibility-off" : "visibility"}
                        size={22}
                        color={BROWN_MUTED}
                      />
                    </Action>
                  </div>
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
                      className={classes.consentInput}
                      required
                      checked={consentChecked}
                      onChange={(event) =>
                        setConsentChecked(event.target.checked)
                      }
                    />
                    <span aria-hidden="true" className={classes.consentMark}>
                      <MaterialIcons
                        name={
                          consentChecked
                            ? "check-box"
                            : "check-box-outline-blank"
                        }
                        size={22}
                        color={consentChecked ? OLIVE : BROWN_MUTED}
                      />
                    </span>
                    <span className={classes.consentText}>
                      {EMAIL_REGISTER_CONSENT_LABEL}
                    </span>
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
                      ? notice
                        ? "Пароль уже установлен? Войти"
                        : "Уже есть аккаунт? Войти"
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
          </ScrollArea>
        </div>
      </Background>
    </ScreenContainer>
  );
}
