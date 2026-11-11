/** Оболочка этой группы маршрутов задаёт общие провайдеры и навигацию, не меняя публичные URL вложенных страниц. */
import "../tab-styles";
import type { ReactNode } from "react";
import Providers from "../providers";

/** Общие провайдеры и фоновые эффекты включаем только для application-группы; установка пароля остаётся снаружи. */
export default function ApplicationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <link rel="preconnect" href="https://s3.twcstorage.ru" />
      <Providers initialHomeDate={new Date().toISOString()}>
        {children}
      </Providers>
    </>
  );
}
