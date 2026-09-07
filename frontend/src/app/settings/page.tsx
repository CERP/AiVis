"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProcessingState } from "@/components/ui/states";
import { me } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";

export default function SettingsPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const userQuery = useQuery({ queryKey: ["me"], queryFn: me });

  return (
    <AppShell>
      <section className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16">
        <h1 className="font-headline text-3xl font-bold">Settings</h1>

        {userQuery.isLoading && <ProcessingState label="Loading account…" />}

        {userQuery.data && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Full name
                </p>
                <p className="mt-1 text-sm">{userQuery.data.full_name ?? "Not set"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                <p className="mt-1 text-sm">{userQuery.data.email}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => {
                logout();
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
