import { Badge } from "@/shared/ui/badge";
import type { CollectionStatus } from "@/shared/model/collection-status";
import { collectionStatusLabel } from "@/shared/model/collection-status";

type Props = Readonly<{ status: CollectionStatus; className?: string }>;

export function CollectionStatusBadge({ status, className }: Props) {
  return (
    <Badge status={status} className={className}>
      {collectionStatusLabel[status]}
    </Badge>
  );
}
