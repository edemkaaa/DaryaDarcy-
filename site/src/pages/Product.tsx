import { Link, useParams } from "react-router-dom";
import { PRODUCTS } from "../data";

export default function Product() {
  const { id } = useParams();
  const product = PRODUCTS.find((item) => item.id === id);

  if (!product) {
    return (
      <div className="page">
        <p className="error">Товар не найден</p>
        <Link to="/shop">← магазин</Link>
      </div>
    );
  }

  return (
    <div className="page article">
      <Link to="/shop" className="muted">← магазин</Link>
      <img src={product.imageUrl} alt="" />
      <p className="kicker">{product.type === "book" ? "книга" : "цифровой продукт"}</p>
      <h2>{product.title}</h2>
      <p className="lead">{product.subtitle}</p>
      <p style={{ whiteSpace: "pre-wrap" }}>{product.description}</p>
      {product.price ? <p className="price">{product.price}</p> : null}
      {product.details?.length ? (
        <ul className="muted">
          {product.details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      <div className="stack">
        {product.links.map((link) => (
          <a key={link.url} className="btn" href={link.url} target="_blank" rel="noreferrer">
            {link.name}
          </a>
        ))}
      </div>
    </div>
  );
}
