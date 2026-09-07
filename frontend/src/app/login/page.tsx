"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { login } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthStore((s) => s.token);
  const setToken = useAuthStore((s) => s.setToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (token) router.replace(searchParams.get("next") ?? "/projects");
  }, [token, router, searchParams]);

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setToken(data.access_token);
      router.push(searchParams.get("next") ?? "/projects");
    },
  });

  return (
    <AuthSplitLayout mode="login" title="Welcome back" subtitle="Log in to continue your analysis.">
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({ email, password });
        }}
      >
        <label htmlFor="login-email" className="sr-only">
          Work email
        </label>
        <Input
          id="login-email"
          type="email"
          placeholder="Work email"
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
        <Button type="submit" variant="accent" className="mt-1.5" disabled={mutation.isPending}>
          {mutation.isPending ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthSplitLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
