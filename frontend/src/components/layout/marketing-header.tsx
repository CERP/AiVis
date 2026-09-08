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
    <header className="sticky top-0 z-40 px-4">
      <div className="mx-auto flex h-[58px] max-w-[980px] items-center justify-between rounded-b-[22px] bg-[#08080a] px-4 shadow-[0_12px_36px_rgba(8,8,10,0.2)] sm:px-5">
        <Link href="/" className="flex items-center gap-2.5 text-white">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-b from-[#9a83ff] to-[#6847ef] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
            <span className="h-2.5 w-2.5 rotate-45 rounded-[3px] bg-white" />
          </span>
          <span className="font-headline text-[17px] font-bold tracking-[-0.03em]">AiVis</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Account navigation">
          <span className="[&>button]:border-white/15 [&>button]:text-white/60 [&>button:hover]:bg-white/10 [&>button:hover]:text-white"><ThemeToggle /></span>
          {!token && (
            <Link href="/login" className="rounded-lg px-3 py-2 text-[13px] font-semibold text-white/75 hover:text-white">
              Log in
            </Link>
          )}
          <Button className="bg-white text-[#08080a] hover:bg-white/90" variant="default" size="sm" onClick={() => router.push(primaryHref)}>
            {token ? "Go to projects" : "Start free"}
          </Button>
          {token && <span className="[&>div>button]:bg-white [&>div>button]:text-[#08080a]"><UserMenu /></span>}
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <span className="[&>button]:border-white/15 [&>button]:text-white/70"><ThemeToggle /></span>
          <button
            type="button"
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-token)] border border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Menu aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </div>

      {mobileNavOpen && (
        <nav className="mx-auto mt-2 flex max-w-[980px] flex-col gap-1 rounded-2xl bg-[#08080a] p-3 text-sm text-white shadow-xl md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMobileNavOpen(false)}
              className="rounded-[var(--radius-token)] px-2 py-2.5 font-medium text-white/65 hover:bg-white/10 hover:text-white"
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
