"use client";

import { motion } from "framer-motion";
import { BarChart3, ShieldCheck, Sparkles, Upload, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VisualizationRenderer } from "@/components/visualization/visualization-renderer";
import { Headline, SectionHeading, Subtitle } from "@/components/ui/typography";
import type { VisualizationSpec } from "@/lib/visualization/spec";
import { useAuthStore } from "@/store/auth-store";

const PREVIEW_ROWS = [
  { region: "North", revenue: 5241 },
  { region: "South", revenue: 2405 },
  { region: "East", revenue: 2960 },
  { region: "West", revenue: 3010 },
];

const PREVIEW_SPEC: VisualizationSpec = {
  chart_type: "bar",
  encoding: {
    x: { field: "region", type: "nominal" },
    y: { field: "revenue", type: "quantitative", aggregation: "sum" },
  },
  transformations: [],
  filters: [],
  annotations: [],
  theme: "minimal",
  typography: { title: "Revenue by region" },
  layout: { show_legend: true, show_grid: true, height: 260 },
  metadata: { dataset_id: "landing", dataset_version_id: "landing" },
};

const WORKFLOW_STEPS = [
  {
    icon: Upload,
    title: "1. Upload",
    description: "Drop in a CSV or Excel file. Aivis profiles every column automatically.",
  },
  {
    icon: Wand2,
    title: "2. AI-assisted analysis",
    description:
      "A deterministic quality audit plus Gemini-assisted findings surface trends, outliers, and comparisons worth charting.",
  },
  {
    icon: BarChart3,
    title: "3. Studio",
    description: "Refine chart type, encodings, filters, and theme in a full visual editor.",
  },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "AI Quality Audit",
    description:
      "Every dataset is scored for missing values, inconsistent categories, and outliers before a single chart is suggested.",
  },
  {
    icon: Sparkles,
    title: "Top-8 Recommendations",
    description:
      "Deterministic detectors plus AI-assisted findings surface the 8 most meaningful ways to look at your data — no redundant duplicates.",
  },
  {
    icon: BarChart3,
    title: "Studio",
    description:
      "41 chart types, real semantic data mapping, filters, annotations, and 8 accessible themes — export straight to SVG or PNG.",
  },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: "easeOut" as const },
});

export default function Home() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const primaryHref = token ? "/projects" : "/signup";

  return (
    <AppShell>
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-24 lg:grid-cols-2">
        <div className="flex flex-col items-start gap-6">
          <motion.div {...fadeUp(0)}>
            <Headline>Turn any dataset into a clear visualization.</Headline>
          </motion.div>
          <motion.div {...fadeUp(0.1)}>
            <Subtitle>
              Upload data, discover insights, and let Aivis recommend the right charts — then
              refine every detail in the studio.
            </Subtitle>
          </motion.div>
          <motion.div {...fadeUp(0.2)}>
            <Button variant="accent" size="lg" onClick={() => router.push(primaryHref)}>
              Upload a dataset
            </Button>
          </motion.div>
        </div>

        <motion.div {...fadeUp(0.15)}>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-surface-muted px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Live preview
            </div>
            <CardContent className="p-6">
              <VisualizationRenderer spec={PREVIEW_SPEC} rows={PREVIEW_ROWS} />
            </CardContent>
          </Card>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <motion.div {...fadeUp(0)}>
          <SectionHeading className="mb-8 text-center text-sm uppercase tracking-wide text-muted-foreground">
            How it works
          </SectionHeading>
        </motion.div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {WORKFLOW_STEPS.map((step, i) => (
            <motion.div key={step.title} {...fadeUp(0.05 * i)}>
              <div className="flex flex-col items-start gap-2">
                <step.icon aria-hidden className="h-6 w-6 text-accent" />
                <p className="font-headline text-base font-semibold">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <motion.div key={feature.title} {...fadeUp(0.05 * i)}>
              <Card className="h-full">
                <CardHeader>
                  <feature.icon aria-hidden className="mb-2 h-6 w-6 text-accent" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-24 text-center">
        <motion.div {...fadeUp(0)}>
          <SectionHeading as="h2" className="text-2xl">
            Ready to see your data clearly?
          </SectionHeading>
        </motion.div>
        <motion.div {...fadeUp(0.1)}>
          <Button variant="accent" size="lg" onClick={() => router.push(primaryHref)}>
            {token ? "Go to your projects" : "Get started free"}
          </Button>
        </motion.div>
      </section>
    </AppShell>
  );
}
