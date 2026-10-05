import type { ImageSource } from "expo-image";

/** Home promo carousel: Club → Quiz → Feed. PNG alpha on paper (see HomePromoCarousel). */
export const HOME_PROMO_SLIDES = [
  {
    id: "club",
    route: "/(tabs)/club" as const,
    label: "Клуб Darcy",
    image: require("@/assets/images/home/promo/promo-club.webp") as ImageSource,
  },
  {
    id: "quiz",
    route: "/quiz" as const,
    label: "Тест на эстетику",
    image: require("@/assets/images/home/promo/promo-quiz.webp") as ImageSource,
  },
  {
    id: "feed",
    route: "/(tabs)/feed" as const,
    label: "Лента",
    image: require("@/assets/images/home/promo/promo-feed.webp") as ImageSource,
  },
] as const;

export type HomePromoSlide = (typeof HOME_PROMO_SLIDES)[number];

/** 1024×577 source art */
export const HOME_PROMO_ASPECT = 577 / 1024;
