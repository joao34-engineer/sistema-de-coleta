"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { routes } from "@/shared/config";
import type { LoginActionState } from "@/shared/lib/action-result";
import {
  DocumentRateLimitExceededError,
  enforceLoginRateLimit,
} from "@/shared/lib/rate-limit.server";
import { getRequestId, logTransactionFailure } from "@/shared/lib/server-logger";
import { loginSchema } from "../model/schema";

export async function signInAction(_previousState: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "email" || field === "password") fieldErrors[field] = issue.message;
    }
    return { status: "error", code: "validation_error", fieldErrors };
  }

  try {
    await enforceLoginRateLimit({ headers: await headers() }, parsed.data.email);
  } catch (error: unknown) {
    if (error instanceof DocumentRateLimitExceededError) {
      return { status: "error", code: "rate_limit_exceeded", message: "Aguarde antes de tentar novamente." };
    }
    return { status: "error", code: "temporarily_unavailable", message: "Não foi possível concluir o login agora." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
    });
    if (error) return { status: "error", code: "invalid_credentials", message: "E-mail ou senha inválidos." };
  } catch {
    logTransactionFailure({
      requestId: getRequestId(),
      operation: "sign_in",
      code: "unexpected_error",
      actorId: null,
      status: 500,
    });
    return { status: "error", code: "unexpected_error", message: "Não foi possível concluir o login agora." };
  }

  redirect(routes.dashboard);
}
