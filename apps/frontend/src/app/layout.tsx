import "@/shared/styles/global.scss";
import "./tab-styles";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { connection } from "next/server";
import Providers from "./providers";
import { resolveImageUri } from "@/shared/ui/static-images";
export const metadata: Metadata = {
  title: { default: "DARYADARCY", template: "%s · DARYADARCY" },
  description: "Уютное пространство Дарьи Дарси",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DARYADARCY",
  },
  icons: {
    icon: resolveImageUri("/assets/images/favicon.png"),
    apple: resolveImageUri("/assets/images/icon.png"),
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#FDF8F0",
};
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Nonces must be attached at request time, including to previously static pages.
  await connection();
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://s3.twcstorage.ru" />
        <link
          rel="preload"
          href="/assets/fonts/EBGaramond-Regular.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <div id="root" className="ui-stack ">
          <Providers initialHomeDate={new Date().toISOString()}>
            {children}
          </Providers>
        </div>
      </body>
    </html>
  );
}
