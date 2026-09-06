import { z } from "zod";
import { collectionStatusSchema } from "./contracts";
import { collectionStatuses, type CollectionStatus, type CollectionsListFilter } from "@/shared/model/collection-status";

export type { CollectionStatus, CollectionsListFilter };
export {
  matchesStatusFilter,
  collectionStatusLabel,
  inRepairStatuses,
  readyForDeliveryStatuses,
  inProgressStatuses,
  statusesForListFilter,
  isReadyForDelivery,
} from "@/shared/model/collection-status";
export { collectionStatuses };

// Paridade em tempo de compilação entre o enum Zod canônico e o tipo compartilhado.
type StatusParity = Exclude<(typeof collectionStatuses)[number], z.infer<typeof collectionStatusSchema>> extends never ? true : false;
const _statusParityCheck: StatusParity = true;
void _statusParityCheck;
