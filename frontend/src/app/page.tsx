"use client";

import { motion } from "framer-motion";
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
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Headline>Turn any dataset into a clear visualization.</Headline>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        >
          <Subtitle>
            Upload data, discover insights, and let Aivis recommend the right charts — then
            refine every detail in the studio.
          </Subtitle>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
        >
          <Button
            variant="accent"
            size="lg"
            onClick={() => router.push(token ? "/projects" : "/signup")}
          >
            Upload a dataset
          </Button>
        </motion.div>
      </section>
    </AppShell>
  );
}
