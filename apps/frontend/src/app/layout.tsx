import "@/shared/styles/global.scss";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Providers from "./providers";
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
    icon: "/assets/images/favicon.png",
    apple: "/assets/images/icon.png",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#FDF8F0",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <div id="root" className="ui-stack ">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
