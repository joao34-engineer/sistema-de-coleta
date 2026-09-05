"use client";

import type { Route } from "next";
import type { CollectionStatus } from "@/shared/model/collection-status";
import { buttonClassName } from "@/shared/ui/button";
import { PendingNavLink } from "@/shared/ui/pending-nav-link";
import {
  operationalActionsForStatus,
  type OperationalAction,
} from "../model/operational-actions";

export type { OperationalAction, OperationalSegment, OperationalActionPair } from "../model/operational-actions";
export {
  nextOperationalAction,
  secondaryOperationalAction,
  operationalActionsForStatus,
} from "../model/operational-actions";

type Props = Readonly<{
  collectionId: string;
  status: CollectionStatus;
}>;

function actionHref(collectionId: string, action: OperationalAction): Route {
  return `/coletas/${collectionId}/oficina/${action.segment}` as Route;
}

export function OperationalActions({ collectionId, status }: Props) {
  const { primary, secondary } = operationalActionsForStatus(status);
  if (!primary && !secondary) return null;

  return (
    <div className="flex flex-col gap-2">
      {primary ? (
        <PendingNavLink
          href={actionHref(collectionId, primary)}
          prefetch
          className="flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[var(--color-primary)] text-[14px] font-semibold text-white shadow-xs transition-all hover:bg-[var(--color-primary-strong)] active:scale-[0.99] active:bg-[var(--color-primary-strong)]"
          contentClassName="flex h-full w-full items-center justify-center rounded-[12px]"
          pendingClassName="opacity-80 ring-2 ring-white/50"
        >
          {primary.label}
        </PendingNavLink>
      ) : null}
      {secondary ? (
        <PendingNavLink
          href={actionHref(collectionId, secondary)}
          prefetch
          className={buttonClassName({ variant: "secondary", size: "md" })}
          contentClassName="flex h-full w-full items-center justify-center rounded-[12px]"
          pendingClassName="opacity-80"
        >
          {secondary.label}
        </PendingNavLink>
      ) : null}
    </div>
  );
}
