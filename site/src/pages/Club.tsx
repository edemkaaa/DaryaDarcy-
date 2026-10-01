import { CLUB_BANNER, CLUB_BENEFITS } from "../data";
import { useAuth } from "../auth";
import { Link } from "react-router-dom";

export default function Club() {
  const { user } = useAuth();

  return (
    <div className="page">
      <div className="hero" style={{ margin: "0 0 16px", borderRadius: 14, minHeight: 200, height: "28vh" }}>
        <img src={CLUB_BANNER} alt="" />
      </div>
      <h2>Клуб Darcy</h2>
      <p className="lead">
        Безопасное пространство для тех, кому важна красота в жизни, а не только на экране.
      </p>
      <p className="muted">
        Творческая атмосфера, доброе комьюнити, эксклюзивные материалы и подборки от Дарьи.
      </p>
      <h3 className="section-title">Что входит в подписку</h3>
      <div className="stack">
        {CLUB_BENEFITS.map((item) => (
          <div key={item.title} className="benefit">
            <strong>{item.title}</strong>
            <p className="muted">{item.description}</p>
          </div>
        ))}
      </div>
      <div className="price-card">
        <p className="muted">Ежемесячная подписка</p>
        <p className="price">50 ₽ <span className="muted">/ тест</span></p>
        {user ? (
          <p className="muted">Оплата подписки подключается отдельно. Пока вы можете пользоваться открытыми разделами.</p>
        ) : (
          <Link className="btn" to="/login">Войти, чтобы вступить</Link>
        )}
        <p className="muted">отмена в любой момент</p>
      </div>
    </div>
  );
}
