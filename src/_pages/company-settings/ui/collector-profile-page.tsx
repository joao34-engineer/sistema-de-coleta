import type { Route } from "next";
import type { AuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Card } from "@/shared/ui/card";
import { SignOutForm } from "@/shared/ui/sign-out-form";
import { PendingNavLink } from "@/shared/ui/pending-nav-link";
import { buttonClassName } from "@/shared/lib/button-class-name";
import { operatorDisplayName } from "@/shared/auth/operator-display-name";
import {
  hubChrome,
  hubLegalFact,
  hubProfileFact,
  hubSignOutFact,
  settingsLogoSrc,
} from "../model/settings-chrome";

type Props = Readonly<{
  administrator: AuthenticatedAdministrator;
}>;

const issuerHref = "/configuracoes/empresa?from=/configuracoes" as Route;

function AccountFact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Card className="min-h-[58px] px-5 py-3">
      <p className="text-[12px] font-semibold leading-4 text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-0.5 break-words text-[13px] font-normal leading-5 text-[var(--color-text-muted)]">{value}</p>
    </Card>
  );
}

function AccountFactLink({
  label,
  value,
  href,
}: Readonly<{ label: string; value: string; href: Route }>) {
  return (
    <PendingNavLink
      href={href}
      className="block rounded-[16px] outline-offset-2"
      contentClassName="block w-full"
      pendingClassName="opacity-70"
    >
      <AccountFact label={label} value={value} />
    </PendingNavLink>
  );
}

export function CollectorProfilePage({ administrator }: Props) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-surface-bg)] pb-[calc(5.25rem+env(safe-area-inset-bottom,0px)+1.5rem)]">
      <MobilePageHeader
        logoSrc={settingsLogoSrc}
        title={hubChrome.title}
        subtitle={hubChrome.subtitle}
      />

      <div className="flex flex-col gap-3.5 px-6 pt-7">
        <div>
          <h2 className="text-[20px] font-semibold leading-8 text-[var(--color-text-primary)]">
            Operador autenticado
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-[var(--color-text-muted)]">
            {operatorDisplayName(administrator.fullName)}
          </p>
        </div>

        <AccountFact label="Organização" value={administrator.organizationName} />
        <AccountFact label="Função" value={administrator.role} />
        <AccountFact label="E-mail" value={administrator.email} />
        <AccountFactLink label={hubLegalFact.label} value={hubLegalFact.value} href={issuerHref} />
        <AccountFactLink label={hubProfileFact.label} value={hubProfileFact.value} href={issuerHref} />

        <PendingNavLink
          href={issuerHref}
          className={buttonClassName({ variant: "primary", size: "md" })}
        >
          Editar perfil institucional
        </PendingNavLink>

        <Card className="px-5 py-3">
          <p className="text-[12px] font-semibold leading-4 text-[var(--color-text-muted)]">{hubSignOutFact.label}</p>
          <p className="mt-0.5 text-[13px] font-normal leading-5 text-[var(--color-text-muted)]">
            {hubSignOutFact.value}
          </p>
          <SignOutForm size="md" className="mt-3" />
        </Card>
      </div>

      <MobileBottomNav />
    </main>
  );
}
