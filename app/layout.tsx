import type { Metadata, Viewport } from "next";
import "@/_app/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "Sistema de Coleta MJT", template: "%s | Coleta MJT" },
  description: "Fundação administrativa do Sistema de Coleta MJT.",
  applicationName: "Sistema de Coleta MJT",
  appleWebApp: { capable: true, title: "Coleta MJT", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#175cd3" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
