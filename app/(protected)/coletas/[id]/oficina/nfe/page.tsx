import { getInvoiceReference } from "@/_pages/collection-operations/api/queries";
import { loadCollectionForOperation } from "../../load-operation";
import { InvoiceReferencePage } from "@/_pages/collection-operations/ui/invoice-reference-page";

export const dynamic = "force-dynamic";

export default async function InvoiceReferenceRoute({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const [collection, invoice] = await Promise.all([loadCollectionForOperation(id), getInvoiceReference(id).catch(() => null)]);

  return (
    <InvoiceReferencePage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      existingInvoice={invoice}
      rowVersion={collection.rowVersion}
    />
  );
}
