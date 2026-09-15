"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  getStickyPendingPrefix,
  setStickyPendingPrefix,
  subscribeNavPending,
} from "@/shared/ui/nav-pending";
import { ProtectedRouteSkeleton } from "@/shared/ui/protected-route-skeleton";

type SkeletonVariant = "list" | "dashboard" | "hub";

function skeletonVariantForPrefix(prefix: string): SkeletonVariant {
  if (prefix === "/dashboard") return "dashboard";
  return "list";
}

export function ProtectedNavOutlet({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  // Start null so SSR/hydrate always render children; sticky applies after mount.
  const [pendingPrefix, setPendingPrefix] = useState<string | null>(null);

  useEffect(() => {
    setPendingPrefix(getStickyPendingPrefix());
    return subscribeNavPending(setPendingPrefix);
  }, []);

  useEffect(() => {
    if (pendingPrefix !== null && (pathname ?? "").startsWith(pendingPrefix)) {
      setStickyPendingPrefix(null);
    }
  }, [pathname, pendingPrefix]);

  const showSkeleton =
    pendingPrefix !== null && !(pathname ?? "").startsWith(pendingPrefix);

  if (showSkeleton) {
    return <ProtectedRouteSkeleton variant={skeletonVariantForPrefix(pendingPrefix)} />;
  }

  return children;
}
