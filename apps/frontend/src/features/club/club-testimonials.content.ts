/** Ресурсы и подписи отзывов о Клубе отделены от компонентов; изменение этих данных входит в клиентскую сборку. */
import {
  COMMUNITY_CAROUSEL_IMAGES,
  REVIEWS_CAROUSEL_IMAGES,
} from "./club-screen.content";

export interface ClubTestimonial {
  id: string;
  author?: string;
  quote: string;
  source: string;
  sourceLabel: string;
}

// Verbatim excerpts of the existing public screenshots, not rewritten endorsements.
// Names are shown only when visible in the original. Full screenshots stay linked.
export const COMMUNITY_TESTIMONIALS: readonly ClubTestimonial[] = [
  {
    id: "irina",
    author: "Ирина Ячменева",
    quote:
      "Даша, добрый день! Я так скучала без нашего клуба ! Даже не так проходил день, потому что не было ощущения принадлежности к миру единомышленниц",
    source: COMMUNITY_CAROUSEL_IMAGES[0],
    sourceLabel: "Оригинал отзыва Ирины Ячменевой",
  },
  {
    id: "inspiration",
    quote:
      "Так приятно сюда заходить каждый раз! Вдохновляться, наслаждаться фото и черпать новые идеи ❤️❤️❤️ Дарья, спасибо большое, что делитесь своим миром с нами 🫶",
    source: COMMUNITY_CAROUSEL_IMAGES[1],
    sourceLabel: "Оригинал отзыва о вдохновении",
  },
  {
    id: "connection",
    quote:
      "Много всего полезного нашла в этом пространстве, созданном вами ✨ Познакомилась с Леной, родом с одной республики - земляки ) хоть и не виделись ещё вживую, но это очень понятное общение по переписке.",
    source: COMMUNITY_CAROUSEL_IMAGES[2],
    sourceLabel: "Оригинал отзыва об общении",
  },
];

export const CLUB_TESTIMONIALS: readonly ClubTestimonial[] = [
  {
    id: "quiet",
    quote:
      "Для меня клуб– это возможность побыть наедине с собой, в другом мире, где в саду живут прекрасные феи, всегда спокойно и можно расслабиться, уйти от своих проблем. Похоже на место силы, откуда я ухожу окрылённая и счастливая!",
    source: REVIEWS_CAROUSEL_IMAGES[0],
    sourceLabel: "Оригинал отзыва о клубном пространстве",
  },
  {
    id: "polina",
    author: "Полина",
    quote:
      "Давно подписана на Вас, Дарья, но только сейчас вступила в клуб, и очень этому рада! С нетерпением жду новых постов и жалею, что не сделала этого раньше... 💔",
    source: REVIEWS_CAROUSEL_IMAGES[1],
    sourceLabel: "Оригинал отзыва Полины",
  },
  {
    id: "home",
    quote:
      "Дашенька, наш клуб- сплошное вдохновение! Какой бы темы Вы ни коснулись- все превращаются в драгоценности! Черпаю идеи для дома, сада, гардероба, ухода за собой, т.к. очень близко Ваше отношение к жизни.",
    source: REVIEWS_CAROUSEL_IMAGES[2],
    sourceLabel: "Оригинал отзыва об идеях для дома",
  },
  {
    id: "creativity",
    quote:
      "Даша, спасибо за Ваш клуб, и вообще за все Ваше творчество🥰❤️✨ Меня постоянно Вы вдохновляете на красоту 🌷 и вдохновили именно Вы - начать свой блог😍",
    source: REVIEWS_CAROUSEL_IMAGES[3],
    sourceLabel: "Оригинал отзыва о творчестве",
  },
  {
    id: "gifts",
    quote:
      "🙈Отоварилась😀 Дарья, с вашей лёгкой руки и посылом от сердца, купила подарки и себе и близким буквально за 10 минут, а не за десять дней! ⛄🎄❤️ Спасибо",
    source: REVIEWS_CAROUSEL_IMAGES[4],
    sourceLabel: "Оригинал отзыва о подборках подарков",
  },
  {
    id: "ekaterina",
    author: "Екатерина",
    quote:
      "Даша, спасибо огромное за Ваши письма! Они невероятно тёплые и душевные. Как будто действительно переписываешься со старым добрым другом",
    source: REVIEWS_CAROUSEL_IMAGES[5],
    sourceLabel: "Оригинал отзыва Екатерины",
  },
];
