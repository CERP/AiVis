"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PasswordSettings } from "@/components/layout/password-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProcessingState } from "@/components/ui/states";
import { me, updateProfile } from "@/lib/api/auth";
import { useThemeStore } from "@/store/theme-store";
import { useAuthStore } from "@/store/auth-store";

export default function SettingsPage() {
  const router = useRouter();
  const cache = useQueryClient();
  const { theme, toggleTheme } = useThemeStore();
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({ mutationFn: updateProfile, onSuccess: (user) => { cache.setQueryData(["me"], user); setDraft(null); } });
  const logout = useAuthStore((s) => s.logout);
  const userQuery = useQuery({ queryKey: ["me"], queryFn: me });

  return (
    <AppShell>
      <section className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Your workspace</p>
        <h1 className="font-headline text-3xl font-bold">Settings</h1>
        <p className="-mt-3 text-sm text-muted-foreground">Manage your profile, appearance, and current session.</p>
        <nav aria-label="Settings sections" className="flex gap-5 border-b border-border pb-4 text-sm text-muted-foreground">
          <a href="#profile" className="hover:text-accent">Profile</a><a href="#appearance" className="hover:text-accent">Appearance</a><a href="#session" className="hover:text-accent">Session</a>
        </nav>

        {userQuery.isLoading && <ProcessingState label="Loading account…" />}
        {userQuery.isError && <div role="alert"><p className="mb-3 text-negative">Couldn&apos;t load your profile.</p><Button variant="outline" onClick={() => userQuery.refetch()}>Try again</Button></div>}

        {userQuery.data && (
          <Card id="profile" className="scroll-mt-24 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Personal profile</CardTitle>
              <p className="text-sm text-muted-foreground">Your name appears in the account menu throughout AiVis.</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); save.mutate((draft ?? userQuery.data.full_name ?? "").trim()); }}>
                <label htmlFor="full-name" className="block text-sm font-medium">Full name</label>
                <input id="full-name" autoComplete="name" required maxLength={200} disabled={save.isPending} value={draft ?? userQuery.data.full_name ?? ""} onChange={(event) => { setDraft(event.target.value); save.reset(); }} className="w-full rounded-lg border border-border-strong bg-background px-3 py-2.5 text-sm focus:outline-2 focus:outline-accent" />
                <div className="flex gap-2"><Button variant="accent" disabled={save.isPending || draft === null || !draft.trim() || draft.trim() === userQuery.data.full_name}>{save.isPending ? "Saving…" : "Save changes"}</Button><Button type="button" variant="outline" disabled={draft === null || save.isPending} onClick={() => { setDraft(null); save.reset(); }}>Cancel</Button></div>
                {save.isError && <p role="alert" className="text-sm text-negative">Couldn&apos;t save your name. Please try again.</p>}
                {save.isSuccess && <p role="status" className="text-sm text-positive">Profile updated.</p>}
              </form>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                <p className="mt-1 text-sm">{userQuery.data.email}</p>
                <p className="mt-2 text-xs text-muted-foreground">Your sign-in address. Email changes are currently unavailable.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card id="appearance" className="scroll-mt-24 rounded-2xl">
          <CardHeader><CardTitle className="text-lg">Appearance</CardTitle><p className="text-sm text-muted-foreground">Choose a theme. Your preference is saved automatically in this browser.</p></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {(["light", "dark"] as const).map((option) => <button key={option} aria-pressed={theme === option} onClick={() => { if (theme !== option) toggleTheme(); }} className={`rounded-xl border-2 p-4 text-left focus-visible:outline-2 focus-visible:outline-accent ${theme === option ? "border-accent bg-accent-muted" : "border-border"}`}><div aria-hidden className={`mb-3 h-20 rounded-lg p-3 ${option === "light" ? "bg-[#eef0f5]" : "bg-[#0b0c10]"}`}><div className="mb-2 h-2 w-2/3 rounded bg-[#7257e8]" /><div className={`h-9 rounded ${option === "light" ? "bg-white" : "bg-[#252735]"}`} /></div><span className="text-sm font-medium">{option === "light" ? "Light" : "Dark"}{theme === option ? " · Selected" : ""}</span></button>)}
          </CardContent>
        </Card>
        <PasswordSettings />
        <Card id="session" className="scroll-mt-24 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
            <p className="text-sm text-muted-foreground">Sign out of AiVis in this browser.</p>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => {
                logout();
                cache.clear();
                router.push("/");
              }}
            >
              Sign out
            </Button>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
