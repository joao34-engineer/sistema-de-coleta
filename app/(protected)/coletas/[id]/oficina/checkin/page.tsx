import { WorkshopCheckInRoute } from "@/_pages/collection-operations/index.server";

export const dynamic = "force-dynamic";

export default async function WorkshopCheckInPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return WorkshopCheckInRoute({ collectionId: id });
}
