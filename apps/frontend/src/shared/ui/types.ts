/** Общие DOM-типы описывают размеры и события базовых UI-компонентов без привязки к бизнес-сценариям. */
import { type HTMLAttributes, type UIEvent } from "react";
export type BoxProps = HTMLAttributes<HTMLDivElement>;
export type ScrollEvent = UIEvent<HTMLDivElement>;
export type LayoutRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type VisibleItem<T = unknown> = {
  item: T;
  key: string;
  index: number;
  isVisible: boolean;
};
