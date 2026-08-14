"use client";

export default function ErrorPage({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  void reset;
  return <main className="flex min-h-screen items-center justify-center px-4"><section className="rounded-medium border border-border bg-surface p-7 text-center shadow-surface"><h1 className="text-2xl font-semibold">Não foi possível carregar a página</h1><p className="mt-2 text-sm text-muted">Tente novamente. Nenhum detalhe técnico foi exposto.</p></section></main>;
}
