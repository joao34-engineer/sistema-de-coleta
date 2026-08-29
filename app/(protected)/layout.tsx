import { redirect } from "next/navigation";
import { AccessDeniedPage } from "@/_pages/dashboard";
import { OfflinePendingBanner } from "@/_app/offline";
import {
  AdministratorAccessDeniedError,
  AuthenticationRequiredError,
  requireAuthenticatedAdministrator,
  type AuthenticatedAdministrator,
} from "@/shared/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let administrator: AuthenticatedAdministrator;
  try {
    administrator = await requireAuthenticatedAdministrator();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/login");
    if (error instanceof AdministratorAccessDeniedError) return <AccessDeniedPage />;
    throw error;
  }

  return (
    <>
      <OfflinePendingBanner actor={{ userId: administrator.userId, organizationId: administrator.organizationId }} />
      {children}
    </>
  );
}
