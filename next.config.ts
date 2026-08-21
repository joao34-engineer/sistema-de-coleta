import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";
    const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "'self'";
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      `connect-src 'self' ${supabaseOrigin} ${isProduction ? "" : "ws://localhost:* ws://127.0.0.1:*"}`,
      "font-src 'self' data:",
      ...(isProduction ? ["upgrade-insecure-requests"] : []),
    ].join("; ");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/d/:shareToken*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, noarchive" },
        ],
      },
      {
        source: "/verificar/:verificationToken*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, noarchive" },
        ],
      },
    ];
  },
};

export default nextConfig;
