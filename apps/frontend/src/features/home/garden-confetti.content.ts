export const PETAL_COLORS = [
  "#6B7B5E",
  "#8B7355",
  "#D4C4A8",
  "#C9A882",
  "#FDF8F0",
  "#A8B89A",
];
export type Petal = {
  id: number;
  left: number;
  top: number;
  color: string;
  size: number;
  rotate: number;
  driftX: number;
  driftY: number;
  delay: number;
};
export const PETALS: Petal[] = Array.from({ length: 18 }, (_, id) => ({
  id,
  left: 8 + ((id * 17) % 84),
  top: 10 + ((id * 23) % 70),
  color: PETAL_COLORS[id % PETAL_COLORS.length]!,
  size: 6 + (id % 4) * 2,
  rotate: (id * 37) % 360,
  driftX: ((id % 5) - 2) * 18,
  driftY: -40 - (id % 6) * 12,
  delay: (id % 7) * 40,
}));
