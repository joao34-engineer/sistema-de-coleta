import type { Metadata } from "next";
import {
  DocumentShareAvailablePage,
  DocumentShareUnavailablePage,
} from "@/_pages/collection-documents/index.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Link seguro de documento",
  description: "Acesso temporário a uma guia de coleta MJT.",
  robots: { index: false, follow: false },
};

type Props = Readonly<{ params: Promise<{ shareToken: string }> }>;

export default async function DocumentSharePage({ params }: Props) {
  const { shareToken } = await params;
  const validShape = /^[0-9a-f]{64}$/.test(shareToken);
  if (!validShape) return <DocumentShareUnavailablePage />;
  return <DocumentShareAvailablePage shareToken={shareToken} />;
}
