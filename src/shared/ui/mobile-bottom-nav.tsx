"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";
import {
  getStickyPendingPrefix,
  resetNavPendingForTests,
  setStickyPendingPrefix,
  subscribeNavPending,
} from "@/shared/ui/nav-pending";
import { PendingNavLink } from "@/shared/ui/pending-nav-link";

type IconComponent = (props: { className?: string }) => ReactNode;

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const HomeIcon: IconComponent = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path {...strokeProps} d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" />
    <path {...strokeProps} d="M9.5 20.5v-6h5v6" />
  </svg>
);

const ClipboardIcon: IconComponent = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <rect {...strokeProps} x="5.5" y="4.5" width="13" height="16" rx="2" />
    <path {...strokeProps} d="M9 4.5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v.5" />
    <path {...strokeProps} d="M9 10.5h6M9 14h4" />
  </svg>
);

const SettingsIcon: IconComponent = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <circle {...strokeProps} cx="12" cy="12" r="3" />
    <path
      {...strokeProps}
      d="M12 3.5 13 6a6.2 6.2 0 0 1 2.1 1.2l2.5-.7 1.4 2.4-1.8 1.9a6.4 6.4 0 0 1 0 2.4l1.8 1.9-1.4 2.4-2.5-.7A6.2 6.2 0 0 1 13 18l-1 2.5h-2L9 18a6.2 6.2 0 0 1-2.1-1.2l-2.5.7-1.4-2.4 1.8-1.9a6.4 6.4 0 0 1 0-2.4L3 9l1.4-2.4 2.5.7A6.2 6.2 0 0 1 9 6l1-2.5h2Z"
    />
  </svg>
);

interface NavItem {
  label: string;
  href: Route;
  icon: IconComponent;
  matchPrefix: string;
}

const navItems: ReadonlyArray<NavItem> = [
  { label: "Início", href: "/dashboard" as Route, icon: HomeIcon, matchPrefix: "/dashboard" },
  { label: "Coletas", href: "/coletas" as Route, icon: ClipboardIcon, matchPrefix: "/coletas" },
  { label: "Configurações", href: "/configuracoes" as Route, icon: SettingsIcon, matchPrefix: "/configuracoes" },
];

function selectPendingPrefix(prefix: string) {
  setStickyPendingPrefix(prefix);
}

function clearPendingPrefix() {
  setStickyPendingPrefix(null);
}

/** Test-only: wipe sticky tab selection between cases. */
export function resetMobileBottomNavStickyForTests() {
  resetNavPendingForTests();
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  // Start null so SSR/hydrate match; sticky restores after mount (survives soft-nav remounts).
  const [pendingPrefix, setPendingPrefix] = useState<string | null>(null);

  useEffect(() => {
    setPendingPrefix(getStickyPendingPrefix());
    return subscribeNavPending(setPendingPrefix);
  }, []);

  useEffect(() => {
    for (const item of navItems) {
      router.prefetch(item.href);
    }
  }, [router]);

  useEffect(() => {
    if (pendingPrefix !== null && (pathname ?? "").startsWith(pendingPrefix)) {
      clearPendingPrefix();
    }
  }, [pathname, pendingPrefix]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto flex min-h-[84px] w-full max-w-md items-center justify-around rounded-t-[18px] border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] shadow-lg">
      {navItems.map((item) => {
        const pathActive = (pathname ?? "").startsWith(item.matchPrefix);
        const isActive = pendingPrefix !== null ? pendingPrefix === item.matchPrefix : pathActive;
        const Icon = item.icon;

        return (
          <PendingNavLink
            key={item.label}
            href={item.href}
            prefetch={true}
            onPointerDown={() => {
              selectPendingPrefix(item.matchPrefix);
              router.prefetch(item.href);
            }}
            onClick={() => selectPendingPrefix(item.matchPrefix)}
            className="flex h-[56px] min-w-[88px] flex-col items-center justify-center rounded-[12px] px-2 text-center focus-visible:outline-none"
            contentClassName="flex w-full flex-col items-center justify-center rounded-[12px]"
            pendingClassName=""
            {...(isActive ? { "aria-current": "page" as const } : {})}
          >
            {/* Pill no span interno: Next <Link> nem sempre reaplica `style` no <a> durante soft nav. */}
            <span
              className="flex flex-col items-center justify-center gap-0.5 rounded-[12px] px-3 py-2"
              style={{
                backgroundColor: isActive ? "var(--color-surface-green)" : "transparent",
                color: isActive ? "var(--color-primary-strong)" : "var(--color-muted)",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-[11px] tracking-tight">{item.label}</span>
            </span>
          </PendingNavLink>
        );
      })}
    </nav>
  );
}
