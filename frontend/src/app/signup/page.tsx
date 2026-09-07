"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { signup } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";

export default function SignupPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const setToken = useAuthStore((s) => s.setToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");

  useEffect(() => {
    if (token) router.replace("/projects");
  }, [token, router]);

  const mutation = useMutation({
    mutationFn: signup,
    onSuccess: (data) => {
      setToken(data.access_token);
      router.push("/projects");
    },
  });

  return (
    <AuthSplitLayout
      mode="signup"
      title="Create your account"
      subtitle="Start turning datasets into board-ready charts."
    >
      <form
        className="flex flex-col gap-3.5"
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
          Work email
        </label>
        <Input
          id="signup-email"
          type="email"
          placeholder="Work email"
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
            {mutation.error instanceof ApiError ? mutation.error.detail : "Something went wrong."}
          </p>
        )}
        <Button type="submit" variant="accent" className="mt-1.5" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthSplitLayout>
  );
}
