import { BillingReferencePage } from "@/_pages/collection-operations";

interface PageParams {
  params: Promise<{ id: string }>;
}

export default async function BillingReferenceRoute({ params }: PageParams) {
  const { id } = await params;

  return (
    <BillingReferencePage
      collectionId={id}
      officialCode="MJT-2026-000102"
      expectedVersion={1}
      existingReference={null}
    />
  );
}
