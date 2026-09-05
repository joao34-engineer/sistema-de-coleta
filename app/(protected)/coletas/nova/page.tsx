import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { CollectionCapturePage } from "@/_pages/collection-drafts/ui/collection-capture-page";

type Props = Readonly<{
  searchParams: Promise<{ rascunho?: string }>;
}>;

const draftIdSchema = z.string().uuid();

export default async function NovaColetaRoute({ searchParams }: Props) {
  const administrator = await requireAuthenticatedAdministrator();
  const params = await searchParams;
  const resumeId = params.rascunho;
  if (resumeId !== undefined && draftIdSchema.safeParse(resumeId).success) {
    redirect(`/coletas/${resumeId}/itens`);
  }
  return (
    <CollectionCapturePage
      actor={{ userId: administrator.userId, organizationId: administrator.organizationId }}
    />
  );
}
