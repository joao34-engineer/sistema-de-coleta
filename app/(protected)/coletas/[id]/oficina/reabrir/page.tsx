import { ReopenCollectionRoute } from "@/_pages/collection-operations/index.server";

export const dynamic = "force-dynamic";

export default async function ReopenCollectionPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return ReopenCollectionRoute({ collectionId: id });
}
