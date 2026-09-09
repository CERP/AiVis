"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

// Chart Explorer's real /explorer route + rebuilt taxonomy ships in Batch 7. Until then the nav
// label already reads "Chart Explorer" and points at the existing /chart-gallery implementation
// -- swap this href to "/explorer" once that batch lands, no other change needed here.
const NAVIGATION = [
  { href: "/projects", label: "Projects" },
  { href: "/chart-gallery", label: "Chart Explorer" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 h-12 shrink-0 border-b border-border bg-surface">
        <div className="flex h-full items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-foreground">
              <span className="relative flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm-token)] bg-accent">
                <span className="h-2 w-2 rotate-45 rounded-[2px] bg-accent-foreground" />
              </span>
              <span className="font-headline text-[15px] font-semibold tracking-tight">AiVis</span>
            </Link>
            <nav aria-label="Primary navigation" className="flex items-center gap-1">
              {NAVIGATION.map(({ href, label }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-[var(--radius-sm-token)] border-b-2 px-2 py-1 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 ${
                      active
                        ? "border-accent text-accent"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  );
}
