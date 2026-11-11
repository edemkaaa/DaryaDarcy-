/** Архивный статический каталог Библиотеки. Прямые ссылки здесь не являются текущим контрактом защищённой выдачи. */
import { Link } from "react-router-dom";
import { LIBRARY } from "../data";

/** Выбирает внешнюю ссылку или внутренний маршрут по данным старого каталога; пометка club имеет только визуальный смысл. */
export default function Library() {
  return (
    <div className="page">
      <h2>Библиотека</h2>
      <p className="muted">Бесплатные материалы и клубные гиды.</p>
      <div className="grid" style={{ marginTop: 14 }}>
        {LIBRARY.map((item) => {
          const inner = (
            <>
              <img src={item.cover} alt="" loading="lazy" />
              <div className="caption">
                {item.title}
                {item.club ? <div className="muted">клуб</div> : null}
              </div>
            </>
          );
          if (item.external) {
            return (
              <a key={item.id} className="product-card" href={item.href} target="_blank" rel="noreferrer">
                {inner}
              </a>
            );
          }
          return (
            <Link key={item.id} className="product-card" to={item.href}>
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
