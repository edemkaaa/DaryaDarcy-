import { Link } from "react-router-dom";

export default function Interactive() {
  return (
    <div className="page">
      <p className="kicker">ИНТЕРАКТИВ</p>
      <h2>Тесты, игры, творческие задания</h2>
      <Link to="/quiz" className="banner" style={{ marginTop: 16 }}>
        <img
          src="https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/6ac128a122fc-aEjJLmnJbZuksHiz.jpg"
          alt=""
        />
        <div className="banner-body">
          <h3>Тест-путешествие</h3>
          <p>Узнай свою эстетику через атмосферное путешествие по сказочным мирам</p>
        </div>
      </Link>
      <div className="banner" style={{ marginTop: 12, opacity: 0.72 }}>
        <img
          src="https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/597ab82580a0-GDVbsOSXBYgogKWH.jpg"
          alt=""
        />
        <div className="banner-body">
          <h3>Мудборд</h3>
          <p>Собери свою доску вдохновения — скоро</p>
        </div>
      </div>
    </div>
  );
}
