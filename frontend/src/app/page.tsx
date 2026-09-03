"use client";

import { useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Headline, Subtitle } from "@/components/ui/typography";
import { useAuthStore } from "@/store/auth-store";

export default function Home() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  return (
    <AppShell>
      <section className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-6 py-24">
        <Headline>Turn any dataset into a clear visualization.</Headline>
        <Subtitle>
          Upload data, discover insights, and let Aivis recommend the right charts — then
          refine every detail in the studio.
        </Subtitle>
        <Button
          variant="accent"
          size="lg"
          onClick={() => router.push(token ? "/projects" : "/signup")}
        >
          Upload a dataset
        </Button>
      </section>
    </AppShell>
  );
}
