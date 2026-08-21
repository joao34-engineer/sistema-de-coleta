"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

interface NavItem {
  label: string;
  href: Route;
  icon: string;
}

const navItems: ReadonlyArray<NavItem> = [
  { label: "Início", href: "/coletas" as Route, icon: "🏠" },
  { label: "Coletas", href: "/coletas" as Route, icon: "📋" },
  { label: "Documentos", href: "/coletas" as Route, icon: "📄" },
  { label: "Configurações", href: "/configuracoes" as Route, icon: "⚙️" },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto flex h-[84px] w-full max-w-md items-center justify-around rounded-t-[18px] border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2 shadow-lg">
      {navItems.map((item) => {
        const isActive =
          item.href === "/configuracoes"
            ? pathname === "/configuracoes"
            : pathname.startsWith("/coletas");

        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex h-[48px] min-w-[76px] flex-col items-center justify-center rounded-[12px] px-2 py-1 text-center transition-all ${
              isActive
                ? "bg-[var(--color-surface-green)] text-[var(--color-primary-strong)] font-semibold"
                : "text-[var(--color-muted)] hover:text-[var(--color-text)] font-normal"
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span className="mt-1 text-[11px] tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
