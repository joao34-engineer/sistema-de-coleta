import { CancelCollectionRoute } from "@/_pages/collection-operations/index.server";

export const dynamic = "force-dynamic";

export default async function CancelCollectionPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return CancelCollectionRoute({ collectionId: id });
}
