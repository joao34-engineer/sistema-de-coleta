import { AccessDeniedPage } from "@/_pages/dashboard";
import { OfflinePendingBanner } from "@/_app/offline";
import {
  AdministratorAccessDeniedError,
  requireAuthenticatedAdministratorForPage,
  type AuthenticatedAdministrator,
} from "@/shared/auth/require-admin";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { ProtectedNavOutlet } from "@/shared/ui/protected-nav-outlet";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let administrator: AuthenticatedAdministrator;
  try {
    administrator = await requireAuthenticatedAdministratorForPage();
  } catch (error) {
    if (error instanceof AdministratorAccessDeniedError) return <AccessDeniedPage />;
    throw error;
  }

  return (
    <>
      <OfflinePendingBanner actor={{ userId: administrator.userId, organizationId: administrator.organizationId }} />
      <ProtectedNavOutlet>{children}</ProtectedNavOutlet>
      <MobileBottomNav />
    </>
  );
}
