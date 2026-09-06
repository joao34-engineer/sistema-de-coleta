import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/shared/api/database.types";
import { getPublicEnvironment, hasPublicEnvironment } from "@/shared/config/environment";
import { decideProxyGate } from "@/shared/config/proxy-gate";

function redirectWithRefreshedCookies(request: NextRequest, response: NextResponse, pathname: string): NextResponse {
  const destination = pathname === "/login" ? "/dashboard" : "/login";
  const redirectResponse = NextResponse.redirect(new URL(destination, request.url));
  for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasPublicEnv = hasPublicEnvironment();
  let publicEnvValid = false;

  if (hasPublicEnv) {
    try {
      getPublicEnvironment();
      publicEnvValid = true;
    } catch {
      publicEnvValid = false;
    }
  }

  if (!hasPublicEnv || !publicEnvValid) {
    const decision = decideProxyGate({
      pathname,
      hasPublicEnv,
      publicEnvValid,
      hasIdentity: null,
    });
    if (decision.action === "redirect") {
      return NextResponse.redirect(new URL(decision.pathname, request.url));
    }
    return NextResponse.next();
  }

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

  let hasIdentity = false;
  try {
    const { data: claimsData } = await supabase.auth.getClaims();
    hasIdentity = typeof claimsData?.claims?.sub === "string";
  } catch {
    hasIdentity = false;
  }

  const decision = decideProxyGate({
    pathname,
    hasPublicEnv,
    publicEnvValid,
    hasIdentity,
  });

  if (decision.action === "redirect") {
    if (decision.pathname === "/") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return redirectWithRefreshedCookies(request, response, decision.pathname === "/dashboard" ? "/login" : pathname);
  }

  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|sw.js).*)"] };
