/** Ресурсы и подписи страницы Клуба отделены от компонентов; изменение этих данных входит в клиентскую сборку. */
import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.fe3ce71852fa6634.webp";
export const CLUB_BANNER_URL =
  "/assets/responsive/9e3aec1f0a5d-PUMBhecZrXmmctyT.w1000.bd9000e76cd109c4.webp";
export const BROWN = "#5C4033";
export const BROWN_MUTED = "#8B7355";
export const CREAM = "#FDF8F0";
export const OLIVE = "#6B7B5E";

export const LETTER_CAROUSEL_IMAGES = [
  "/assets/responsive/d41da8bb49e5-qtTdhxTQTceQjglS.w1200.0a8117780a7ea503.webp",
  "/assets/responsive/248794a7bd51-TGjGBKCtCDaiNEGA.w1440.a7640d99e2f0dc6a.webp",
  "/assets/responsive/d4c9b66fca3b-SRsjwrPhBzgdUgKP.w1440.be2b100a48cab274.webp",
];
export const EXCLUSIVE_CAROUSEL_IMAGES = [
  "/assets/responsive/1d28efefb09b-mlHctAbwrdujnkAl.w1440.cd35e620916a5f65.webp",
  "/assets/responsive/8d13aefa8185-IZEbDdSSzwHYlZJi.w1440.4de4aedd472b7ca1.webp",
  "/assets/responsive/0479fc01d16a-MSbIPSMMSqmZweYd.w1440.0148c5c158de2bbd.webp",
  "/assets/responsive/2c8069c13604-UBeEtDCkYYkHKSKN.w1440.cfcef2454b28abe1.webp",
  "/assets/responsive/234b0e0452ba-vVFccXYZXhHdnGCR.w1440.4eab432038d77b7d.webp",
];
export const GIVEAWAY_CAROUSEL_IMAGES = [
  "/assets/responsive/8e13a3ec38f0-KFvjVaUAsIOcwZxo.w1440.2fb5df6c08b2c9de.webp",
  "/assets/responsive/7362db96b0a1-JGyvReRkTzKEFEru.w1440.cc79e74444c26f7f.webp",
];
export const COMMUNITY_CAROUSEL_IMAGES = [
  "/assets/responsive/0c95d509c862-oewXdFleqUUvImKT.w1440.c34d124a0a3d6f02.webp",
  "/assets/responsive/75d234e719e4-qRZzKsNlaPRjMabP.w1440.d9347026598f2710.webp",
  "/assets/responsive/80167c1dcc6f-vSlkTezTOrkVQWvB.w1440.d8aa6e0467e86a4e.webp",
];
export const PODBORKI_CAROUSEL_IMAGES = [
  "/assets/responsive/d7d902b3580b-ibiaXiTZueqqzkwU.w1440.2775b62918c1b6f2.webp",
  "/assets/responsive/50e90f364a43-MrKdMmoQWEKpOoxG.w1424.1f64a7cd1ae0682c.webp",
  "/assets/responsive/4421e2915127-MHSQScqFnuIJSihl.w1440.0f14ed65a9d11493.webp",
  "/assets/responsive/4f6a6814aa8b-mTIjouFpTLtMeseC.w1440.1fc2b9b69a170855.webp",
  "/assets/responsive/250423a7ec62-uyAaCmBzfqhlMwpt.w1320.6278c063751621bd.webp",
];
export const REVIEWS_CAROUSEL_IMAGES = [
  "/assets/responsive/d7c6da7c51eb-ajKAgiYmRhdfjrvA.w1440.4d7b1ec2a3e39ec4.webp",
  "/assets/responsive/01ac0596761e-CpXcSOXRRuKDFbNs.w1440.78fe8b8efc71432d.webp",
  "/assets/responsive/b0256e249003-fTvlKJxwwRXhliWp.w1440.b608d77d92690dac.webp",
  "/assets/responsive/77be05fab34c-HWbDueWsSqSewhtK.w1440.4d6ccb0ecbf1ec72.webp",
  "/assets/responsive/a1a591be13aa-AZYAKPGUhWakANOo.w1440.7a50b1614ced8602.webp",
  "/assets/responsive/1a03ee114023-cCbdKIZtJmsSzKzg.w1440.ccebb507fe42227f.webp",
];
export const REVIEWS_SLIDES: {
  type: "single" | "double";
  images: string[];
}[] = [
  { type: "single", images: [REVIEWS_CAROUSEL_IMAGES[0]] },
  { type: "single", images: [REVIEWS_CAROUSEL_IMAGES[1]] },
  { type: "single", images: [REVIEWS_CAROUSEL_IMAGES[2]] },
  {
    type: "double",
    images: [REVIEWS_CAROUSEL_IMAGES[3], REVIEWS_CAROUSEL_IMAGES[4]],
  },
  { type: "single", images: [REVIEWS_CAROUSEL_IMAGES[5]] },
];
export interface Benefit {
  icon: string;
  title: string;
  description: string;
}
export const BENEFITS: Benefit[] = [
  {
    icon: "mail-outline",
    title: "Письмо месяца",
    description:
      "Личное письмо от Дарьи с историями, размышлениями и рекомендациями",
  },
  {
    icon: "collections-bookmark",
    title: "Подборки",
    description:
      "Стиль, дом, подарки, кино — со ссылками на доступные магазины и маркетплейсы",
  },
  {
    icon: "auto-awesome",
    title: "Эксклюзивные материалы",
    description: "Статьи, видео, подкасты",
  },
  {
    icon: "forum",
    title: "Доброе комьюнити",
    description:
      "Каждую среду \u2013 день общения, поддержки и\nтеплых разговоров",
  },
  {
    icon: "card-giftcard",
    title: "Розыгрыши",
    description: "Каждый месяц \u2013 атмосферный подарок\nдля одной из вас",
  },
];
export interface ClubPost {
  id: string;
  title: string;
  preview: string;
  date: string;
  type: "letter" | "broadcast" | "discussion" | "exclusive";
}
export const CLUB_POSTS: ClubPost[] = [
  {
    id: "cp1",
    title: "Письмо апреля: О красоте несовершенства",
    preview:
      "Этот месяц научил меня видеть красоту в том, что раньше казалось недостатком...",
    date: "20 апреля 2026",
    type: "letter",
  },
  {
    id: "cp2",
    title: "Эфир: Весенняя уборка с душой",
    preview: "Запись эфира о том, как превратить уборку в медитативный ритуал",
    date: "18 апреля 2026",
    type: "broadcast",
  },
  {
    id: "cp3",
    title: "Обсуждение: Ваш любимый уголок дома",
    preview:
      "Делитесь фотографиями и историями о самом уютном месте в вашем доме",
    date: "15 апреля 2026",
    type: "discussion",
  },
  {
    id: "cp4",
    title: "Эксклюзив: Рецепт бабушкиного пирога",
    preview: "Семейный рецепт, который передаётся из поколения в поколение",
    date: "12 апреля 2026",
    type: "exclusive",
  },
];
export const TYPE_ICONS: Record<string, string> = {
  letter: "mail",
  broadcast: "videocam",
  discussion: "forum",
  exclusive: "auto-awesome",
};
export const TYPE_LABELS: Record<string, string> = {
  letter: "Письмо",
  broadcast: "Эфир",
  discussion: "Обсуждение",
  exclusive: "Эксклюзив",
};

export function getClubScreenContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH } = viewport;
  return { SCREEN_WIDTH };
}
