import type { Metadata } from "next";
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
  if (!validShape) return <UnavailableSharePage />;
  return <main className="flex min-h-screen items-center justify-center px-4 py-10"><section className="w-full max-w-lg rounded-medium border border-border bg-surface p-7 shadow-surface"><p className="text-sm font-semibold uppercase tracking-wide text-primary">Compartilhamento MJT</p><h1 className="mt-2 text-2xl font-semibold">Documento protegido</h1><p className="mt-3 text-sm leading-6 text-muted">O acesso ao PDF é temporário e cada download consome uma utilização do link.</p><a href={`/d/${shareToken}/download`} className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Baixar PDF</a><p className="mt-6 text-xs text-muted">Este link é privado. Não compartilhe a URL em canais públicos.</p></section></main>;
}

function UnavailableSharePage() {
  return <main className="flex min-h-screen items-center justify-center px-4 py-10"><section className="w-full max-w-lg rounded-medium border border-border bg-surface p-7"><p className="text-sm font-semibold uppercase tracking-wide text-muted">Compartilhamento MJT</p><h1 className="mt-2 text-2xl font-semibold">Link indisponível</h1><p className="mt-3 text-sm leading-6 text-muted">O link é inválido, expirou ou foi revogado.</p></section></main>;
}
