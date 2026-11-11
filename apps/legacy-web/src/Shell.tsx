/** Архивная оболочка Vite: общая шапка, вложенный маршрут и нижние вкладки. */
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./auth";

const TABS = [
  { to: "/feed", label: "Лента", icon: IconNews },
  { to: "/videos", label: "Видео", icon: IconPlay },
  { to: "/club", label: "Клуб", icon: IconStar },
  { to: "/interactive", label: "Интерактив", icon: IconSpark },
  { to: "/library", label: "Библиотека", icon: IconBook },
  { to: "/shop", label: "Магазин", icon: IconBag },
];

/** Декоративная SVG-иконка Ленты; название раздела остаётся текстом ссылки. */
function IconNews({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M4 6h12v2H4V6zm0 4h12v2H4v-2zm0 4h8v2H4v-2zm14-8h2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6h2v12h12V6z" />
    </svg>
  );
}
/** Декоративная SVG-иконка каталога Видео с цветом текущего состояния вкладки. */
function IconPlay({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}
/** Декоративная SVG-иконка Клуба; права доступа она не определяет. */
function IconStar({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M12 2.5 14.9 9l6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 21l1.2-6.5L2.5 9.9 9.1 9 12 2.5z" />
    </svg>
  );
}
/** Декоративная SVG-иконка Интерактива. */
function IconSpark({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M12 2l1.2 6.3L19 8l-4.6 3.4L16 18l-4-3.2L8 18l1.6-6.6L5 8l5.8-.7L12 2zm7 11 .7 3.2L23 17l-3.2.6L19 21l-.8-3.4L15 17l3.2-.8L19 13z" />
    </svg>
  );
}
/** Декоративная SVG-иконка Библиотеки. */
function IconBook({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 0-2 2V4zm2 2v12.5A3.5 3.5 0 0 1 9.5 18H17V6H8z" />
    </svg>
  );
}
/** Декоративная SVG-иконка Магазина. */
function IconBag({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M7 8V6a5 5 0 0 1 10 0v2h3v13H4V8h3zm2 0h6V6a3 3 0 0 0-6 0v2z" />
    </svg>
  );
}
/** Рисует значок главной; доступное название задаётся кнопкой снаружи. */
function IconHome({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M12 3 4 10h2v10h5v-6h2v6h5V10h2L12 3z" />
    </svg>
  );
}
/** Рисует значок аккаунта; переход на профиль или вход выбирает оболочка. */
function IconPerson({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c1.4-3.2 3.7-4.8 6.5-4.8s5.1 1.6 6.5 4.8" />
    </svg>
  );
}

/** На главной использует светлую шапку поверх изображения; остальные экраны получают обычную шапку. Навигация аккаунта зависит от старого AuthProvider. */
export function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isHome = location.pathname === "/";
  const headerColor = isHome ? "rgba(255,255,255,0.9)" : "#5C4033";

  return (
    <div className="app">
      <header className={isHome ? "topbar topbar-overlay" : "topbar topbar-solid"}>
        <button className="icon-btn" aria-label="Домой" onClick={() => navigate("/")}>
          <IconHome color={headerColor} />
        </button>
        <button
          className="icon-btn"
          aria-label={user ? "Профиль" : "Войти"}
          onClick={() => navigate(user ? "/profile" : "/login")}
        >
          <IconPerson color={headerColor} />
        </button>
      </header>
      <main>
        <Outlet />
      </main>
      <nav className="tabs">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
            {({ isActive }) => (
              <>
                <tab.icon color={isActive ? "#5C4033" : "#8B7355"} />
                {tab.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
