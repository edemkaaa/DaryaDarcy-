import { Link } from "react-router-dom";
import { ABOUT_PHOTOS } from "../data";

export default function About() {
  return (
    <div className="page article">
      <Link to="/library" className="muted">← библиотека</Link>
      <p className="kicker">– об авторе –</p>
      <h2>Дарья Левина</h2>
      <p>
        Cottagecore-блогер, автор «Книги вдохновения», «Романтики дачи» и «Тропинки к творчеству». Хозяйка лесного дома и сада с английскими розами.
      </p>
      <div className="about-gallery">
        {ABOUT_PHOTOS.map((src) => (
          <img key={src} src={src} alt="" loading="lazy" />
        ))}
      </div>
      <p>
        Если бы мне в детстве показали, каким будет моё будущее, я бы очень удивилась. Все детские увлечения — творчество, перевоплощения, сказки, дизайн, мода, фотография — слились в одну профессию.
      </p>
      <p>
        Блог daryadarcy начался как пространство сезонной красоты: стилизации, рецепты, дом и сад. Потом появились книги, YouTube и клуб — камерное сообщество, где можно быть ближе и получать больше.
      </p>
    </div>
  );
}
