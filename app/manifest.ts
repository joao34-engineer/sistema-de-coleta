import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "Sistema de Coleta MJT", short_name: "Coleta MJT", description: "Sistema administrativo de coleta da MJT", start_url: "/", scope: "/", display: "standalone", background_color: "#f6f7f9", theme_color: "#175cd3", lang: "pt-BR", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }, { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] };
}
