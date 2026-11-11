/** Оболочка этой группы маршрутов задаёт общие провайдеры и навигацию, не меняя публичные URL вложенных страниц. */
import "../tab-styles";
import type { ReactNode } from "react";
import Providers from "../providers";

/** Keep the session, retained tabs and background effects out of password setup. */
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
