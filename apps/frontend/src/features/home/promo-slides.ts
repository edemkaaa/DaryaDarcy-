"use client";
/** Порядок промо-слайдов и их маршруты задаются данными, чтобы карусель не дублировала правила переходов. */
import type { ImageSource } from "@/shared/media/image";
/** Home promo carousel: Club → Quiz → Feed. PNG alpha on paper (see HomePromoCarousel). */
export const HOME_PROMO_SLIDES = [
  {
    id: "club",
    route: "/club" as const,
    label: "Клуб Darcy",
    image: { uri: "/assets/images/home/promo/promo-club.webp" } as ImageSource,
  },
  {
    id: "quiz",
    route: "/quiz" as const,
    label: "Тест на эстетику",
    image: { uri: "/assets/images/home/promo/promo-quiz.webp" } as ImageSource,
  },
  {
    id: "feed",
    route: "/feed" as const,
    label: "Лента",
    image: { uri: "/assets/images/home/promo/promo-feed.webp" } as ImageSource,
  },
] as const;
export type HomePromoSlide = (typeof HOME_PROMO_SLIDES)[number];
/** 1024×577 source art */
export const HOME_PROMO_ASPECT = 577 / 1024;
