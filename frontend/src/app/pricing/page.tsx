"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

interface Tier {
  name: string;
  price: string;
  cadence: string | null;
  description: string;
  features: string[];
  cta: string;
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "For a single analyst sizing up a dataset.",
    features: [
      "1 project",
      "Datasets up to 50MB",
      "Automatic profiling & quality audit",
      "Top-8 chart recommendations",
      "Full visualization studio",
      "SVG & PNG export",
    ],
    cta: "Start free",
  },
  {
    name: "Team",
    price: "$29",
    cadence: "per user / month",
    description: "For teams turning recurring reports around fast.",
    features: [
      "Unlimited projects",
      "Datasets up to 200MB",
      "Everything in Free",
      "Shared projects & visualizations",
      "Saved brand themes",
      "Priority analysis queue",
    ],
    cta: "Start free trial",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: null,
    description: "For organizations with scale and compliance needs.",
    features: [
      "Everything in Team",
      "Custom dataset size limits",
      "SSO & audit logging",
      "Self-hosted deployment option",
      "Dedicated support",
      "Onboarding & training",
    ],
    cta: "Contact sales",
  },
];

const FAQS = [
  {
    q: "What counts as a dataset?",
    a: "Any file you upload — CSV, TSV, JSON, or Excel. Each upload is profiled, analyzed, and versioned independently.",
  },
  {
    q: "Do recommendations differ between plans?",
    a: "No. Every plan runs the same analysis pipeline and the same top-8 ranking. Paid plans raise limits and add collaboration, not analytical quality.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes — upgrade or downgrade at any time. Your projects, datasets, and saved visualizations stay exactly as they are.",
  },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: "easeOut" as const },
});

export default function PricingPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const signupHref = token ? "/projects" : "/signup";

  return (
    <div className="min-h-screen bg-surface">
      <MarketingHeader />

      <section className="mx-auto max-w-[1200px] px-6 py-16 sm:px-12 sm:py-24">
        <motion.div {...fadeUp(0)} className="mx-auto max-w-[640px] text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent-muted px-3 py-1.5 text-[12.5px] font-semibold text-accent-hover">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Pricing
          </div>
          <h1 className="mb-5 font-headline text-[36px] font-bold leading-[1.08] tracking-[-0.02em] text-ink sm:text-[48px]">
            Start free. Pay when your team grows.
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Every plan gets the full analysis pipeline and the complete visualization studio —
            paid tiers add scale and collaboration, never better charts.
          </p>
        </motion.div>

        <div className="mt-14 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              {...fadeUp(0.05 * (i + 1))}
              className={cn(
                "flex h-full flex-col rounded-[14px] border p-7",
                tier.featured
                  ? "border-accent bg-surface shadow-[0_20px_50px_rgba(89,70,229,0.12)] lg:-mt-3 lg:pb-9 lg:pt-9"
                  : "border-border bg-surface"
              )}
            >
              {tier.featured && (
                <span className="mb-4 w-fit rounded-full bg-accent px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.04em] text-accent-foreground">
                  Most popular
                </span>
              )}
              <div className="mb-1.5 font-headline text-lg font-bold">{tier.name}</div>
              <p className="mb-5 text-[13.5px] leading-relaxed text-muted-foreground">
                {tier.description}
              </p>
              <div className="mb-6 flex items-baseline gap-1.5">
                <span className="font-headline text-[40px] font-bold leading-none tracking-[-0.02em]">
                  {tier.price}
                </span>
                {tier.cadence && (
                  <span className="text-[13px] text-subtle-foreground">{tier.cadence}</span>
                )}
              </div>
              {tier.name === "Enterprise" ? (
                <Button variant="outline" className="mb-7 w-full" asChild>
                  <a href="mailto:sales@aivis.app?subject=AiVis%20Enterprise%20enquiry">
                    {tier.cta}
                  </a>
                </Button>
              ) : (
                <Button
                  variant={tier.featured ? "accent" : "outline"}
                  className="mb-7 w-full"
                  onClick={() => router.push(signupHref)}
                >
                  {token ? "Go to projects" : tier.cta}
                </Button>
              )}
              <ul className="flex flex-col gap-2.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-[13.5px]">
                    <Check
                      aria-hidden
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        tier.featured ? "text-accent" : "text-positive-accent"
                      )}
                    />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-surface-muted">
        <div className="mx-auto max-w-[760px] px-6 py-14 sm:px-12 sm:py-[72px]">
          <h2 className="mb-8 font-headline text-[28px] font-bold tracking-[-0.01em]">
            Common questions
          </h2>
          <dl className="flex flex-col gap-6">
            {FAQS.map((faq) => (
              <div key={faq.q}>
                <dt className="mb-1.5 text-[15.5px] font-semibold">{faq.q}</dt>
                <dd className="text-[13.5px] leading-relaxed text-muted-foreground">{faq.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-[760px] px-6 py-16 text-center sm:px-12 sm:py-24">
        <h2 className="mb-3 font-headline text-[28px] font-bold tracking-[-0.01em]">
          Ready to see your data clearly?
        </h2>
        <p className="mb-7 text-[15px] text-muted-foreground">
          Upload a dataset and get eight ranked visualizations in seconds.
        </p>
        <Button variant="accent" size="lg" onClick={() => router.push(signupHref)}>
          {token ? "Go to projects" : "Start free"}
        </Button>
      </section>
    </div>
  );
}
