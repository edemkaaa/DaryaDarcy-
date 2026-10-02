import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import {
  EMAIL_REGISTER_CONSENT_LABEL,
  EMAIL_REGISTER_CONSENT_VERSION,
} from "../../../../shared/consent-texts";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (mode === "register" && !consentChecked) {
      setError("Подтвердите согласие на обработку персональных данных");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name, EMAIL_REGISTER_CONSENT_VERSION);
      navigate("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page login-page">
      <p className="kicker">DARYADARCY</p>
      <h2>{mode === "login" ? "Вход" : "Регистрация"}</h2>
      <p className="muted">
        {mode === "login"
          ? "Войдите, чтобы сохранять посты и пользоваться клубом"
          : "Создайте аккаунт по email"}
      </p>
      <form className="stack" onSubmit={onSubmit}>
        {mode === "register" ? (
          <input className="field" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} />
        ) : null}
        <input
          className="field"
          placeholder="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="field"
          placeholder="Пароль"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {mode === "register" ? (
          <label className="consent-row">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
            />
            <span>{EMAIL_REGISTER_CONSENT_LABEL}</span>
          </label>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit" disabled={busy || (mode === "register" && !consentChecked)}>
          {busy ? "…" : mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>
      </form>
      {mode === "register" ? (
        <p className="muted">
          <Link to="/privacy">Политика конфиденциальности</Link>
        </p>
      ) : null}
      <button
        className="btn ghost"
        type="button"
        onClick={() => {
          setConsentChecked(false);
          setMode(mode === "login" ? "register" : "login");
        }}
      >
        {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
      </button>
      <Link to="/" className="muted">Назад</Link>
    </div>
  );
}
