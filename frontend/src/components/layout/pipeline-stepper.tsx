"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

export type PipelineStep = "upload" | "profile" | "recommend" | "studio";

const STEPS: { id: PipelineStep; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "profile", label: "Profile" },
  { id: "recommend", label: "Recommend" },
  { id: "studio", label: "Studio" },
];

export function PipelineStepper({
  current,
  projectId,
  datasetId,
}: {
  current: PipelineStep;
  projectId?: string;
  datasetId?: string;
}) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  const hrefFor = (step: PipelineStep): string | null => {
    if (step === "upload") return projectId ? `/projects/${projectId}` : null;
    if (step === "profile") return datasetId ? `/datasets/${datasetId}` : null;
    if (step === "recommend") return datasetId ? `/datasets/${datasetId}/recommend` : null;
    return null; // studio has no stable href from here
  };

  return (
    <div className="flex h-[52px] items-center gap-6 overflow-x-auto border-b border-border bg-surface px-7">
      {STEPS.map((step, i) => {
        const isActive = step.id === current;
        const isDone = i < currentIndex;
        const href = hrefFor(step.id);
        const content = (
          <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium">
            <span
              className={cn(
                "block h-1.5 w-1.5 shrink-0 rounded-full",
                isDone ? "bg-positive-accent" : isActive ? "bg-accent" : "bg-border-strong"
              )}
            />
            <span className={isActive ? "text-foreground" : "text-muted-foreground"}>
              {step.label}
            </span>
          </span>
        );
        return href && !isActive ? (
          <Link key={step.id} href={href} className="shrink-0">
            {content}
          </Link>
        ) : (
          <span key={step.id} aria-current={isActive ? "step" : undefined} className="shrink-0">
            {content}
          </span>
        );
      })}
    </div>
  );
}
