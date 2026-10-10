"use client";
import { useEffect, useRef, useState } from "react";
import {
  confirmEmailBinding,
  takeEmailBindingProof,
} from "@/shared/api/email-binding-confirmation";
import { ApiError, getRequestErrorMessage } from "@/shared/api/errors";
import classes from "./login-screen.module.scss";
import { Action } from "@/shared/ui/action";

type State =
  | "loading"
  | "disabled"
  | "invalid"
  | "ready"
  | "pending"
  | "confirmed"
  | "uncertain";
const enabled = process.env.NEXT_PUBLIC_MEMBER_EMAIL_BINDING_ENABLED === "true";

export default function EmailBindingScreen() {
  const token = useRef<string | null>(null);
  const captured = useRef(false);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    if (!captured.current) {
      captured.current = true;
      const proof = takeEmailBindingProof(location.hash, () => {
        history.replaceState(history.state, "", location.pathname);
      });
      token.current = enabled ? proof : null;
      setState(!enabled ? "disabled" : proof ? "ready" : "invalid");
    }
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);

  const submit = async () => {
    if (!enabled || !token.current || request.current) return;
    const task = new AbortController();
    request.current = task;
    setState("pending");
    setError("");
    try {
      await confirmEmailBinding(token.current, task.signal);
      if (!mounted.current || task.signal.aborted) return;
      token.current = null;
      setState("confirmed");
    } catch (cause) {
      if (!mounted.current || task.signal.aborted) return;
      // Even a refusal may follow an earlier committed attempt with a lost reply.
      token.current = null;
      setError(getRequestErrorMessage(cause));
      setState(
        cause instanceof ApiError && cause.status === 400
          ? "invalid"
          : "uncertain",
      );
    } finally {
      if (request.current === task) request.current = null;
    }
  };
  const message =
    error ||
    (state === "confirmed"
      ? "Почта подтверждена. Пароль и оплаченный доступ не изменились. Войдите в свой аккаунт обычным способом."
      : state === "disabled"
        ? "Подтверждение почты пока недоступно. Обратитесь к администратору."
        : state === "invalid"
          ? "Откройте ссылку из письма. После обновления страницы её нужно открыть заново."
          : state === "pending"
            ? "Проверяем подтверждение…"
            : state === "loading"
              ? "Подготавливаем страницу…"
              : "Подтвердите первую привязку почты к вашему существующему аккаунту. Это не создаёт новый аккаунт и не меняет подписку.");
  return (
    <section
      className={`ui-stack ${classes.scroll}`}
      style={{ maxWidth: 480, width: "100%", margin: "0 auto" }}
      aria-labelledby="email-binding-title"
    >
      <h1 id="email-binding-title" className={classes.title}>
        Подтверждение почты
      </h1>
      <p role="status" aria-live="polite" className={classes.subtitle}>
        {message}
      </p>
      {state === "ready" || state === "pending" ? (
        <Action
          type="button"
          className={classes.action2}
          disabled={state === "pending"}
          onClick={submit}
        >
          <span className={classes.buttonText}>Подтвердить почту</span>
        </Action>
      ) : null}
      {state === "uncertain" ? (
        <p className={classes.subtitle}>
          Ответ не подтверждён. Проверьте аккаунт через обычный вход или
          обратитесь к администратору. Для повторной попытки заново откройте
          письмо; автоматического повтора не будет.
        </p>
      ) : null}
      <a href="/login" rel="noreferrer">
        Перейти ко входу
      </a>
    </section>
  );
}
