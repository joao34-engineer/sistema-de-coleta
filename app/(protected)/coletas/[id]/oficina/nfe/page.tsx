import { InvoiceReferenceRoute } from "@/_pages/collection-operations/index.server";

export const dynamic = "force-dynamic";

export default async function InvoiceReferencePage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return InvoiceReferenceRoute({ collectionId: id });
}
