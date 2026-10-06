import type { ViewportSize } from "@/shared/browser/viewport";

import { type AestheticKey } from "@/domain/quiz/quiz-data";
export const PAPER_TEXTURE_URI =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.7be3fc15eb2bb84f.jpg";

export const BROWN = "#5C4033";
export const BROWN_MUTED = "#8B7355";
export const BROWN_LIGHT = "#A0845C";
export const CREAM = "#FDF8F0";
export const HOUSE_IMAGES: Record<AestheticKey, { uri: string }> = {
  cottagecore: { uri: "/assets/quiz/houses/cottagecore.jpg" },
  goblincore: { uri: "/assets/quiz/houses/goblincore.jpg" },
  witchcore: { uri: "/assets/quiz/houses/witchcore.jpg" },
  castlecore: { uri: "/assets/quiz/houses/castlecore.jpg" },
  fairycore: { uri: "/assets/quiz/houses/fairycore.jpg" },
  darkAcademia: { uri: "/assets/quiz/houses/dark-academia.jpg" },
  lightAcademia: { uri: "/assets/quiz/houses/light-academia.jpg" },
};
export const COTTAGECORE_MOODBOARDS = [
  { uri: "/assets/results/cottagecore/moodboards/moodboard1.png" },
  { uri: "/assets/results/cottagecore/moodboards/moodboard2.webp" },
  { uri: "/assets/results/cottagecore/moodboards/moodboard3.png" },
  { uri: "/assets/results/cottagecore/moodboards/moodboard4.webp" },
  { uri: "/assets/results/cottagecore/moodboards/moodboard5.png" },
  { uri: "/assets/results/cottagecore/moodboards/moodboard6.png" },
  { uri: "/assets/results/cottagecore/moodboards/moodboard7.webp" },
  { uri: "/assets/results/cottagecore/moodboards/moodboard8.webp" },
  { uri: "/assets/results/cottagecore/moodboards/moodboard9.png" },
];
export const COTTAGECORE_OUTFITS = [
  { uri: "/assets/results/cottagecore/outfits/outfit1.jpg" },
  { uri: "/assets/results/cottagecore/outfits/outfit2.jpg" },
  { uri: "/assets/results/cottagecore/outfits/outfit3.jpg" },
  { uri: "/assets/results/cottagecore/outfits/outfit4.jpg" },
  { uri: "/assets/results/cottagecore/outfits/outfit5.jpg" },
  { uri: "/assets/results/cottagecore/outfits/outfit6.jpg" },
  { uri: "/assets/results/cottagecore/outfits/outfit7.jpg" },
  { uri: "/assets/results/cottagecore/outfits/outfit8.jpg" },
  { uri: "/assets/results/cottagecore/outfits/outfit9.jpg" },
  { uri: "/assets/results/cottagecore/outfits/outfit10.jpg" },
  { uri: "/assets/results/cottagecore/outfits/outfit11.jpg" },
  { uri: "/assets/results/cottagecore/outfits/outfit12.jpg" },
];
export const COTTAGECORE_INTERIORS = [
  { uri: "/assets/results/cottagecore/interiors/interior1.jpg" },
  { uri: "/assets/results/cottagecore/interiors/interior2.jpg" },
  { uri: "/assets/results/cottagecore/interiors/interior3.jpg" },
  { uri: "/assets/results/cottagecore/interiors/interior4.jpg" },
];
export const DARKACADEMIA_OUTFITS = [
  { uri: "/assets/results/darkacademia/outfits/outfit1.webp" },
  { uri: "/assets/results/darkacademia/outfits/outfit2.webp" },
  { uri: "/assets/results/darkacademia/outfits/outfit3.webp" },
  { uri: "/assets/results/darkacademia/outfits/outfit4.webp" },
  { uri: "/assets/results/darkacademia/outfits/outfit5.webp" },
  { uri: "/assets/results/darkacademia/outfits/outfit6.webp" },
  { uri: "/assets/results/darkacademia/outfits/outfit7.webp" },
  { uri: "/assets/results/darkacademia/outfits/outfit8.webp" },
  { uri: "/assets/results/darkacademia/outfits/outfit9.webp" },
  { uri: "/assets/results/darkacademia/outfits/outfit10.webp" },
  { uri: "/assets/results/darkacademia/outfits/outfit11.webp" },
  { uri: "/assets/results/darkacademia/outfits/outfit12.webp" },
  { uri: "/assets/results/darkacademia/outfits/outfit13.lossless.webp" },
];
export const DARKACADEMIA_MOODBOARDS = [
  { uri: "/assets/results/darkacademia/moodboards/moodboard1.jpg" },
  { uri: "/assets/results/darkacademia/moodboards/moodboard2.jpg" },
  { uri: "/assets/results/darkacademia/moodboards/moodboard3.jpg" },
  { uri: "/assets/results/darkacademia/moodboards/moodboard4.jpg" },
  { uri: "/assets/results/darkacademia/moodboards/moodboard5.jpg" },
  { uri: "/assets/results/darkacademia/moodboards/moodboard6.jpg" },
  { uri: "/assets/results/darkacademia/moodboards/moodboard7.jpg" },
  { uri: "/assets/results/darkacademia/moodboards/moodboard8.jpg" },
];
export const DARKACADEMIA_INTERIORS = [
  { uri: "/assets/results/darkacademia/interiors/interior1.webp" },
  { uri: "/assets/results/darkacademia/interiors/interior2.jpg" },
  { uri: "/assets/results/darkacademia/interiors/interior3.jpg" },
  { uri: "/assets/results/darkacademia/interiors/interior4.jpg" },
  { uri: "/assets/results/darkacademia/interiors/interior5.jpg" },
  { uri: "/assets/results/darkacademia/interiors/interior6.jpg" },
  { uri: "/assets/results/darkacademia/interiors/interior7.webp" },
  { uri: "/assets/results/darkacademia/interiors/interior8.jpg" },
];
export const GOBLINCORE_OUTFITS = [
  { uri: "/assets/results/goblincore/outfits/outfit1.webp" },
  { uri: "/assets/results/goblincore/outfits/outfit2.webp" },
  { uri: "/assets/results/goblincore/outfits/outfit3.webp" },
  { uri: "/assets/results/goblincore/outfits/outfit4.webp" },
  { uri: "/assets/results/goblincore/outfits/outfit5.webp" },
  { uri: "/assets/results/goblincore/outfits/outfit6.webp" },
  { uri: "/assets/results/goblincore/outfits/outfit7.webp" },
  { uri: "/assets/results/goblincore/outfits/outfit8.webp" },
  { uri: "/assets/results/goblincore/outfits/outfit9.webp" },
  { uri: "/assets/results/goblincore/outfits/outfit10.webp" },
  { uri: "/assets/results/goblincore/outfits/outfit11.webp" },
  { uri: "/assets/results/goblincore/outfits/outfit12.webp" },
  { uri: "/assets/results/goblincore/outfits/outfit13.webp" },
  { uri: "/assets/results/goblincore/outfits/outfit14.webp" },
  { uri: "/assets/results/goblincore/outfits/outfit15.jpg" },
];
export const GOBLINCORE_MOODBOARDS = [
  { uri: "/assets/results/goblincore/moodboards/mood1.jpg" },
  { uri: "/assets/results/goblincore/moodboards/mood2.jpg" },
  { uri: "/assets/results/goblincore/moodboards/mood3.jpg" },
  { uri: "/assets/results/goblincore/moodboards/mood4.jpg" },
  { uri: "/assets/results/goblincore/moodboards/mood5.jpg" },
  { uri: "/assets/results/goblincore/moodboards/mood6.jpg" },
  { uri: "/assets/results/goblincore/moodboards/mood7.jpg" },
];
export const GOBLINCORE_INTERIORS = [
  { uri: "/assets/results/goblincore/interiors/interior1.jpg" },
  { uri: "/assets/results/goblincore/interiors/interior2.jpg" },
  { uri: "/assets/results/goblincore/interiors/interior3.jpg" },
  { uri: "/assets/results/goblincore/interiors/interior4.jpg" },
  { uri: "/assets/results/goblincore/interiors/interior5.jpg" },
  { uri: "/assets/results/goblincore/interiors/interior6.jpg" },
  { uri: "/assets/results/goblincore/interiors/interior7.jpg" },
  { uri: "/assets/results/goblincore/interiors/interior8.jpg" },
  { uri: "/assets/results/goblincore/interiors/interior9.jpg" },
];
export const CASTLECORE_OUTFITS = [
  { uri: "/assets/results/castlecore/outfits/outfit1.webp" },
  { uri: "/assets/results/castlecore/outfits/outfit2.webp" },
  { uri: "/assets/results/castlecore/outfits/outfit3.lossless.webp" },
  { uri: "/assets/results/castlecore/outfits/outfit4.webp" },
  { uri: "/assets/results/castlecore/outfits/outfit5.webp" },
  { uri: "/assets/results/castlecore/outfits/outfit6.webp" },
  { uri: "/assets/results/castlecore/outfits/outfit7.webp" },
  { uri: "/assets/results/castlecore/outfits/outfit8.webp" },
  { uri: "/assets/results/castlecore/outfits/outfit9.webp" },
  { uri: "/assets/results/castlecore/outfits/outfit10.webp" },
  { uri: "/assets/results/castlecore/outfits/outfit11.webp" },
  { uri: "/assets/results/castlecore/outfits/outfit12.webp" },
];
export const CASTLECORE_MOODBOARDS = [
  { uri: "/assets/results/castlecore/moodboards/mood1.jpg" },
  { uri: "/assets/results/castlecore/moodboards/mood2.jpg" },
  { uri: "/assets/results/castlecore/moodboards/mood3.jpg" },
  { uri: "/assets/results/castlecore/moodboards/mood4.jpg" },
  { uri: "/assets/results/castlecore/moodboards/mood5.jpg" },
  { uri: "/assets/results/castlecore/moodboards/mood6.jpg" },
  { uri: "/assets/results/castlecore/moodboards/mood7.jpg" },
  { uri: "/assets/results/castlecore/moodboards/mood8.jpg" },
  { uri: "/assets/results/castlecore/moodboards/mood9.jpg" },
];
export const CASTLECORE_INTERIORS = [
  { uri: "/assets/results/castlecore/interiors/interior1.jpg" },
  { uri: "/assets/results/castlecore/interiors/interior2.jpg" },
  { uri: "/assets/results/castlecore/interiors/interior3.jpg" },
  { uri: "/assets/results/castlecore/interiors/interior4.jpg" },
  { uri: "/assets/results/castlecore/interiors/interior5.jpg" },
  { uri: "/assets/results/castlecore/interiors/interior6.jpg" },
  { uri: "/assets/results/castlecore/interiors/interior7.jpg" },
  { uri: "/assets/results/castlecore/interiors/interior8.jpg" },
  { uri: "/assets/results/castlecore/interiors/interior9.jpg" },
  { uri: "/assets/results/castlecore/interiors/interior10.jpg" },
  { uri: "/assets/results/castlecore/interiors/interior11.jpg" },
  { uri: "/assets/results/castlecore/interiors/interior12.jpg" },
  { uri: "/assets/results/castlecore/interiors/interior13.jpg" },
];
export const WITCHCORE_OUTFITS = [
  { uri: "/assets/results/witchcore/outfits/outfit1.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit2.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit3.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit4.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit5.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit6.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit7.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit8.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit9.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit10.lossless.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit11.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit12.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit13.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit14.lossless.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit15.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit16.webp" },
  { uri: "/assets/results/witchcore/outfits/outfit17.webp" },
];
export const WITCHCORE_MOODBOARDS = [
  { uri: "/assets/results/witchcore/moodboards/look1.jpg" },
  { uri: "/assets/results/witchcore/moodboards/look2.jpg" },
  { uri: "/assets/results/witchcore/moodboards/look3.jpg" },
  { uri: "/assets/results/witchcore/moodboards/look4.jpg" },
  { uri: "/assets/results/witchcore/moodboards/look5.jpg" },
  { uri: "/assets/results/witchcore/moodboards/look6.jpg" },
  { uri: "/assets/results/witchcore/moodboards/look7.jpg" },
  { uri: "/assets/results/witchcore/moodboards/look8.jpg" },
  { uri: "/assets/results/witchcore/moodboards/look9.jpg" },
];
export const WITCHCORE_INTERIORS = [
  { uri: "/assets/results/witchcore/interiors/interior1.jpg" },
  { uri: "/assets/results/witchcore/interiors/interior2.jpg" },
  { uri: "/assets/results/witchcore/interiors/interior3.jpg" },
  { uri: "/assets/results/witchcore/interiors/interior4.jpg" },
  { uri: "/assets/results/witchcore/interiors/interior5.jpg" },
  { uri: "/assets/results/witchcore/interiors/interior6.jpg" },
  { uri: "/assets/results/witchcore/interiors/interior7.jpg" },
  { uri: "/assets/results/witchcore/interiors/interior8.jpg" },
];
export const FAIRYCORE_OUTFITS = [
  { uri: "/assets/results/fairycore/outfits/outfit1.webp" },
  { uri: "/assets/results/fairycore/outfits/outfit2.webp" },
  { uri: "/assets/results/fairycore/outfits/outfit3.webp" },
  { uri: "/assets/results/fairycore/outfits/outfit4.webp" },
  { uri: "/assets/results/fairycore/outfits/outfit5.png" },
  { uri: "/assets/results/fairycore/outfits/outfit6.webp" },
  { uri: "/assets/results/fairycore/outfits/outfit7.webp" },
  { uri: "/assets/results/fairycore/outfits/outfit8.webp" },
  { uri: "/assets/results/fairycore/outfits/outfit9.webp" },
  { uri: "/assets/results/fairycore/outfits/outfit10.webp" },
  { uri: "/assets/results/fairycore/outfits/outfit11.webp" },
  { uri: "/assets/results/fairycore/outfits/outfit12.webp" },
];
export const FAIRYCORE_MOODBOARDS = [
  { uri: "/assets/results/fairycore/moodboards/look1.jpg" },
  { uri: "/assets/results/fairycore/moodboards/look2.jpg" },
  { uri: "/assets/results/fairycore/moodboards/look3.jpg" },
  { uri: "/assets/results/fairycore/moodboards/look4.jpg" },
  { uri: "/assets/results/fairycore/moodboards/look5.jpg" },
  { uri: "/assets/results/fairycore/moodboards/look6.jpg" },
  { uri: "/assets/results/fairycore/moodboards/look7.jpg" },
  { uri: "/assets/results/fairycore/moodboards/look8.jpg" },
];
export const FAIRYCORE_INTERIORS = [
  { uri: "/assets/results/fairycore/interiors/interior1.jpg" },
  { uri: "/assets/results/fairycore/interiors/interior2.jpg" },
  { uri: "/assets/results/fairycore/interiors/interior3.jpg" },
  { uri: "/assets/results/fairycore/interiors/interior4.jpg" },
  { uri: "/assets/results/fairycore/interiors/interior5.jpg" },
  { uri: "/assets/results/fairycore/interiors/interior6.jpg" },
  { uri: "/assets/results/fairycore/interiors/interior7.jpg" },
  { uri: "/assets/results/fairycore/interiors/interior8.jpg" },
  { uri: "/assets/results/fairycore/interiors/interior9.jpg" },
  { uri: "/assets/results/fairycore/interiors/interior10.jpg" },
];
export const LIGHTACADEMIA_OUTFITS = [
  { uri: "/assets/results/lightacademia/outfits/outfit1.webp" },
  { uri: "/assets/results/lightacademia/outfits/outfit2.webp" },
  { uri: "/assets/results/lightacademia/outfits/outfit3.webp" },
  { uri: "/assets/results/lightacademia/outfits/outfit4.webp" },
  { uri: "/assets/results/lightacademia/outfits/outfit5.webp" },
  { uri: "/assets/results/lightacademia/outfits/outfit6.webp" },
  { uri: "/assets/results/lightacademia/outfits/outfit7.webp" },
  { uri: "/assets/results/lightacademia/outfits/outfit8.webp" },
  { uri: "/assets/results/lightacademia/outfits/outfit9.webp" },
  { uri: "/assets/results/lightacademia/outfits/outfit10.webp" },
  { uri: "/assets/results/lightacademia/outfits/outfit11.webp" },
  { uri: "/assets/results/lightacademia/outfits/outfit12.webp" },
  { uri: "/assets/results/lightacademia/outfits/outfit13.webp" },
  { uri: "/assets/results/lightacademia/outfits/outfit14.webp" },
  { uri: "/assets/results/lightacademia/outfits/outfit15.webp" },
  { uri: "/assets/results/lightacademia/outfits/outfit16.webp" },
];
export const LIGHTACADEMIA_MOODBOARDS = [
  { uri: "/assets/results/lightacademia/moodboards/moodboard1.jpg" },
  { uri: "/assets/results/lightacademia/moodboards/moodboard2.jpg" },
  { uri: "/assets/results/lightacademia/moodboards/moodboard3.jpg" },
  { uri: "/assets/results/lightacademia/moodboards/moodboard4.jpg" },
  { uri: "/assets/results/lightacademia/moodboards/moodboard5.jpg" },
  { uri: "/assets/results/lightacademia/moodboards/moodboard6.jpg" },
  { uri: "/assets/results/lightacademia/moodboards/moodboard7.jpg" },
  { uri: "/assets/results/lightacademia/moodboards/moodboard8.jpg" },
  { uri: "/assets/results/lightacademia/moodboards/moodboard9.jpg" },
  { uri: "/assets/results/lightacademia/moodboards/moodboard10.jpg" },
  { uri: "/assets/results/lightacademia/moodboards/moodboard11.jpg" },
];
export const LIGHTACADEMIA_INTERIORS = [
  { uri: "/assets/results/lightacademia/interiors/interior1.jpg" },
  { uri: "/assets/results/lightacademia/interiors/interior2.jpg" },
  { uri: "/assets/results/lightacademia/interiors/interior3.jpg" },
  { uri: "/assets/results/lightacademia/interiors/interior4.jpg" },
  { uri: "/assets/results/lightacademia/interiors/interior5.jpg" },
  { uri: "/assets/results/lightacademia/interiors/interior6.jpg" },
  { uri: "/assets/results/lightacademia/interiors/interior7.jpg" },
  { uri: "/assets/results/lightacademia/interiors/interior8.jpg" },
  { uri: "/assets/results/lightacademia/interiors/interior9.jpg" },
  { uri: "/assets/results/lightacademia/interiors/interior10.jpg" },
  { uri: "/assets/results/lightacademia/interiors/interior11.jpg" },
];

export function getQuizResultContent(viewport: ViewportSize) {
  const { width } = viewport;
  return { width };
}
