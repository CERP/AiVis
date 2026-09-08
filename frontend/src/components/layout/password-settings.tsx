"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { changePassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PasswordSettings() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const mutation = useMutation({ mutationFn: changePassword, onSuccess: () => {
    setCurrent(""); setPassword(""); setConfirm(""); setError("");
  } });
  return <Card id="password" className="scroll-mt-24 rounded-2xl">
    <CardHeader><CardTitle className="text-lg">Password</CardTitle><p className="text-sm text-muted-foreground">Use a unique password with at least 8 characters. Existing signed-in sessions remain active.</p></CardHeader>
    <CardContent><form className="space-y-4" onSubmit={(event) => {
      event.preventDefault(); setError("");
      if (password !== confirm) { setError("New passwords do not match."); return; }
      if (new TextEncoder().encode(password).length > 72) { setError("New password must be at most 72 bytes; some characters use multiple bytes."); return; }
      mutation.mutate({ current_password: current, new_password: password });
    }}>
      {[
        { id: "current-password", label: "Current password", value: current, set: setCurrent, auto: "current-password", min: 1, max: 200 },
        { id: "new-password", label: "New password", value: password, set: setPassword, auto: "new-password", min: 8, max: 72 },
        { id: "confirm-password", label: "Confirm new password", value: confirm, set: setConfirm, auto: "new-password", min: 8, max: 72 },
      ].map((field) => {
        const isVisible = !!visible[field.id];
        const VisibilityIcon = isVisible ? EyeOff : Eye;
        return <div key={field.id}>
          <label htmlFor={field.id} className="mb-2 block text-sm font-medium">{field.label}</label>
          <div className="relative">
            <input id={field.id} type={isVisible ? "text" : "password"} autoComplete={field.auto} required minLength={field.min} maxLength={field.max} disabled={mutation.isPending} value={field.value} onChange={(event) => { field.set(event.target.value); setError(""); mutation.reset(); }} className="w-full rounded-lg border border-border-strong bg-background py-2.5 pl-3 pr-12 text-sm focus:outline-2 focus:outline-accent" />
            <button
              type="button"
              aria-label={`${isVisible ? "Hide" : "Show"} ${field.label.toLowerCase()}`}
              aria-pressed={isVisible}
              disabled={mutation.isPending}
              onClick={() => setVisible((state) => ({ ...state, [field.id]: !isVisible }))}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
            >
              <VisibilityIcon aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </div>;
      })}
      {(error || mutation.isError) && <p role="alert" className="text-sm text-negative">{error || (mutation.error instanceof ApiError && mutation.error.status === 400 ? mutation.error.detail : "Couldn’t update your password. Please try again.")}</p>}
      {mutation.isSuccess && <p role="status" className="text-sm text-positive">Password updated successfully.</p>}
      <Button variant="accent" disabled={mutation.isPending}>{mutation.isPending ? "Updating…" : "Update password"}</Button>
    </form></CardContent>
  </Card>;
}
