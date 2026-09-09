"use client";

import Link from "next/link";

export type DatasetStage = "overview" | "cleaning" | "analysis";

/** Contextual navigation for one dataset -- not a progress wizard. Upload and Studio are not
 * stages of a dataset (they belong to the project and to a visualization, respectively), so
 * they never appear here; that distinction is what replaces PipelineStepper's 4-step model for
 * dataset-scoped pages.
 *
 * TRANSITIONAL (Batch 5): Cleaning now has its own real nested route. Analysis still doesn't --
 * that lands in Batch 6 -- so it continues pointing at the existing /recommend flow (which still
 * generates recommendations) until then. Swap this one remaining href once Analysis exists. */
export function StageTabs({
  projectId,
  datasetId,
  current,
}: {
  projectId: string;
  datasetId: string;
  current: DatasetStage;
}) {
  const recommendHref = `/datasets/${datasetId}/recommend`;
  const stages: { id: DatasetStage; label: string; href: string }[] = [
    { id: "overview", label: "Overview", href: `/projects/${projectId}/datasets/${datasetId}` },
    { id: "cleaning", label: "Cleaning", href: `/projects/${projectId}/datasets/${datasetId}/cleaning` },
    { id: "analysis", label: "Analysis", href: recommendHref },
  ];

  return (
    <nav aria-label="Dataset stages" className="sticky top-12 z-30 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-[1240px] items-center gap-5 px-5 sm:px-7">
        {stages.map((stage) => {
          const isActive = stage.id === current;
          return (
            <Link
              key={stage.id}
              href={stage.href}
              aria-current={isActive ? "page" : undefined}
              className={`border-b-2 py-3 text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 ${
                isActive
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {stage.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
