"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PipelineStepper } from "@/components/layout/pipeline-stepper";
import { Button } from "@/components/ui/button";
import { ErrorState, ProcessingState, StagedProcessing } from "@/components/ui/states";
import { ANALYSIS_STAGE_LABELS, getAnalysis } from "@/lib/api/analysis";
import { ApiError } from "@/lib/api/client";
import { getDataset } from "@/lib/api/datasets";
import { applyCleaning } from "@/lib/api/cleaning";
import { getProfile, type ColumnProfile } from "@/lib/api/insights";
import { computeCleaningSuggestions } from "@/lib/cleaning-suggestions";
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
  const queryClient = useQueryClient();
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

  const cleaningMutation = useMutation({
    mutationFn: (payload: { operation_type: string; column_name: string }) =>
      applyCleaning(datasetId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", datasetId] });
    },
  });

  const suggestions = profileQuery.data ? computeCleaningSuggestions(profileQuery.data.columns) : [];
  const appliedCount = 0; // real applied-state isn't tracked server-side today -- see Suggested cleanup below

  const stageEntries = Object.entries(analysis?.stages ?? {});
  const activeStageIndex = stageEntries.findIndex(([, s]) => s === "processing");
  const stageLabels = stageEntries.map(([key]) => ANALYSIS_STAGE_LABELS[key] ?? key);

  return (
    <AppShell>
      <PipelineStepper current="profile" projectId={datasetQuery.data?.project_id} datasetId={datasetId} />
      <section className="mx-auto flex max-w-[1180px] flex-col px-7 py-12">
        <div className="mb-1.5 flex items-baseline justify-between">
          <h1 className="font-headline text-[28px] font-bold">Dataset profile</h1>
          {profileQuery.data && (
            <span className="text-[13px] text-subtle-foreground">
              {profileQuery.data.row_count.toLocaleString()} rows · {profileQuery.data.column_count}{" "}
              columns
            </span>
          )}
        </div>
        <p className="mb-7 text-[14.5px] text-muted-foreground">
          AiVis typed every column and flagged what needs attention before recommending charts.
        </p>

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
          <div className="mb-9 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {profileQuery.data.columns.map((col) => {
              const badge = badgeFor(col);
              return (
                <motion.div
                  key={col.id}
                  whileHover={{ y: -2 }}
                  className="rounded-xl border border-border bg-surface px-[18px] py-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold">{col.name}</span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
                        badge.className
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-[12.5px] text-muted-foreground">{statLine(col)}</div>
                  {col.is_pii && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-warning">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                      Contains PII
                    </div>
                  )}
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

        {suggestions.length > 0 && (
          <div className="mb-10 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-lg font-bold">Suggested cleanup</h2>
              <span className="text-[13px] text-subtle-foreground">
                {appliedCount} of {suggestions.length} applied
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {suggestions.map((s) => (
                <motion.div
                  key={`${s.columnName}-${s.operationType}`}
                  whileHover={{ x: 2 }}
                  className="flex items-center justify-between gap-4 rounded-[10px] border border-border bg-surface px-[18px] py-[15px]"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warning" />
                    <div>
                      <p className="text-sm font-semibold">{s.label}</p>
                      <p className="mt-0.5 text-[12.5px] text-subtle-foreground">{s.reason}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Apply suggestion: ${s.label}`}
                    disabled={cleaningMutation.isPending}
                    onClick={() =>
                      cleaningMutation.mutate({
                        operation_type: s.operationType,
                        column_name: s.columnName,
                      })
                    }
                  >
                    Apply
                  </Button>
                </motion.div>
              ))}
            </div>
            {cleaningMutation.isSuccess && (
              <p className="text-xs text-positive">
                Applied — {cleaningMutation.data.valid_count} valid,{" "}
                {cleaningMutation.data.invalid_count} invalid values.
              </p>
            )}
            {cleaningMutation.isError && (
              <p role="alert" className="text-sm text-negative">
                {cleaningMutation.error instanceof ApiError
                  ? cleaningMutation.error.detail
                  : "Couldn't apply that cleaning step."}
              </p>
            )}
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

        <div className="flex justify-end">
          <Button
            variant="accent"
            size="lg"
            disabled={!analysis}
            onClick={() => router.push(`/datasets/${datasetId}/recommend`)}
          >
            Generate recommendations →
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
