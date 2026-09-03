"use client";

import { FolderKanban, LayoutGrid, Menu } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";

import { ThemeToggle } from "./theme-toggle";

const NAV_LINKS = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/projects", label: "Datasets", icon: LayoutGrid },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="font-headline text-lg font-bold tracking-tight">
            Aivis
          </Link>

          <nav className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <Icon aria-hidden className="h-4 w-4" />
                {label}
              </Link>
            ))}
            <ThemeToggle />
          </nav>

          <div className="flex items-center gap-2 sm:hidden">
            <ThemeToggle />
            <button
              type="button"
              aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-token)] border border-border-strong text-muted-foreground hover:text-foreground"
            >
              <Menu aria-hidden className="h-5 w-5" />
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <nav className="flex flex-col gap-1 border-t border-border px-6 py-3 text-sm sm:hidden">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-2 rounded-[var(--radius-token)] px-2 py-2.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              >
                <Icon aria-hidden className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  );
}
