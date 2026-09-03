"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Subtitle } from "@/components/ui/typography";
import { ApiError } from "@/lib/api/client";
import { login } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setToken = useAuthStore((s) => s.setToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setToken(data.access_token);
      router.push(searchParams.get("next") ?? "/projects");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <Subtitle className="text-sm">Continue to your projects.</Subtitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate({ email, password });
          }}
        >
          <label htmlFor="login-email" className="sr-only">
            Email
          </label>
          <Input
            id="login-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="login-password" className="sr-only">
            Password
          </label>
          <Input
            id="login-password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {mutation.isError && (
            <p role="alert" className="text-sm text-negative">
              {mutation.error instanceof ApiError ? mutation.error.detail : "Something went wrong."}
            </p>
          )}
          <Button type="submit" variant="accent" disabled={mutation.isPending}>
            {mutation.isPending ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <AppShell>
      <section className="mx-auto flex max-w-sm flex-col gap-6 px-6 py-24">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </section>
    </AppShell>
  );
}
