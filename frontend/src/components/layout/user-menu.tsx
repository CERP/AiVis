"use client";

import { useQuery } from "@tanstack/react-query";
import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { me } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";

function initialsFor(fullName: string | null, email: string): string {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const userQuery = useQuery({ queryKey: ["me"], queryFn: me, enabled: !!token });
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Sign-out must always be reachable from this menu, even if /api/auth/me is down --
  // the token itself is enough to know an account menu should be shown at all.
  if (!token) return null;

  const user = userQuery.data;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background transition-opacity hover:opacity-90"
      >
        {user ? initialsFor(user.full_name, user.email) : <User aria-hidden className="h-4 w-4" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-[var(--radius-token)] border border-border bg-surface py-1.5 shadow-lg">
          <div className="border-b border-border px-3.5 py-2.5">
            {user ? (
              <>
                <p className="truncate text-sm font-semibold">{user.full_name ?? user.email}</p>
                {user.full_name && (
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                )}
              </>
            ) : userQuery.isError ? (
              <p className="text-xs text-negative">Couldn&apos;t load account details.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Loading account…</p>
            )}
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-foreground hover:bg-surface-muted"
          >
            <Settings aria-hidden className="h-4 w-4 text-muted-foreground" />
            Settings
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
              router.push("/");
            }}
            className="flex w-full items-center gap-2.5 border-t border-border px-3.5 py-2.5 text-left text-sm text-negative hover:bg-surface-muted"
          >
            <LogOut aria-hidden className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
