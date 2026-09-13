import { CustomerDeliveryRoute } from "@/_pages/collection-operations/index.server";

export const dynamic = "force-dynamic";

export default async function CustomerDeliveryPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return CustomerDeliveryRoute({ collectionId: id });
}
