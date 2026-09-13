import "server-only";

import { loadCollectionForOperation } from "../api/load-operation";
import { getInvoiceReference } from "../api/queries";
import { budgetTotalOf, seedBudgetItemsFromCollection } from "../model/budget-seed";
import { checkInItemsFrom, deliveryItemsFrom, progressItemsFrom } from "../model/workshop-views";
import { BudgetApprovalPage } from "./budget-approval-page";
import { CancelReopenPage } from "./cancel-reopen-page";
import { CustomerDeliveryPage } from "./customer-delivery-page";
import { InvoiceReferencePage } from "./invoice-reference-page";
import { ServiceProgressPage } from "./service-progress-page";
import { TechnicalBudgetPage } from "./technical-budget-page";
import { WorkshopCheckInPage } from "./workshop-checkin-page";

type CollectionRouteInput = Readonly<{ collectionId: string }>;

export async function WorkshopCheckInRoute({ collectionId }: CollectionRouteInput) {
  const { collection } = await loadCollectionForOperation(collectionId, "checkin");
  return (
    <WorkshopCheckInPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      collectionItems={checkInItemsFrom(collection.items)}
      rowVersion={collection.rowVersion}
    />
  );
}

export async function TechnicalBudgetRoute({ collectionId }: CollectionRouteInput) {
  const { collection, budgetItems, missingCheckInItemIds } = await loadCollectionForOperation(collectionId, "orcamento");
  const budgetItemsForForm = seedBudgetItemsFromCollection({
    collectionItems: collection.items,
    budgetItems,
    missingItemIds: missingCheckInItemIds,
  });
  return (
    <TechnicalBudgetPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      budgetItems={budgetItemsForForm}
      budgetTotal={budgetTotalOf(budgetItemsForForm)}
      rowVersion={collection.rowVersion}
    />
  );
}

export async function BudgetApprovalRoute({ collectionId }: CollectionRouteInput) {
  const { collection, budgetItems } = await loadCollectionForOperation(collectionId, "aprovacao");
  return (
    <BudgetApprovalPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      budgetTotal={budgetTotalOf(budgetItems)}
      rowVersion={collection.rowVersion}
    />
  );
}

export async function ServiceProgressRoute({ collectionId }: CollectionRouteInput) {
  const { collection, budgetItems, alreadyDeliveredItemIds } = await loadCollectionForOperation(collectionId, "progresso");
  return (
    <ServiceProgressPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      progressItems={progressItemsFrom(collection.items, budgetItems, alreadyDeliveredItemIds)}
      rowVersion={collection.rowVersion}
    />
  );
}

export async function CustomerDeliveryRoute({ collectionId }: CollectionRouteInput) {
  const { collection, budgetItems, alreadyDeliveredItemIds } = await loadCollectionForOperation(collectionId, "entrega");
  return (
    <CustomerDeliveryPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      items={deliveryItemsFrom(collection.items, budgetItems)}
      alreadyDeliveredItemIds={alreadyDeliveredItemIds}
      rowVersion={collection.rowVersion}
    />
  );
}

export async function InvoiceReferenceRoute({ collectionId }: CollectionRouteInput) {
  const { collection } = await loadCollectionForOperation(collectionId, "nfe");
  const invoice = await getInvoiceReference(collectionId).catch(() => null);
  return (
    <InvoiceReferencePage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      existingInvoice={invoice}
      rowVersion={collection.rowVersion}
    />
  );
}

export async function CancelCollectionRoute({ collectionId }: CollectionRouteInput) {
  const { collection } = await loadCollectionForOperation(collectionId, "cancelar");
  return (
    <CancelReopenPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      allowedAction="cancel"
      rowVersion={collection.rowVersion}
    />
  );
}

export async function ReopenCollectionRoute({ collectionId }: CollectionRouteInput) {
  const { collection } = await loadCollectionForOperation(collectionId, "reabrir");
  return (
    <CancelReopenPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      allowedAction="reopen"
      rowVersion={collection.rowVersion}
    />
  );
}
