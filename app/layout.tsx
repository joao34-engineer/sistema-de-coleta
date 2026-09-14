import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { AppPwaShell, buildDevServiceWorkerCleanupScript } from "@/_app/pwa";
import "@/_app/styles/globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: { default: "Sistema de Coleta MJT", template: "%s | Coleta MJT" },
  description: "Fundação administrativa do Sistema de Coleta MJT.",
  applicationName: "Sistema de Coleta MJT",
  appleWebApp: { capable: true, title: "Coleta MJT", statusBarStyle: "default" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4c916f",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <html lang="pt-BR" className={geistSans.variable}>
      <head>
        {isDev ? (
          <script
            dangerouslySetInnerHTML={{ __html: buildDevServiceWorkerCleanupScript() }}
          />
        ) : null}
      </head>
      <body>
        <AppPwaShell />
        {children}
      </body>
    </html>
  );
}
