"use client";

import { Check } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type PipelineStep = "upload" | "profile" | "recommend" | "studio";

const STEPS: { id: PipelineStep; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "profile", label: "Profile" },
  { id: "recommend", label: "Review cleaning" },
  { id: "studio", label: "Visualize" },
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
    <div className="border-b border-border bg-surface/70">
      <div className="mx-auto flex h-[58px] max-w-[1320px] items-center overflow-x-auto px-5 sm:px-7">
        {STEPS.map((step, i) => {
        const isActive = step.id === current;
        const isDone = i < currentIndex;
        const href = hrefFor(step.id);
        const content = (
          <span className="flex shrink-0 items-center whitespace-nowrap text-[13px] font-medium">
            <span
              className={cn(
                "mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                isDone
                  ? "border-positive-accent bg-positive-accent text-white"
                  : isActive
                    ? "border-accent bg-accent text-white shadow-sm shadow-accent/20"
                    : "border-border-strong bg-surface text-subtle-foreground"
              )}
            >
              {isDone ? <Check aria-hidden className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={isActive ? "text-foreground" : "text-muted-foreground"}>
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "mx-4 h-px w-10 sm:w-16",
                  isDone ? "bg-positive-accent" : "bg-border-strong"
                )}
              />
            )}
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
    </div>
  );
}
