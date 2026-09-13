import type { Metadata } from "next";
import { headers } from "next/headers";
import { createElement } from "react";
import { isValidVerificationToken, PublicVerificationPage as PublicVerificationView, PublicVerificationRoute, PublicVerificationWaitPage } from "@/_pages/collection-documents/index.server";
import {
  DocumentRateLimitExceededError,
  DocumentRateLimitUnavailableError,
  enforcePublicVerificationRateLimit,
} from "@/shared/lib/rate-limit.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Verificação de guia",
  description: "Consulta pública de autenticidade de uma guia de coleta MJT.",
  robots: { index: false, follow: false },
};

type Props = Readonly<{ params: Promise<{ verificationToken: string }> }>;

export default async function PublicVerificationPage({ params }: Props) {
  const { verificationToken } = await params;

  if (!isValidVerificationToken(verificationToken)) {
    return createElement(PublicVerificationView, { verification: null });
  }

  try {
    await enforcePublicVerificationRateLimit({ headers: await headers() });
  } catch (error: unknown) {
    if (error instanceof DocumentRateLimitExceededError) {
      return createElement(PublicVerificationWaitPage, {
        variant: "rate_limited",
        retryAfterSeconds: error.retryAfterSeconds,
      });
    }
    if (error instanceof DocumentRateLimitUnavailableError) {
      return createElement(PublicVerificationWaitPage, { variant: "unavailable" });
    }
    throw error;
  }

  return PublicVerificationRoute({ token: verificationToken });
}
