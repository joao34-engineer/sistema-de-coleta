import "server-only";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { endSession } from "@/shared/auth/end-session";
import { isSameOriginRequest } from "@/shared/auth/same-origin";
import { routes } from "@/shared/config/routes";
import { getRequestId, logTransactionFailure } from "@/shared/lib/server-logger";

export async function postSignOut(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return new Response(null, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }

  try {
    await endSession();
  } catch {
    logTransactionFailure({
      requestId: getRequestId(request),
      operation: "sign_out",
      code: "unexpected_error",
      actorId: null,
      status: 500,
    });
    return new Response(null, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }

  revalidatePath("/", "layout");
  const response = NextResponse.redirect(new URL(routes.login, request.url), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
