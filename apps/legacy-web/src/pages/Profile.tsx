import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Profile() {
  const { user, loading, logout } = useAuth();

  if (loading) return <div className="page muted">Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="page">
      <h2>Профиль</h2>
      <p className="lead">{user.name || "Гостья"}</p>
      <p className="muted">{user.email}</p>
      {user.role === "admin" ? <p className="muted">администратор</p> : null}
      <div className="stack" style={{ marginTop: 20 }}>
        <Link className="btn ghost" to="/feed">К ленте</Link>
        <button className="btn" type="button" onClick={() => logout()}>
          Выйти
        </button>
      </div>
    </div>
  );
}
