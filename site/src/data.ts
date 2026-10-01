export const BANNERS = [
  {
    id: "feed",
    title: "Лента",
    subtitle: "Блог о загородной жизни, винтажном стиле и вдохновении",
    to: "/feed",
    image: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/cc53a49e1416-qxGDcExHmMNZuoWc.jpg",
  },
  {
    id: "club",
    title: "Клуб Darcy",
    subtitle: "Камерное сообщество с эксклюзивными материалами",
    to: "/club",
    image: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/597ab82580a0-GDVbsOSXBYgogKWH.jpg",
  },
  {
    id: "interactive",
    title: "Интерактив",
    subtitle: "Тесты, игры, творческие задания",
    to: "/interactive",
    image: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/6ac128a122fc-aEjJLmnJbZuksHiz.jpg",
  },
  {
    id: "library",
    title: "Библиотека",
    subtitle: "Бесплатные материалы: выкройки, сборники, плейлисты",
    to: "/library",
    image: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/7e8f673737d1-bGwFUQjrxWpTxAMM.jpg",
  },
  {
    id: "shop",
    title: "Магазин",
    subtitle: "Печатные книги, электронные пособия и другие продукты",
    to: "/shop",
    image: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8283ecb861ab-BSgzKdVEmubRcHjZ.jpg",
  },
] as const;

export const DEFAULT_TAGS = [
  { slug: "all", label: "Все" },
  { slug: "spring", label: "Весна" },
  { slug: "summer", label: "Лето" },
  { slug: "autumn", label: "Осень" },
  { slug: "winter", label: "Зима" },
  { slug: "home", label: "Дом" },
  { slug: "garden", label: "Сад" },
  { slug: "kino", label: "Кино" },
  { slug: "video", label: "Видео" },
  { slug: "recipes", label: "Рецепты" },
  { slug: "styling", label: "Стилизации" },
  { slug: "masterclass", label: "Мастер-классы" },
  { slug: "travel", label: "Путешествия" },
  { slug: "personal", label: "Личное" },
  { slug: "kids", label: "Детское" },
  { slug: "dacha", label: "Дача" },
  { slug: "books", label: "Книги" },
  { slug: "creativity", label: "Творчество" },
];

export const CLUB_BANNER =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9e3aec1f0a5d-PUMBhecZrXmmctyT.jpg";

export const CLUB_BENEFITS = [
  { title: "Письмо месяца", description: "Личное письмо от Дарьи с историями, размышлениями и рекомендациями" },
  { title: "Подборки", description: "Стиль, дом, подарки, кино — со ссылками на доступные магазины и маркетплейсы" },
  { title: "Эксклюзивные материалы", description: "Статьи, видео, подкасты" },
  { title: "Доброе комьюнити", description: "Каждую среду — день общения, поддержки и тёплых разговоров" },
  { title: "Розыгрыши", description: "Каждый месяц — атмосферный подарок для одной из вас" },
];

export type Product = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  price: string;
  imageUrl: string;
  type: "book" | "digital";
  links: { name: string; url: string }[];
  details?: string[];
};

export const PRODUCTS: Product[] = [
  {
    id: "book-1",
    title: "Книга Вдохновения",
    subtitle: "Сезонные рецепты, стиль и идеи домашнего декора",
    description:
      "Путеводитель по миру Slow Living. Сезонные рецепты, стиль, идеи домашнего декора и вдохновение на каждое время года.",
    price: "",
    imageUrl: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b8106c44719f-tlMfbAYBCxFjOQfm.webp",
    type: "book",
    links: [
      { name: "Ozon", url: "https://ozon.ru/t/1fcfQng" },
      { name: "Wildberries", url: "https://www.wildberries.ru/catalog/41571054/detail.aspx?size=83497342" },
    ],
    details: ["Формат: 25.5 × 19.7 см", "Твёрдая обложка", "Полноцветная печать"],
  },
  {
    id: "book-2",
    title: "Романтика Дачи",
    subtitle: "Традиции прошлого и уютная загородная жизнь",
    description:
      "Книга о загородной жизни, традициях прошлого, детских воспоминаниях и уютной загородной жизни настоящего.",
    price: "",
    imageUrl: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/94b5bebfd7f4-IbTlGDtcIAJBcJAR.webp",
    type: "book",
    links: [
      { name: "Ozon", url: "https://ozon.ru/t/j7o7PNl" },
      { name: "Wildberries", url: "https://www.wildberries.ru/catalog/149198904/detail.aspx?size=250442622" },
    ],
    details: ["Формат: 25.5 × 19.7 см", "Твёрдая обложка", "Полноцветная печать"],
  },
  {
    id: "book-3",
    title: "Тропинка к Творчеству",
    subtitle: "Рукотворная уютная жизнь",
    description: "Новая книга от Дарьи Дарси о рукотворной уютной жизни. Вдохновение, творчество и красота в каждом дне.",
    price: "",
    imageUrl: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/13d6a513f39b-nJGBnjSsHvYTlKyD.webp",
    type: "book",
    links: [
      { name: "Ozon", url: "https://ozon.ru/t/7GNGr2o" },
      { name: "Wildberries", url: "https://www.wildberries.ru/catalog/583300940/detail.aspx?size=797386247" },
    ],
    details: ["Формат: 25.5 × 19.7 см", "Твёрдая обложка", "Полноцветная печать"],
  },
  {
    id: "digital-1",
    title: "Пособие по атмосферной фотографии",
    subtitle: "Электронная книга-курс в формате PDF",
    description: "Курс о свете, композиции, цвете, реквизите и обработке — простым языком, с авторскими примерами.",
    price: "50 ₽",
    imageUrl: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/76751795802b-cvPWAEJjkmXMKPjM.webp",
    type: "digital",
    links: [{ name: "Оплатить 50 ₽", url: "https://daryadarcy.com/api/pay/digital-1" }],
    details: ["Формат: PDF", "Цифровой продукт"],
  },
  {
    id: "digital-2",
    title: "Винтажные книги и открытки",
    subtitle: "Мастер-класс по созданию «старинных» книг",
    description: "Пошаговая инструкция, сотни обложек и открыток для печати, идеи для декора и съёмок.",
    price: "50 ₽",
    imageUrl: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b573a5cea177-nNMSLpNDmzQdnfqe.webp",
    type: "digital",
    links: [{ name: "Оплатить 50 ₽", url: "https://daryadarcy.com/api/pay/digital-2" }],
    details: ["Формат: PDF", "Цифровой продукт"],
  },
];

export const LIBRARY = [
  {
    id: "about-me",
    title: "Обо мне",
    cover: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fbca647058b-LvxZFiaBWuJSsIgj.JPG",
    href: "/library/about",
    club: false,
  },
  {
    id: "stilizacii",
    title: "Сборник стилизаций",
    cover: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/3b8642166933-rdRVzYWvuGEmSUdF.jpeg",
    href: "https://disk.yandex.ru/i/Y-XvbPF-NwOiLg",
    club: false,
    external: true,
  },
  {
    id: "loshadka",
    title: "Лошадка-качалка",
    cover: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/library/loshadka-cover.jpg",
    href: "https://disk.yandex.ru/i/nDfsd5ptLO1xRA",
    club: false,
    external: true,
  },
  {
    id: "aesthetics",
    title: "Гид по эстетикам",
    cover: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/47ae04f69998-VjKNaGyYogjUkMPQ.jpeg",
    href: "/club",
    club: true,
  },
  {
    id: "recipes",
    title: "Сборник рецептов",
    cover: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/877a6c2a49ef-JZjLEpuxmhqHszUD.jpg",
    href: "https://disk.yandex.ru/i/nUoIS8gQ5VkClA",
    club: true,
    external: true,
  },
  {
    id: "peterburg",
    title: "Гид по Петербургу",
    cover: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/925076516046-CkdCchNXtpJkPNVd.JPG",
    href: "https://disk.yandex.ru/d/BM0uzv2cWZeM0Q",
    club: true,
    external: true,
  },
  {
    id: "patterns",
    title: "Зимние выкройки'26",
    cover: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4327bffa91b1-TRkGduziKBAAVhso.jpg",
    href: "/club",
    club: true,
  },
];

export const ABOUT_PHOTOS = [
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fbca647058b-LvxZFiaBWuJSsIgj.JPG",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/90e0ee86a4ff-kMJdEKDrnBTzTyzP.JPG",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d2e7c03c6f36-CAbMTXzGTiRynQvA.jpeg",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9503c81d3711-gFvZsxUUAlJFJQPJ.JPG",
];
