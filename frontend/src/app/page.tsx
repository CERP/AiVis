"use client";

import { motion } from "framer-motion";
import { Download, SlidersHorizontal, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { useAuthStore } from "@/store/auth-store";

const STATS = [
  { value: "8", label: "curated charts, not 80" },
  { value: "3.1s", label: "median time to first insight" },
  { value: "120+", label: "column types recognized" },
];

const PIPELINE_STEPS = [
  { n: "01", title: "Upload", description: "Drop a CSV, TSV, JSON, or Excel file. No schema required." },
  { n: "02", title: "Profile & clean", description: "Every column typed, quality issues surfaced with one-click fixes." },
  { n: "03", title: "Recommend", description: "8 ranked visualizations, each with the analytical reasoning behind it." },
  { n: "04", title: "Studio", description: "Map fields, brand it, filter, annotate, export.", inverted: true },
];

const FEATURES = [
  {
    icon: Sparkles,
    iconBg: "bg-accent-muted",
    iconColor: "text-accent",
    title: "Reasoning, not guesswork",
    description: "Each recommendation cites the exact insight — correlation, trend, outlier — that produced it.",
  },
  {
    icon: SlidersHorizontal,
    iconBg: "bg-positive-bg",
    iconColor: "text-positive-accent",
    title: "Precise data mapping",
    description: "Every field carries its type. Color, filters, and axes stay legible even with dozens of categories.",
  },
  {
    icon: Download,
    iconBg: "bg-secondary-bg",
    iconColor: "text-secondary",
    title: "Export that keeps its polish",
    description: "PNG, PDF, or PPTX — typography, annotations, and brand color survive the export.",
  },
];

const PREVIEW_BARS = [62, 88, 47, 71, 95, 55];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: "easeOut" as const },
});

export default function LandingPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const primaryHref = token ? "/projects" : "/signup";

  return (
    <div className="min-h-screen bg-surface">
      <MarketingHeader />

      <section className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-16 px-6 py-16 sm:px-12 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <motion.div {...fadeUp(0)}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent-muted px-3 py-1.5 text-[12.5px] font-semibold text-accent-hover">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              AI-driven visualization engine
            </div>
          </motion.div>
          <motion.div {...fadeUp(0.05)}>
            <h1 className="mb-6 font-headline text-[36px] font-bold leading-[1.08] tracking-[-0.02em] text-ink sm:text-[56px] sm:leading-[1.04]">
              Every dataset, understood before a single chart is drawn.
            </h1>
          </motion.div>
          <motion.div {...fadeUp(0.1)}>
            <p className="mb-9 max-w-[480px] text-lg leading-relaxed text-muted-foreground">
              AiVis profiles your data, ranks the visualizations that actually answer your
              questions, and hands you a professional studio to finish the job — branded,
              filtered, and export-ready.
            </p>
          </motion.div>
          <motion.div {...fadeUp(0.15)} className="mb-11 flex flex-wrap gap-3">
            <Button variant="accent" size="lg" onClick={() => router.push(primaryHref)}>
              Upload a dataset
            </Button>
            <Button variant="outline" size="lg">
              Watch a 90s demo
            </Button>
          </motion.div>
          <motion.div {...fadeUp(0.2)} className="flex flex-wrap gap-6 sm:gap-9">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <div className="font-headline text-[22px] font-bold">{stat.value}</div>
                <div className="text-[12.5px] text-subtle-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div {...fadeUp(0.1)} className="rounded-2xl bg-panel p-5 shadow-[0_24px_60px_rgba(11,12,16,0.25)]">
          <div className="mb-4 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#3A3B44]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#3A3B44]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#3A3B44]" />
            <span className="ml-2 font-mono text-[11px] text-[#6C6E7A]">
              student_performance_2025.csv · 48,236 rows
            </span>
          </div>
          <div className="rounded-[10px] bg-ink p-5">
            <div className="mb-2.5 font-mono text-[11px] text-subtle-foreground">
              RECOMMENDED · confidence 92%
            </div>
            <div className="mb-3.5 font-headline text-base font-semibold text-white">
              Assessment scores vary sharply by district
            </div>
            <div className="flex h-[100px] items-end gap-2">
              {PREVIEW_BARS.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-b from-accent to-accent-hover"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 border-t border-border bg-surface-muted">
        <div className="mx-auto max-w-[1200px] px-6 py-14 sm:px-12 sm:py-[72px]">
          <div className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-accent">
            The pipeline
          </div>
          <h2 className="mb-10 font-headline text-[32px] font-bold tracking-[-0.01em]">
            From raw file to presentation-ready chart
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PIPELINE_STEPS.map((step) => (
              <div
                key={step.n}
                className={
                  step.inverted
                    ? "rounded-[14px] border border-ink bg-ink p-6"
                    : "rounded-[14px] border border-border bg-surface p-6"
                }
              >
                <div className="mb-3.5 font-mono text-xs text-subtle-foreground">{step.n}</div>
                <div
                  className={`mb-2 text-base font-semibold ${step.inverted ? "text-white" : ""}`}
                >
                  {step.title}
                </div>
                <div
                  className={`text-[13.5px] leading-relaxed ${
                    step.inverted ? "text-[#B4B6C2]" : "text-muted-foreground"
                  }`}
                >
                  {step.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="product" className="mx-auto scroll-mt-20 max-w-[1200px] px-6 py-16 sm:px-12 sm:py-24">
        <h2 className="mb-8 font-headline text-[28px] font-bold tracking-[-0.01em]">
          Built for how analysts actually think
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <div
                className={`mb-3.5 flex h-9 w-9 items-center justify-center rounded-[9px] ${feature.iconBg}`}
              >
                <feature.icon aria-hidden className={`h-4 w-4 ${feature.iconColor}`} />
              </div>
              <div className="mb-1.5 text-[15.5px] font-semibold">{feature.title}</div>
              <div className="text-[13.5px] leading-relaxed text-muted-foreground">
                {feature.description}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
