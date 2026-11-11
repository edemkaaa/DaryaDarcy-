"use client";
/** Типы почтового отделения описывают анкету и связи участников; наличие типа само по себе не включает функцию. */
export const PEN_PAL_INTERESTS = [
  "Сад",
  "Книги",
  "Фотография",
  "Рукоделие",
  "Материнство",
  "Стиль",
  "Рисование",
  "Музыка",
  "Интерьер",
  "Кино",
  "Путешествия",
  "Писательство",
  "Животные",
] as const;
export type PenPalInterest = (typeof PEN_PAL_INTERESTS)[number];
export const PEN_PAL_INTEREST_SET = new Set<string>(PEN_PAL_INTERESTS);
/** Bump when legal copy for pen pals consent changes. */
export const PEN_PAL_CONSENT_VERSION = "2026-09-1";
export const PEN_PAL_ADULT_CONSENT_LABEL =
  "Мне исполнилось 18 лет, я понимаю, что участие в «Почтовом отделении» добровольное и связано с передачей почтового адреса другому участнику после взаимного подтверждения.";
/** Calendar days for mutual confirm after match suggestion. */
export const PEN_PAL_CONFIRM_DAYS = 7;
