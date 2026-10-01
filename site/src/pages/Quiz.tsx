import { Link } from "react-router-dom";

export default function Quiz() {
  return (
    <div className="page">
      <Link to="/interactive" className="muted">← интерактив</Link>
      <p className="kicker">ТЕСТ</p>
      <h2>Какая твоя сказка?</h2>
      <p className="lead">
        Полный тест с десятками вопросов скоро вернётся в эту быструю версию сайта. Сейчас можно читать ленту, смотреть видео и заглянуть в магазин.
      </p>
    </div>
  );
}
