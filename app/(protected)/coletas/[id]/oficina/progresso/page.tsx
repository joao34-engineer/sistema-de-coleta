import { ServiceProgressRoute } from "@/_pages/collection-operations/index.server";

export const dynamic = "force-dynamic";

export default async function ServiceProgressPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return ServiceProgressRoute({ collectionId: id });
}
