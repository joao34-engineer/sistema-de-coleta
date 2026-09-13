import { Badge } from "@/shared/ui/badge";
import { collectionStatusLabel, type CollectionStatus } from "@/entities/collection";

type Props = Readonly<{ status: CollectionStatus; className?: string }>;

export function CollectionStatusBadge({ status, className }: Props) {
  return (
    <Badge status={status} className={className}>
      {collectionStatusLabel[status]}
    </Badge>
  );
}
