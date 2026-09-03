"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import {
  EmptyState,
  ErrorState,
  ProcessingState,
  StagedProcessing,
  StatTile,
} from "@/components/ui/states";
import { Headline, SectionHeading } from "@/components/ui/typography";
import { ANALYSIS_STAGE_LABELS, getAnalysis, retryAnalysis } from "@/lib/api/analysis";
import { ApiError } from "@/lib/api/client";
import { getDataset, getDatasetRows } from "@/lib/api/datasets";
import { applyCleaning } from "@/lib/api/cleaning";
import { getProfile } from "@/lib/api/insights";
import { createVisualization } from "@/lib/api/visualizations";
import type { VisualizationRecommendation } from "@/lib/api/types";
import { computeCleaningSuggestions } from "@/lib/cleaning-suggestions";
import { cn } from "@/lib/utils";

export default function DatasetDetailPage() {
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

  // Uploading a dataset alone starts the whole pipeline server-side (see
  // POST /api/datasets and the AnalysisOrchestrator/worker it queues) -- there is no manual
  // "Analyze" action; this just polls the real backend stage until it lands on ready/failed.
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

  const retryMutation = useMutation({
    mutationFn: () => retryAnalysis(datasetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["analysis", datasetId] }),
  });

  const rowsQuery = useQuery({
    queryKey: ["dataset-rows-preview", datasetId],
    queryFn: () => getDatasetRows(datasetId, 100),
    enabled: isReady,
  });

  const openInStudio = useMutation({
    mutationFn: (recommendation: VisualizationRecommendation) => {
      if (!datasetQuery.data) throw new Error("Dataset not loaded yet");
      return createVisualization(datasetQuery.data.project_id, {
        title: recommendation.title,
        story_id: recommendation.story_id,
        spec: recommendation.spec,
      });
    },
    onSuccess: (visualization) => {
      router.push(`/studio/${visualization.id}`);
    },
  });

  const cleaningMutation = useMutation({
    mutationFn: (payload: { operation_type: string; column_name: string }) =>
      applyCleaning(datasetId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", datasetId] });
    },
  });

  const suggestions = profileQuery.data
    ? computeCleaningSuggestions(profileQuery.data.columns)
    : [];

  const stageEntries = Object.entries(analysis?.stages ?? {});
  const activeStageIndex = stageEntries.findIndex(([, s]) => s === "processing");
  const stageLabels = stageEntries.map(([key]) => ANALYSIS_STAGE_LABELS[key] ?? key);

  const recommendationCount =
    (analysis?.recommendations?.top.length ?? 0) + (analysis?.recommendations?.derived.length ?? 0);

  return (
    <AppShell>
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-16">
        <div>
          <Headline as="h1" className="text-3xl">
            Dataset overview
          </Headline>
        </div>

        {profileQuery.isLoading && <ProcessingState label="Loading profile…" />}

        {profileQuery.data && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Rows" value={profileQuery.data.row_count.toLocaleString()} index={0} />
            <StatTile label="Columns" value={profileQuery.data.column_count} index={1} />
            <StatTile
              label="Data quality"
              value={analysis?.data_quality ? `${analysis.data_quality.score}/100` : "—"}
              index={2}
            />
            <StatTile label="Recommendations" value={isReady ? recommendationCount : "—"} index={3} />
          </div>
        )}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profileQuery.data.columns.map((col) => (
              <motion.div
                key={col.id}
                whileHover={{ y: -2 }}
                className="rounded-[var(--radius-token)] border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="font-medium">{col.name}</p>
                <p className="text-xs text-muted-foreground">
                  {col.semantic_type ?? col.raw_type} · {col.null_count} nulls ·{" "}
                  {col.unique_count} unique
                  {col.is_pii ? " · PII" : ""}
                </p>
              </motion.div>
            ))}
          </div>
        )}

        {analysis?.data_quality && analysis.data_quality.issues.length > 0 && (
          <div className="flex flex-col gap-3">
            <SectionHeading as="h2" className="text-lg">
              Data quality — {analysis.data_quality.score}/100
            </SectionHeading>
            <p className="text-sm text-muted-foreground">
              {analysis.data_quality.issues.length} issue
              {analysis.data_quality.issues.length !== 1 ? "s" : ""} found
            </p>
            <ul className="flex flex-col gap-1.5">
              {analysis.data_quality.issues.map((issue, i) => (
                <li
                  key={`${issue.type}-${issue.column}-${i}`}
                  className={cn(
                    "rounded-[var(--radius-token)] border border-border bg-surface px-3 py-2 text-sm",
                    issue.severity === "high" && "border-negative/30 text-negative"
                  )}
                >
                  {issue.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="flex flex-col gap-3">
            <SectionHeading as="h2" className="text-lg">
              Suggested cleanup
            </SectionHeading>
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <motion.div
                  key={`${s.columnName}-${s.operationType}`}
                  whileHover={{ x: 2 }}
                  className="flex items-center justify-between gap-4 rounded-[var(--radius-token)] border border-border bg-surface p-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div>
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.reason}</p>
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
          <div className="flex flex-col gap-4">
            <SectionHeading as="h2">Analyzing dataset…</SectionHeading>
            <StagedProcessing
              stages={stageLabels}
              activeIndex={activeStageIndex === -1 ? 0 : activeStageIndex}
            />
          </div>
        )}

        {isFailed && (
          <div className="flex flex-col gap-3">
            <ErrorState
              title="Analysis failed"
              description={analysis?.error ?? "Something went wrong during analysis."}
              action={
                <Button
                  variant="outline"
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}
                >
                  <RefreshCw aria-hidden className="mr-1.5 h-4 w-4" />
                  {retryMutation.isPending ? "Retrying…" : "Retry analysis"}
                </Button>
              }
            />
          </div>
        )}

        {isReady && analysis?.recommendations && (
          <div className="flex flex-col gap-6">
            <SectionHeading as="h2">Suggested visualizations</SectionHeading>

            {analysis.recommendations.shortfall_reason && (
              <p className="text-sm text-muted-foreground">
                {analysis.recommendations.shortfall_reason}
              </p>
            )}

            {analysis.recommendations.top.length === 0 && (
              <EmptyState
                title="No recommendations yet"
                description="This dataset didn't produce any confident visualization candidates."
              />
            )}
            {analysis.recommendations.top.length > 0 && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {analysis.recommendations.top.map((rec, index) => (
                  <RecommendationCard
                    key={rec.story_id}
                    recommendation={rec}
                    index={index}
                    previewRows={rowsQuery.data?.rows}
                    onOpenStudio={(r) => openInStudio.mutate(r)}
                    isOpeningStudio={openInStudio.isPending}
                  />
                ))}
              </div>
            )}

            {analysis.recommendations.derived.length > 0 && (
              <div className="mt-4 flex flex-col gap-4">
                <SectionHeading as="h2" className="text-lg">
                  Explore more
                </SectionHeading>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {analysis.recommendations.derived.map((rec, index) => (
                    <RecommendationCard
                      key={rec.story_id}
                      recommendation={rec}
                      index={index}
                      previewRows={rowsQuery.data?.rows}
                      onOpenStudio={(r) => openInStudio.mutate(r)}
                      isOpeningStudio={openInStudio.isPending}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}
