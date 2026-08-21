import type { Metadata } from "next";
import { headers } from "next/headers";
import { PublicVerificationRoute } from "@/_pages/collection-documents/index.server";
import { enforcePublicVerificationRateLimit } from "@/_pages/collection-documents/api/delivery/rate-limit.server";

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
  await enforcePublicVerificationRateLimit({ headers: await headers() });
  return PublicVerificationRoute({ token: verificationToken });
}
