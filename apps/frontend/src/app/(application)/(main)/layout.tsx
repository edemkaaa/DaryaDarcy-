/** Оболочка этой группы маршрутов задаёт общие провайдеры и навигацию, не меняя публичные URL вложенных страниц. */
import type { ReactNode } from "react";
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
