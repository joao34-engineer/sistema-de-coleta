"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { ServiceEnvironmentInvalidError, ServiceEnvironmentMismatchError } from "@/shared/config/environment";
import { routes } from "@/shared/config";
import type { LoginActionState } from "@/shared/lib/action-result";
import {
  DocumentRateLimitExceededError,
  DocumentRateLimitSecretMissingError,
  enforceLoginRateLimit,
  resetLoginRateLimit,
} from "@/shared/lib/rate-limit.server";
import { getRequestId, logTransactionFailure } from "@/shared/lib/server-logger";
import { loginSchema } from "../model/schema";

type LoginLimiterFailureCode =
  | "rate_limit_secret_missing"
  | "service_env_invalid"
  | "service_project_ref_mismatch"
  | "rate_limit_rpc_failed";

function loginLimiterFailureCode(error: unknown): LoginLimiterFailureCode {
  if (error instanceof ServiceEnvironmentMismatchError) return "service_project_ref_mismatch";
  if (error instanceof ServiceEnvironmentInvalidError) return "service_env_invalid";
  if (error instanceof DocumentRateLimitSecretMissingError) return "rate_limit_secret_missing";
  if (error instanceof Error && error.message === "Variáveis de serviço Supabase ausentes ou inválidas.") {
    return "service_env_invalid";
  }
  return "rate_limit_rpc_failed";
}

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

  const requestHeaders = { headers: await headers() };

  try {
    await enforceLoginRateLimit(requestHeaders, parsed.data.email);
  } catch (error: unknown) {
    if (error instanceof DocumentRateLimitExceededError) {
      return { status: "error", code: "rate_limit_exceeded", message: "Aguarde antes de tentar novamente." };
    }
    logTransactionFailure({
      requestId: getRequestId(),
      operation: "sign_in",
      code: loginLimiterFailureCode(error),
      actorId: null,
      status: 503,
    });
    return { status: "error", code: "temporarily_unavailable", message: "Não foi possível concluir o login agora." };
  }

  try {
    const supabase = await createServerSupabaseClient({ cookieMutation: "required" });
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

  try {
    await resetLoginRateLimit(requestHeaders, parsed.data.email);
  } catch {
    logTransactionFailure({
      requestId: getRequestId(),
      operation: "sign_in",
      code: "rate_limit_reset_failed",
      actorId: null,
      status: 503,
    });
  }

  redirect(routes.dashboard);
}
