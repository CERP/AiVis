"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Subtitle } from "@/components/ui/typography";
import { ApiError } from "@/lib/api/client";
import { signup } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";

export default function SignupPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");

  const mutation = useMutation({
    mutationFn: signup,
    onSuccess: (data) => {
      setToken(data.access_token);
      router.push("/projects");
    },
  });

  return (
    <AppShell>
      <section className="mx-auto flex max-w-sm flex-col gap-6 px-6 py-24">
        <Card>
          <CardHeader>
            <CardTitle>Create an account</CardTitle>
            <Subtitle className="text-sm">Start visualizing your data.</Subtitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate({ email, password, organization_name: organizationName });
              }}
            >
              <label htmlFor="signup-org" className="sr-only">
                Organization name
              </label>
              <Input
                id="signup-org"
                type="text"
                placeholder="Organization name"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
              />
              <label htmlFor="signup-email" className="sr-only">
                Email
              </label>
              <Input
                id="signup-email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label htmlFor="signup-password" className="sr-only">
                Password
              </label>
              <Input
                id="signup-password"
                type="password"
                placeholder="Password (min 8 characters)"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {mutation.isError && (
                <p role="alert" className="text-sm text-negative">
                  {mutation.error instanceof ApiError
                    ? mutation.error.detail
                    : "Something went wrong."}
                </p>
              )}
              <Button type="submit" variant="accent" disabled={mutation.isPending}>
                {mutation.isPending ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
