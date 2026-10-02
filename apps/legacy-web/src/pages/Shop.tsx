import { Link } from "react-router-dom";
import { PRODUCTS } from "../data";

export default function Shop() {
  return (
    <div className="page">
      <h2>Магазин</h2>
      <div className="grid" style={{ marginTop: 14 }}>
        {PRODUCTS.map((product) => (
          <Link key={product.id} to={`/shop/${product.id}`} className="product-card">
            <img src={product.imageUrl} alt="" loading="lazy" />
            <div className="caption">
              <strong>{product.title}</strong>
              <div className="muted">{product.subtitle}</div>
              {product.price ? <div>{product.price}</div> : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
