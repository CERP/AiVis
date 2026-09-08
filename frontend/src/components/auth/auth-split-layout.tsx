"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Tabs } from "@/components/ui/tabs";

export function AuthSplitLayout({
  mode,
  title,
  subtitle,
  children,
}: {
  mode: "login" | "signup";
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-panel p-16 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="h-[26px] w-[26px] rounded-md bg-accent" />
          <span className="font-headline text-lg font-bold">AiVis</span>
        </Link>

        <div>
          <div className="mb-3.5 font-mono text-xs text-[#6C6E7A]">
            RECOMMENDED · confidence 95%
          </div>
          <div className="mb-5 font-headline text-2xl font-semibold leading-snug">
            &quot;Attendance strongly predicts assessment score (r = 0.71)&quot;
          </div>
          <svg width="100%" height="120" viewBox="0 0 320 120" className="overflow-visible">
            {[
              [20, 95], [55, 80], [80, 70], [110, 60], [140, 55], [160, 42],
              [190, 38], [215, 28], [245, 20], [270, 15], [300, 8],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3.5} fill="#5946E5" opacity={0.75} />
            ))}
            <line x1={10} y1={100} x2={310} y2={10} stroke="#8B8D99" strokeWidth={1} strokeDasharray="3 3" />
          </svg>
        </div>

        <div className="text-[13px] text-[#6C6E7A]">
          Trusted by analytics teams turning 48,000-row spreadsheets into board-ready decks.
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-10 sm:p-12">
        <div className="w-full max-w-[380px]">
          <Tabs
            layoutId="auth-tab"
            className="mb-8 w-full"
            value={mode}
            onChange={(id) => router.push(id === "login" ? "/login" : "/signup")}
            options={[
              { id: "login", label: "Log in" },
              { id: "signup", label: "Sign up" },
            ]}
          />
          <h1 className="mb-1.5 font-headline text-[26px] font-bold">{title}</h1>
          <p className="mb-7 text-sm text-muted-foreground">{subtitle}</p>
          {children}
          <p className="mt-5 text-center text-[13px] text-subtle-foreground">
            By continuing you agree to the Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
