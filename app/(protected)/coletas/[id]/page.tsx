import { CollectionDetailHubRoute } from "@/_pages/collection-operations/index.server";

export const dynamic = "force-dynamic";

export default async function CollectionDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return CollectionDetailHubRoute({ collectionId: id });
}
