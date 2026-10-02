import { Link } from "react-router-dom";
import { BANNERS } from "../data";

const STAMP = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/5c000c389c50-FumaYiYPevouyHwe.webp";
const COTTAGE = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/3f69fb85d89c-nbShGAsyJAWYwcXH.webp";

export default function Home() {
  const feed = BANNERS[0];
  const rest = BANNERS.slice(1);

  return (
    <div className="home">
      <section className="home-hero">
        <img src="/home/hero_header.jpg" alt="" />
        <div className="home-hero-overlay" />
        <div className="home-hero-title">DARYADARCY</div>
      </section>

      <section className="home-welcome">
        <p className="home-kicker">– ДОБРО ПОЖАЛОВАТЬ –</p>
        <p className="home-script">пространство</p>
        <p className="home-script home-script-2">вдохновения</p>
        <div className="home-welcome-body">
          <p>для тех, кто мечтает вести</p>
          <p className="italic">жизнь</p>
          <p>удивительной</p>
          <p className="italic">красоты и глубины</p>
        </div>
      </section>

      <section className="home-about">
        <div className="home-medallion">
          <img src="/home/medallion_temp.webp" alt="" />
        </div>
        <img className="home-about-bg" src="/home/about_author_bg.jpg" alt="" />
        <div className="home-about-dim" />
        <div className="home-about-copy">
          <p className="home-about-kicker">– ОБ АВТОРЕ –</p>
          <h2>Дарья Левина–</h2>
          <p>
            cottagecore-блогер,
            <br />
            автор "Книги вдохновения", "Романтика дачи"
            <br />
            и "Тропинка к творчеству".
            <br />
            Хозяйка сказочного лесного дома и сада с
            <br />
            английскими розами.
          </p>
          <Link to="/library/about" className="home-more">
            узнать больше →
          </Link>
        </div>
      </section>

      <Link to="/shop" className="home-book">
        <div className="home-book-frame">
          <img src="/home/book_olive.webp" alt="" />
          <div className="home-book-text">
            <p className="home-quote">
              «Все великие дела тесно
              <br />
              переплетаются с маленькими»
            </p>
            <p className="home-quote-author">
              Люси Мод Монтгомери
              <br />
              "Энн из Зелёных крыш"
            </p>
            <img className="home-cottage" src={COTTAGE} alt="" />
            <p className="home-book-hint">мои книги →</p>
          </div>
        </div>
      </Link>

      <div className="home-stamps">
        <img src={STAMP} alt="" />
      </div>

      <section className="home-explore">
        <p className="home-kicker">– ИССЛЕДУЙТЕ –</p>
        <Link to={feed.to} className="postcard">
          <div className="postcard-photo">
            <img src={feed.image} alt="" />
          </div>
          <div className="postcard-text">
            <p>{feed.subtitle}</p>
            <span className="postcard-arrow">→</span>
          </div>
        </Link>
      </section>

      <section className="home-banners">
        {rest.map((banner) => (
          <Link key={banner.id} to={banner.to} className="postcard">
            <div className="postcard-photo">
              <img src={banner.image} alt="" />
            </div>
            <div className="postcard-text">
              <p>{banner.subtitle}</p>
              <span className="postcard-arrow">→</span>
            </div>
          </Link>
        ))}
      </section>

      <section className="home-letter">
        <p className="italic">Дорогой друг,</p>
        <p>
          Это приложение — моё письмо к тебе. Здесь собрано всё, что я хочу разделить: вдохновение, знания, творчество и тепло. Заходи, располагайся, чувствуй себя как дома.
        </p>
        <p className="home-sign">С любовью, Дарья ♡</p>
      </section>

      <footer className="home-footer">
        <div className="home-div">
          <span />
          ✿
          <span />
        </div>
        <p>slow living & vintage aesthetic</p>
      </footer>
    </div>
  );
}
