import { redirect } from "next/navigation";
import { AccessDeniedPage } from "@/_pages/dashboard";
import { AdministratorAccessDeniedError, AuthenticationRequiredError, requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  try {
    await requireAuthenticatedAdministrator();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/login");
    if (error instanceof AdministratorAccessDeniedError) return <AccessDeniedPage />;
    throw error;
  }
  return <>{children}</>;
}
