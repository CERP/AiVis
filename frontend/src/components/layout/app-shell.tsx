import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="font-headline text-lg font-bold tracking-tight">
            Aivis
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/projects" className="transition-colors hover:text-foreground">
              Projects
            </Link>
            <Link href="/projects" className="transition-colors hover:text-foreground">
              Datasets
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
