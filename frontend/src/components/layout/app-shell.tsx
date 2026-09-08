"use client";

import Link from "next/link";
import { BarChart3, FolderKanban } from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const navigation = [
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/chart-gallery", label: "Chart gallery", icon: BarChart3 },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 px-4">
        <div className="mx-auto flex h-[58px] max-w-[980px] items-center justify-between rounded-b-[22px] bg-[#08080a] px-4 shadow-[0_12px_36px_rgba(8,8,10,0.2)] sm:px-5">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 text-white">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-b from-[#9a83ff] to-[#6847ef] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                <span className="h-2.5 w-2.5 rotate-45 rounded-[3px] bg-white" />
              </span>
              <span className="font-headline text-[17px] font-bold tracking-[-0.03em]">AiVis</span>
            </Link>
            <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
              {navigation.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-white/12 text-white"
                        : "text-white/55 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon aria-hidden className="h-3.5 w-3.5" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden border-r border-white/15 pr-3 text-right sm:block">
              <p className="text-[11px] font-semibold text-white">Analytics workspace</p>
              <p className="text-[10px] text-white/45">Gemini assisted</p>
            </div>
            <span className="[&>button]:border-white/15 [&>button]:text-white/60 [&>button:hover]:bg-white/10 [&>button:hover]:text-white"><ThemeToggle /></span>
            <span className="[&>div>button]:bg-white [&>div>button]:text-[#08080a]"><UserMenu /></span>
          </div>
        </div>
      </header>
      <main id="main-content" className="flex-1 bg-[radial-gradient(circle_at_top_left,var(--accent-muted),transparent_28rem)]">
        {children}
      </main>
    </div>
  );
}
