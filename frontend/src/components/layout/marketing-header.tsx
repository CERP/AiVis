"use client";

import { LogOut, Menu, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { useAuthStore } from "@/store/auth-store";

/** Product/How it works are in-page anchors on the landing page; from any other marketing
 * route they need the leading "/" so they navigate home first, then scroll. */
const NAV_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

export function MarketingHeader() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const primaryHref = token ? "/projects" : "/signup";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header className="border-b border-border px-6 py-[18px] sm:px-12 sm:py-[22px]">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-accent">
            <span className="h-2.5 w-2.5 rounded-sm bg-white" />
          </span>
          <span className="font-headline text-[19px] font-bold tracking-tight">AiVis</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
          {!token && (
            <Link href="/login" className="text-sm font-semibold">
              Log in
            </Link>
          )}
          <Button variant="default" size="sm" onClick={() => router.push(primaryHref)}>
            {token ? "Go to projects" : "Start free"}
          </Button>
          {token && <UserMenu />}
        </nav>

        <div className="flex items-center gap-2 md:hidden">
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
        <nav className="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-sm md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMobileNavOpen(false)}
              className="rounded-[var(--radius-token)] px-2 py-2.5 font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          {!token && (
            <Link
              href="/login"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-[var(--radius-token)] px-2 py-2.5 font-semibold hover:bg-surface-muted"
            >
              Log in
            </Link>
          )}
          <Button
            variant="default"
            size="sm"
            className="mt-1"
            onClick={() => {
              setMobileNavOpen(false);
              router.push(primaryHref);
            }}
          >
            {token ? "Go to projects" : "Start free"}
          </Button>
          {token && (
            <>
              <Link
                href="/settings"
                onClick={() => setMobileNavOpen(false)}
                className="mt-2 flex items-center gap-2.5 rounded-[var(--radius-token)] px-2 py-2.5 font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              >
                <Settings aria-hidden className="h-4 w-4" />
                Settings
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  logout();
                  router.push("/");
                }}
                className="flex items-center gap-2.5 rounded-[var(--radius-token)] px-2 py-2.5 text-left font-medium text-negative hover:bg-surface-muted"
              >
                <LogOut aria-hidden className="h-4 w-4" />
                Sign out
              </button>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
