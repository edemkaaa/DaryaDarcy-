"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Field } from "@/shared/ui/field";
import { Action } from "@/shared/ui/action";
import { Spinner } from "@/shared/ui/spinner";
import { MaterialIcons } from "@/shared/ui/icons";
import { completePassword } from "@/shared/api/password";
import { ApiError } from "@/shared/api/errors";
import controls from "./login-screen.module.scss";
import classes from "./password-screen.module.scss";

type Phase = "loading" | "ready" | "invalid" | "success" | "unknown";

/** An isolated, public form: the one-time proof lives only in this component. */
export default function PasswordScreen() {
  const token = useRef<string | null>(null);
  const initialized = useRef(false);
  const request = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const alive = useRef(false);
  const input = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const selection = useRef<{
    start: number;
    end: number;
    direction: "forward" | "backward" | "none";
  } | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(0);

  useLayoutEffect(() => {
    // The ref makes this safe under React Strict Mode's effect replay.
    if (initialized.current) return;
    initialized.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const proof = params.get("token");
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname,
    );
    if (
      params.getAll("token").length === 1 &&
      proof &&
      /^[A-Za-z0-9_-]{43}$/.test(proof)
    ) {
      token.current = proof;
      setPhase("ready");
    } else setPhase("invalid");
  }, []);

  useEffect(() => {
    alive.current = true;
    const leave = () => {
      token.current = null;
      request.current?.abort();
      if (input.current) input.current.value = "";
      setPassword("");
      setPhase("invalid");
    };
    window.addEventListener("pagehide", leave);
    return () => {
      alive.current = false;
      request.current?.abort();
      window.removeEventListener("pagehide", leave);
    };
  }, []);

  useLayoutEffect(() => {
    const field = input.current;
    const saved = selection.current;
    selection.current = null;
    if (!field || !saved) return;
    const frame = requestAnimationFrame(() => {
      if (document.activeElement === field)
        field.setSelectionRange(saved.start, saved.end, saved.direction);
    });
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  useEffect(() => {
    if (phase === "success" || phase === "unknown" || phase === "invalid")
      heading.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (!retryAt) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= retryAt) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [retryAt]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      phase !== "ready" ||
      !token.current ||
      inFlight.current ||
      Date.now() < retryAt ||
      !event.currentTarget.reportValidity()
    )
      return;
    inFlight.current = true;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    try {
      await completePassword(token.current, password, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      token.current = null;
      setPassword("");
      setPhase("success");
    } catch (cause) {
      if (!alive.current || controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 429) {
        const time = Date.now();
        setNow(time);
        setRetryAt(time + (cause.retryAfterSec ?? 60) * 1000);
        setError(cause.message);
      } else {
        token.current = null;
        setPassword("");
        setPhase(
          cause instanceof ApiError && cause.status === 400
            ? "invalid"
            : "unknown",
        );
      }
    } finally {
      inFlight.current = false;
      if (alive.current && !controller.signal.aborted) setBusy(false);
    }
  };
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const title =
    phase === "success"
      ? "Пароль сохранён"
      : phase === "invalid"
        ? "Откройте ссылку из письма"
        : phase === "unknown"
          ? "Проверьте сохранение пароля"
          : "Установить пароль";
  const description =
    phase === "success"
      ? "Теперь вы можете войти в аккаунт с новым паролем."
      : phase === "invalid"
        ? "Ссылка отсутствует, недействительна или истекла. Откройте последнее письмо или запросите новую ссылку на странице входа."
        : phase === "unknown"
          ? "Результат сохранения не подтверждён. Попробуйте войти с новым паролем. Если войти не удалось, запросите новую ссылку. Повторная отправка автоматически не выполняется."
          : "Придумайте новый пароль для входа в Darcy.";

  return (
    <div className={classes.sheet}>
      <header className={classes.brand}>DARYADARCY</header>
      <main className={classes.content} aria-labelledby="password-title">
        <h1
          id="password-title"
          ref={heading}
          tabIndex={-1}
          className={controls.title}
        >
          {title}
        </h1>
        <p className={controls.subtitle}>{description}</p>
        {phase === "loading" && (
          <p role="status" className={classes.hint}>
            Открываем форму…
          </p>
        )}
        {phase === "ready" && (
          <form method="post" onSubmit={submit} aria-busy={busy}>
            <div className={controls.passwordField}>
              <Field
                id="new-password"
                ref={input}
                name="password"
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Новый пароль"
                aria-label="Новый пароль"
                placeholderColor="#8b7355"
                minLength={8}
                maxLength={200}
                required
                disabled={busy}
                value={password}
                onValueChange={setPassword}
                aria-describedby="password-hint password-result"
                className={`${controls.input} ${controls.passwordInput}`}
              />
              <Action
                aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
                aria-controls="new-password"
                aria-pressed={visible}
                disabled={busy}
                className={controls.passwordToggle}
                onPointerDown={(event) => {
                  if (event.isPrimary && event.button === 0)
                    event.preventDefault();
                }}
                onClick={() => {
                  const field = input.current;
                  selection.current =
                    field && document.activeElement === field
                      ? {
                          start: field.selectionStart ?? 0,
                          end: field.selectionEnd ?? 0,
                          direction: field.selectionDirection ?? "none",
                        }
                      : null;
                  setVisible((value) => !value);
                }}
              >
                <MaterialIcons
                  name={visible ? "visibility-off" : "visibility"}
                  size={22}
                  color="#8b7355"
                />
              </Action>
            </div>
            <p id="password-hint" className={classes.hint}>
              От 8 до 200 символов.
            </p>
            <p
              id="password-result"
              role="status"
              aria-live="polite"
              className={controls.error}
            >
              {error}
              {remaining > 0 ? ` Повторить можно через ${remaining} с.` : ""}
            </p>
            <Action
              type="submit"
              aria-label={busy ? "Сохраняем…" : "Сохранить пароль"}
              aria-busy={busy}
              disabled={busy || remaining > 0}
              className={`${controls.action2} ${classes.submit}`}
            >
              {busy && (
                <Spinner
                  size="small"
                  color="#fdf8f0"
                  label="Сохраняем пароль"
                />
              )}
              <span className={controls.buttonText}>
                {busy ? "Сохраняем…" : "Сохранить пароль"}
              </span>
            </Action>
          </form>
        )}
        <noscript>
          Для установки пароля включите JavaScript и снова откройте ссылку из
          письма.
        </noscript>
        <a
          href="/login"
          className={
            phase === "success"
              ? `ui-action ${controls.action2} ${classes.loginButton}`
              : classes.back
          }
        >
          {phase === "success" ? "Войти" : "Перейти ко входу"}
        </a>
      </main>
      <footer className={classes.footer}>
        Место для вдохновения и уютной жизни
      </footer>
    </div>
  );
}
