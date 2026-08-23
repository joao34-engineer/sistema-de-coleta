export default function OficinaLoading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] animate-pulse bg-[var(--color-surface-bg)] pb-28" role="status" aria-label="Carregando">
      <div className="flex min-h-[80px] w-full items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4">
        <div className="h-9 w-9 rounded-full bg-[var(--color-surface-neutral)]" />
        <div className="ml-3 flex flex-col gap-2">
          <div className="h-4 w-40 rounded bg-[var(--color-surface-neutral)]" />
          <div className="h-3 w-24 rounded bg-[var(--color-surface-neutral)]" />
        </div>
      </div>
      <div className="flex flex-col gap-4 px-6 pt-6">
        <div className="h-[72px] rounded-[16px] bg-[var(--color-surface-neutral)]" />
        <div className="h-[52px] rounded-[12px] bg-[var(--color-surface-neutral)]" />
        <div className="h-[120px] rounded-[16px] bg-[var(--color-surface-neutral)]" />
      </div>
    </main>
  );
}
