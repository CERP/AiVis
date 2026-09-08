"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Database, ShieldCheck, Sparkles } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PipelineStepper } from "@/components/layout/pipeline-stepper";
import { Button } from "@/components/ui/button";
import { ErrorState, ProcessingState, StagedProcessing } from "@/components/ui/states";
import { ANALYSIS_STAGE_LABELS, getAnalysis } from "@/lib/api/analysis";
import { ApiError } from "@/lib/api/client";
import { getDataset } from "@/lib/api/datasets";
import { getProfile, type ColumnProfile } from "@/lib/api/insights";
import { cn } from "@/lib/utils";

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  categorical: { label: "CAT", className: "bg-accent-muted text-accent-hover" },
  text: { label: "CAT", className: "bg-accent-muted text-accent-hover" },
  numeric: { label: "NUM", className: "bg-info-bg text-info" },
  currency: { label: "NUM", className: "bg-info-bg text-info" },
  date: { label: "DATE", className: "bg-positive-bg text-positive-accent" },
};

function badgeFor(column: ColumnProfile) {
  const type = column.semantic_type ?? "";
  return (
    TYPE_BADGE[type] ?? { label: type ? type.slice(0, 4).toUpperCase() : "COL", className: "bg-secondary-bg text-secondary" }
  );
}

function statLine(column: ColumnProfile): string {
  const parts = [`${column.unique_count} unique`, `${column.null_count} nulls`];
  return parts.join(" · ");
}

export default function DatasetProfilePage() {
  const params = useParams<{ datasetId: string }>();
  const datasetId = params.datasetId;
  const router = useRouter();

  const datasetQuery = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => getDataset(datasetId),
  });

  const profileQuery = useQuery({
    queryKey: ["profile", datasetId],
    queryFn: () => getProfile(datasetId),
  });

  const analysisQuery = useQuery({
    queryKey: ["analysis", datasetId],
    queryFn: () => getAnalysis(datasetId),
    refetchInterval: (query) =>
      query.state.data && !["ready", "failed"].includes(query.state.data.status) ? 1500 : false,
  });

  const analysis = analysisQuery.data;
  const isReady = analysis?.status === "ready";
  const isFailed = analysis?.status === "failed";
  const isProcessing = !!analysis && !isReady && !isFailed;

  const stageEntries = Object.entries(analysis?.stages ?? {});
  const activeStageIndex = stageEntries.findIndex(([, s]) => s === "processing");
  const stageLabels = stageEntries.map(([key]) => ANALYSIS_STAGE_LABELS[key] ?? key);

  return (
    <AppShell>
      <PipelineStepper current="profile" projectId={datasetQuery.data?.project_id} datasetId={datasetId} />
      <section className="mx-auto flex max-w-[1240px] flex-col px-5 py-10 sm:px-7 lg:py-12">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
              Dataset workspace
            </p>
            <h1 className="font-headline text-[30px] font-bold tracking-[-0.035em] sm:text-[34px]">
              {datasetQuery.data?.original_filename ?? "Dataset profile"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Local profiling is complete. Review the structure before Gemini audits the data
              and proposes a cleaning strategy.
            </p>
          </div>
          <Button
            variant="accent"
            size="lg"
            onClick={() => router.push(`/datasets/${datasetId}/recommend`)}
          >
            <Sparkles aria-hidden className="h-4 w-4" />
            Review with Gemini
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Button>
        </div>

        {profileQuery.data && (
          <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm shadow-black/[0.02]">
              <Database aria-hidden className="mb-3 h-4 w-4 text-accent" />
              <p className="font-headline text-2xl font-bold">{profileQuery.data.row_count.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Rows ingested</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm shadow-black/[0.02]">
              <span className="mb-3 block h-4 w-4 rounded border-2 border-info" />
              <p className="font-headline text-2xl font-bold">{profileQuery.data.column_count}</p>
              <p className="text-xs text-muted-foreground">Columns profiled</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm shadow-black/[0.02]">
              <ShieldCheck aria-hidden className="mb-3 h-4 w-4 text-positive-accent" />
              <p className="font-headline text-2xl font-bold">
                {profileQuery.data.columns.filter((column) => column.is_pii).length}
              </p>
              <p className="text-xs text-muted-foreground">Sensitive columns protected</p>
            </div>
          </div>
        )}

        {profileQuery.isLoading && <ProcessingState label="Loading profile…" />}
        {profileQuery.isError && (
          <ErrorState
            description={
              profileQuery.error instanceof ApiError
                ? profileQuery.error.detail
                : "Couldn't load the dataset profile."
            }
          />
        )}

        {profileQuery.data && (
          <div className="mb-9 overflow-hidden rounded-xl border border-border bg-surface shadow-sm shadow-black/[0.02]">
            {/* Column labels only line up once the row is a true 4-column table; below md the
              * row reflows to two columns, where the headers would sit above the wrong cells. */}
            <div className="hidden grid-cols-[minmax(0,1fr)_90px_150px_100px] border-b border-border bg-surface-muted/70 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground md:grid">
              <span>Column</span><span>Type</span><span>Profile</span><span>Privacy</span>
            </div>
            {profileQuery.data.columns.map((col) => {
              const badge = badgeFor(col);
              return (
                <motion.div
                  key={col.id}
                  whileHover={{ backgroundColor: "var(--surface-muted)" }}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-border px-5 py-3.5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_90px_150px_100px] md:gap-0"
                >
                  <span className="truncate font-mono text-sm font-semibold">{col.name}</span>
                  <span className={cn("w-fit rounded px-1.5 py-0.5 font-mono text-[10px] font-bold", badge.className)}>{badge.label}</span>
                  <span className="text-[12.5px] text-muted-foreground">{statLine(col)}</span>
                  <span className={col.is_pii ? "text-xs font-semibold text-warning" : "text-xs text-subtle-foreground"}>
                    {col.is_pii ? "Protected" : "Standard"}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}

        {analysis?.data_quality && analysis.data_quality.issues.length > 0 && (
          <div className="mb-10 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-lg font-bold">
                Data quality — {analysis.data_quality.score}/100
              </h2>
            </div>
            <ul className="flex flex-col gap-2">
              {analysis.data_quality.issues.map((issue, i) => (
                <li
                  key={`${issue.type}-${issue.column}-${i}`}
                  className="flex items-start gap-3 rounded-[10px] border border-border bg-surface px-[18px] py-3.5"
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      issue.severity === "high" ? "bg-negative" : "bg-warning"
                    )}
                  />
                  <div>
                    <p className="text-sm font-semibold">{issue.description}</p>
                    {issue.recommendation && (
                      <p className="mt-0.5 text-[12.5px] text-subtle-foreground">
                        {issue.recommendation}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isProcessing && (
          <div className="mb-10 flex flex-col gap-4">
            <h2 className="font-headline text-lg font-bold">Analyzing dataset…</h2>
            <StagedProcessing
              stages={stageLabels}
              activeIndex={activeStageIndex === -1 ? 0 : activeStageIndex}
            />
          </div>
        )}

        {isFailed && (
          <div className="mb-10">
            <ErrorState
              title="Analysis failed"
              description={analysis?.error ?? "Something went wrong during analysis."}
            />
          </div>
        )}

      </section>
    </AppShell>
  );
}
