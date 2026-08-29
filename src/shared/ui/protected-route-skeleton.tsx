type ProtectedRouteSkeletonVariant = "list" | "dashboard" | "hub";

type Props = Readonly<{
  variant: ProtectedRouteSkeletonVariant;
}>;

function SkeletonHeader({ withBack }: Readonly<{ withBack?: boolean }>) {
  return (
    <div className="flex min-h-[80px] w-full items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4">
      {withBack ? (
        <div className="h-9 w-9 rounded-full bg-[var(--color-surface-neutral)]" />
      ) : (
        <div className="h-8 w-[38px] rounded-[14px] bg-[var(--color-surface-neutral)]" />
      )}
      <div className="ml-3 flex flex-col gap-2">
        <div className="h-4 w-40 rounded bg-[var(--color-surface-neutral)]" />
        <div className="h-3 w-24 rounded bg-[var(--color-surface-neutral)]" />
      </div>
    </div>
  );
}

function SkeletonBottomNav() {
  return (
    <div
      aria-hidden
      className="fixed bottom-0 left-0 right-0 z-40 mx-auto flex h-[84px] w-full max-w-md items-center justify-around rounded-t-[18px] border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2"
    >
      <div className="h-12 w-[76px] rounded-[12px] bg-[var(--color-surface-neutral)]" />
      <div className="h-12 w-[76px] rounded-[12px] bg-[var(--color-surface-neutral)]" />
      <div className="h-12 w-[76px] rounded-[12px] bg-[var(--color-surface-neutral)]" />
    </div>
  );
}

function ListBody() {
  return (
    <div className="flex flex-col gap-4 px-6 pt-4">
      <div className="h-[44px] rounded-[12px] bg-[var(--color-surface-neutral)]" />
      <div className="flex gap-2">
        <div className="h-9 w-20 rounded-full bg-[var(--color-surface-neutral)]" />
        <div className="h-9 w-24 rounded-full bg-[var(--color-surface-neutral)]" />
        <div className="h-9 w-20 rounded-full bg-[var(--color-surface-neutral)]" />
      </div>
      <div className="h-[72px] rounded-[16px] bg-[var(--color-surface-neutral)]" />
      <div className="h-[72px] rounded-[16px] bg-[var(--color-surface-neutral)]" />
      <div className="h-[72px] rounded-[16px] bg-[var(--color-surface-neutral)]" />
    </div>
  );
}

function DashboardBody() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <div className="h-3 w-40 rounded bg-[var(--color-surface-neutral)]" />
      <div className="h-8 w-64 rounded bg-[var(--color-surface-neutral)]" />
      <div className="h-8 w-56 rounded bg-[var(--color-surface-neutral)]" />
      <div className="h-[120px] rounded-[16px] bg-[var(--color-surface-neutral)]" />
      <div className="h-[52px] rounded-[12px] bg-[var(--color-surface-neutral)]" />
      <div className="h-[72px] rounded-[16px] bg-[var(--color-surface-neutral)]" />
      <div className="h-[72px] rounded-[16px] bg-[var(--color-surface-neutral)]" />
    </div>
  );
}

function HubBody() {
  return (
    <div className="flex flex-col gap-4 px-6 pt-4">
      <div className="h-[72px] rounded-[16px] bg-[var(--color-surface-neutral)]" />
      <div className="h-[52px] rounded-[12px] bg-[var(--color-surface-neutral)]" />
      <div className="h-4 w-16 rounded bg-[var(--color-surface-neutral)]" />
      <div className="h-[48px] rounded-[12px] bg-[var(--color-surface-neutral)]" />
      <div className="h-[48px] rounded-[12px] bg-[var(--color-surface-neutral)]" />
      <div className="h-[120px] rounded-[16px] bg-[var(--color-surface-neutral)]" />
    </div>
  );
}

export function ProtectedRouteSkeleton({ variant }: Props) {
  return (
    <main
      className="mx-auto min-h-screen w-full max-w-[390px] animate-pulse bg-[var(--color-surface-bg)] pb-28"
      role="status"
      aria-label="Carregando"
    >
      <SkeletonHeader withBack={variant === "hub"} />
      {variant === "dashboard" ? <DashboardBody /> : null}
      {variant === "list" ? <ListBody /> : null}
      {variant === "hub" ? <HubBody /> : null}
      <SkeletonBottomNav />
    </main>
  );
}
