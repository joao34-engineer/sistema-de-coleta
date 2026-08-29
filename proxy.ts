import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/shared/api/database.types";
import { getPublicEnvironment, hasPublicEnvironment } from "@/shared/config/environment";
import { protectedRoutePrefixes } from "@/shared/config/routes";

function isProtectedPath(pathname: string): boolean {
  return protectedRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectWithRefreshedCookies(request: NextRequest, response: NextResponse, pathname: string): NextResponse {
  const destination = pathname === "/login" ? "/dashboard" : "/login";
  const redirectResponse = NextResponse.redirect(new URL(destination, request.url));
  for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // Public probe — skip Auth so uptime checks never spend getClaims or cookies.
  if (pathname === "/api/health") return NextResponse.next();

  if (!hasPublicEnvironment()) return NextResponse.next();

  const environment = getPublicEnvironment();
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(environment.supabaseUrl, environment.supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const cookie of cookiesToSet) response.cookies.set(cookie);
      },
    },
  });

  const { data: claimsData } = await supabase.auth.getClaims();
  const hasIdentity = typeof claimsData?.claims?.sub === "string";

  if (!hasIdentity && isProtectedPath(pathname)) return redirectWithRefreshedCookies(request, response, pathname);
  if (hasIdentity && pathname === "/login") return redirectWithRefreshedCookies(request, response, pathname);
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|sw.js).*)"] };
