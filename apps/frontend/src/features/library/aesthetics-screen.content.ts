/** Ресурсы и подписи гайда эстетик отделены от компонентов; изменение этих данных входит в клиентскую сборку. */
import type { ViewportSize } from "@/shared/browser/viewport";

import { type AestheticKey } from "@/domain/quiz/quiz-data";
export const PAPER_TEXTURE_URI =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.fe3ce71852fa6634.webp";

export const BROWN = "#5C4033";
export const BROWN_MUTED = "#8B7355";
export const BROWN_LIGHT = "#A0845C";
export const CREAM = "#FDF8F0";
export const AESTHETIC_ORDER: AestheticKey[] = [
  "cottagecore",
  "goblincore",
  "witchcore",
  "castlecore",
  "fairycore",
  "darkAcademia",
  "lightAcademia",
];
export const HOUSE_IMAGES: Record<AestheticKey, { uri: string }> = {
  cottagecore: { uri: "/assets/quiz/houses/cottagecore.webp" },
  goblincore: { uri: "/assets/quiz/houses/goblincore.webp" },
  witchcore: { uri: "/assets/quiz/houses/witchcore.webp" },
  castlecore: { uri: "/assets/quiz/houses/castlecore.webp" },
  fairycore: { uri: "/assets/quiz/houses/fairycore.webp" },
  darkAcademia: { uri: "/assets/quiz/houses/dark-academia.webp" },
  lightAcademia: { uri: "/assets/quiz/houses/light-academia.webp" },
};
export const MOODBOARDS: Record<AestheticKey, { uri: string }[]> = {
  cottagecore: [
    { uri: "/assets/results/cottagecore/moodboards/moodboard1.webp" },
    { uri: "/assets/results/cottagecore/moodboards/moodboard2.webp" },
    { uri: "/assets/results/cottagecore/moodboards/moodboard3.webp" },
    { uri: "/assets/results/cottagecore/moodboards/moodboard4.webp" },
    { uri: "/assets/results/cottagecore/moodboards/moodboard5.webp" },
  ],
  goblincore: [
    { uri: "/assets/results/goblincore/moodboards/mood1.webp" },
    { uri: "/assets/results/goblincore/moodboards/mood2.webp" },
    { uri: "/assets/results/goblincore/moodboards/mood3.webp" },
    { uri: "/assets/results/goblincore/moodboards/mood4.webp" },
    { uri: "/assets/results/goblincore/moodboards/mood5.webp" },
  ],
  witchcore: [
    { uri: "/assets/results/witchcore/moodboards/look1.webp" },
    { uri: "/assets/results/witchcore/moodboards/look2.webp" },
    { uri: "/assets/results/witchcore/moodboards/look3.webp" },
    { uri: "/assets/results/witchcore/moodboards/look4.webp" },
    { uri: "/assets/results/witchcore/moodboards/look5.webp" },
  ],
  castlecore: [
    { uri: "/assets/results/castlecore/moodboards/mood1.webp" },
    { uri: "/assets/results/castlecore/moodboards/mood2.webp" },
    { uri: "/assets/results/castlecore/moodboards/mood3.webp" },
    { uri: "/assets/results/castlecore/moodboards/mood4.webp" },
    { uri: "/assets/results/castlecore/moodboards/mood5.webp" },
  ],
  fairycore: [
    { uri: "/assets/results/fairycore/moodboards/look1.webp" },
    { uri: "/assets/results/fairycore/moodboards/look2.webp" },
    { uri: "/assets/results/fairycore/moodboards/look3.webp" },
    { uri: "/assets/results/fairycore/moodboards/look4.webp" },
    { uri: "/assets/results/fairycore/moodboards/look5.webp" },
  ],
  darkAcademia: [
    { uri: "/assets/results/darkacademia/moodboards/moodboard1.webp" },
    { uri: "/assets/results/darkacademia/moodboards/moodboard2.webp" },
    { uri: "/assets/results/darkacademia/moodboards/moodboard3.webp" },
    { uri: "/assets/results/darkacademia/moodboards/moodboard4.webp" },
    { uri: "/assets/results/darkacademia/moodboards/moodboard5.webp" },
  ],
  lightAcademia: [
    { uri: "/assets/results/lightacademia/moodboards/moodboard1.webp" },
    { uri: "/assets/results/lightacademia/moodboards/moodboard2.webp" },
    { uri: "/assets/results/lightacademia/moodboards/moodboard3.webp" },
    { uri: "/assets/results/lightacademia/moodboards/moodboard4.webp" },
    { uri: "/assets/results/lightacademia/moodboards/moodboard5.webp" },
  ],
};
export const OUTFITS: Record<AestheticKey, { uri: string }[]> = {
  cottagecore: [
    { uri: "/assets/results/cottagecore/outfits/outfit1.webp" },
    { uri: "/assets/results/cottagecore/outfits/outfit2.webp" },
    { uri: "/assets/results/cottagecore/outfits/outfit3.webp" },
    { uri: "/assets/results/cottagecore/outfits/outfit4.webp" },
    { uri: "/assets/results/cottagecore/outfits/outfit5.webp" },
  ],
  goblincore: [
    { uri: "/assets/results/goblincore/outfits/outfit1.webp" },
    { uri: "/assets/results/goblincore/outfits/outfit2.webp" },
    { uri: "/assets/results/goblincore/outfits/outfit3.webp" },
    { uri: "/assets/results/goblincore/outfits/outfit4.webp" },
    { uri: "/assets/results/goblincore/outfits/outfit5.webp" },
  ],
  witchcore: [
    { uri: "/assets/results/witchcore/outfits/outfit1.webp" },
    { uri: "/assets/results/witchcore/outfits/outfit2.webp" },
    { uri: "/assets/results/witchcore/outfits/outfit3.webp" },
    { uri: "/assets/results/witchcore/outfits/outfit4.webp" },
    { uri: "/assets/results/witchcore/outfits/outfit5.webp" },
  ],
  castlecore: [
    { uri: "/assets/results/castlecore/outfits/outfit1.webp" },
    { uri: "/assets/results/castlecore/outfits/outfit2.webp" },
    { uri: "/assets/results/castlecore/outfits/outfit3.lossless.webp" },
    { uri: "/assets/results/castlecore/outfits/outfit4.webp" },
    { uri: "/assets/results/castlecore/outfits/outfit5.webp" },
  ],
  fairycore: [
    { uri: "/assets/results/fairycore/outfits/outfit1.webp" },
    { uri: "/assets/results/fairycore/outfits/outfit2.webp" },
    { uri: "/assets/results/fairycore/outfits/outfit3.webp" },
    { uri: "/assets/results/fairycore/outfits/outfit4.webp" },
    { uri: "/assets/results/fairycore/outfits/outfit5.webp" },
  ],
  darkAcademia: [
    { uri: "/assets/results/darkacademia/outfits/outfit1.webp" },
    { uri: "/assets/results/darkacademia/outfits/outfit2.webp" },
    { uri: "/assets/results/darkacademia/outfits/outfit3.webp" },
    { uri: "/assets/results/darkacademia/outfits/outfit4.webp" },
    { uri: "/assets/results/darkacademia/outfits/outfit5.webp" },
  ],
  lightAcademia: [
    { uri: "/assets/results/lightacademia/outfits/outfit1.webp" },
    { uri: "/assets/results/lightacademia/outfits/outfit2.webp" },
    { uri: "/assets/results/lightacademia/outfits/outfit3.webp" },
    { uri: "/assets/results/lightacademia/outfits/outfit4.webp" },
    { uri: "/assets/results/lightacademia/outfits/outfit5.webp" },
  ],
};
export const INTERIORS: Record<AestheticKey, { uri: string }[]> = {
  cottagecore: [
    { uri: "/assets/results/cottagecore/interiors/interior1.webp" },
    { uri: "/assets/results/cottagecore/interiors/interior2.webp" },
    { uri: "/assets/results/cottagecore/interiors/interior3.webp" },
    { uri: "/assets/results/cottagecore/interiors/interior4.webp" },
  ],
  goblincore: [
    { uri: "/assets/results/goblincore/interiors/interior1.webp" },
    { uri: "/assets/results/goblincore/interiors/interior2.webp" },
    { uri: "/assets/results/goblincore/interiors/interior3.webp" },
    { uri: "/assets/results/goblincore/interiors/interior4.webp" },
    { uri: "/assets/results/goblincore/interiors/interior5.webp" },
  ],
  witchcore: [
    { uri: "/assets/results/witchcore/interiors/interior1.webp" },
    { uri: "/assets/results/witchcore/interiors/interior2.webp" },
    { uri: "/assets/results/witchcore/interiors/interior3.webp" },
    { uri: "/assets/results/witchcore/interiors/interior4.webp" },
    { uri: "/assets/results/witchcore/interiors/interior5.webp" },
  ],
  castlecore: [
    { uri: "/assets/results/castlecore/interiors/interior1.webp" },
    { uri: "/assets/results/castlecore/interiors/interior2.webp" },
    { uri: "/assets/results/castlecore/interiors/interior3.webp" },
    { uri: "/assets/results/castlecore/interiors/interior4.webp" },
    { uri: "/assets/results/castlecore/interiors/interior5.webp" },
  ],
  fairycore: [
    { uri: "/assets/results/fairycore/interiors/interior1.webp" },
    { uri: "/assets/results/fairycore/interiors/interior2.webp" },
    { uri: "/assets/results/fairycore/interiors/interior3.webp" },
    { uri: "/assets/results/fairycore/interiors/interior4.webp" },
    { uri: "/assets/results/fairycore/interiors/interior5.webp" },
  ],
  darkAcademia: [
    { uri: "/assets/results/darkacademia/interiors/interior1.webp" },
    { uri: "/assets/results/darkacademia/interiors/interior2.webp" },
    { uri: "/assets/results/darkacademia/interiors/interior3.webp" },
    { uri: "/assets/results/darkacademia/interiors/interior4.webp" },
    { uri: "/assets/results/darkacademia/interiors/interior5.webp" },
  ],
  lightAcademia: [
    { uri: "/assets/results/lightacademia/interiors/interior1.webp" },
    { uri: "/assets/results/lightacademia/interiors/interior2.webp" },
    { uri: "/assets/results/lightacademia/interiors/interior3.webp" },
    { uri: "/assets/results/lightacademia/interiors/interior4.webp" },
    { uri: "/assets/results/lightacademia/interiors/interior5.webp" },
  ],
};

export function getAestheticsScreenContent(viewport: ViewportSize) {
  const { width } = viewport;
  return { width };
}
