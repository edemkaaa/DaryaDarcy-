import type { ViewportSize } from "@/shared/browser/viewport";

export const PAPER_TEXTURE_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
export const CLUB_BANNER_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9e3aec1f0a5d-PUMBhecZrXmmctyT.jpg";
export const BROWN = "#5C4033";
export const BROWN_MUTED = "#8B7355";
export const CREAM = "#FDF8F0";
export const OLIVE = "#6B7B5E";

export const LETTER_CAROUSEL_IMAGES = [
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d41da8bb49e5-qtTdhxTQTceQjglS.jpeg",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/248794a7bd51-TGjGBKCtCDaiNEGA.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d4c9b66fca3b-SRsjwrPhBzgdUgKP.png",
];
export const EXCLUSIVE_CAROUSEL_IMAGES = [
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1d28efefb09b-mlHctAbwrdujnkAl.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8d13aefa8185-IZEbDdSSzwHYlZJi.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/0479fc01d16a-MSbIPSMMSqmZweYd.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/2c8069c13604-UBeEtDCkYYkHKSKN.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/234b0e0452ba-vVFccXYZXhHdnGCR.png",
];
export const GIVEAWAY_CAROUSEL_IMAGES = [
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8e13a3ec38f0-KFvjVaUAsIOcwZxo.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/7362db96b0a1-JGyvReRkTzKEFEru.png",
];
export const COMMUNITY_CAROUSEL_IMAGES = [
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/0c95d509c862-oewXdFleqUUvImKT.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/75d234e719e4-qRZzKsNlaPRjMabP.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/80167c1dcc6f-vSlkTezTOrkVQWvB.png",
];
export const PODBORKI_CAROUSEL_IMAGES = [
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d7d902b3580b-ibiaXiTZueqqzkwU.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/50e90f364a43-MrKdMmoQWEKpOoxG.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4421e2915127-MHSQScqFnuIJSihl.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4f6a6814aa8b-mTIjouFpTLtMeseC.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/250423a7ec62-uyAaCmBzfqhlMwpt.PNG",
];
export const REVIEWS_CAROUSEL_IMAGES = [
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d7c6da7c51eb-ajKAgiYmRhdfjrvA.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/01ac0596761e-CpXcSOXRRuKDFbNs.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b0256e249003-fTvlKJxwwRXhliWp.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/77be05fab34c-HWbDueWsSqSewhtK.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a1a591be13aa-AZYAKPGUhWakANOo.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1a03ee114023-cCbdKIZtJmsSzKzg.png",
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
