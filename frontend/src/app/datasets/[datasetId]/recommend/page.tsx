"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PipelineStepper } from "@/components/layout/pipeline-stepper";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState, ErrorState, ProcessingState, StagedProcessing } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { ThemeCard } from "@/components/recommendations/theme-card";
import { VisualizationRenderer } from "@/components/visualization/visualization-renderer";
import { DatasetDiffGrid } from "@/components/datasets/dataset-diff-grid";
import { ANALYSIS_STAGE_LABELS, categoryLabel, getAnalysis, refreshAnalysis } from "@/lib/api/analysis";
import {
  getDataset,
  getDatasetFavorites,
  getDatasetRows,
  getValidationWorkflow,
  applyValidationWorkflow,
} from "@/lib/api/datasets";
import { getThemeRecommendations } from "@/lib/api/theme";
import { createVisualization, setVisualizationFavorite } from "@/lib/api/visualizations";
import type { VisualizationRecommendation } from "@/lib/api/types";
import { getChartDefinition } from "@/lib/visualization/registry";
import { ApiError } from "@/lib/api/client";
import { isUuid } from "@/lib/utils";

export default function RecommendPage() {
  const params = useParams<{ datasetId: string }>();
  const datasetId = params.datasetId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"curated" | "theme">("curated");
  const [previewRec, setPreviewRec] = useState<VisualizationRecommendation | null>(null);
  const [workflowChosen, setWorkflowChosen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [favoritedStoryIds, setFavoritedStoryIds] = useState<Set<string>>(new Set());

  const datasetQuery = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => getDataset(datasetId),
  });

  const analysisQuery = useQuery({
    queryKey: ["analysis", datasetId],
    queryFn: () => getAnalysis(datasetId),
    refetchInterval: (query) =>
      query.state.data && !["ready", "failed"].includes(query.state.data.status) ? 1500 : false,
  });

  const analysis = analysisQuery.data;
  const refreshMutation = useMutation({
    mutationFn: () => refreshAnalysis(datasetId),
    onSuccess: (result) => queryClient.setQueryData(["analysis", datasetId], result),
  });
  const isReady = analysis?.status === "ready";
  const isFailed = analysis?.status === "failed";
  const isProcessing = !!analysis && !isReady && !isFailed;

  const rowsQuery = useQuery({
    queryKey: ["dataset-rows-preview", datasetId, analysis?.dataset_version_id],
    queryFn: () => getDatasetRows(datasetId, 100, analysis?.dataset_version_id),
    enabled: isReady,
  });

  const workflowQuery = useQuery({
    queryKey: ["validation-workflow", datasetId],
    queryFn: () => getValidationWorkflow(datasetId),
  });

  const applyWorkflowMutation = useMutation({
    mutationFn: (selection: "original" | "cleaned") => {
      if (!workflowQuery.data) throw new Error("Dataset audit is not loaded");
      return applyValidationWorkflow(datasetId, workflowQuery.data.audit_id, selection);
    },
    onSuccess: () => {
      setWorkflowChosen(true);
      queryClient.invalidateQueries({ queryKey: ["analysis", datasetId] });
      queryClient.invalidateQueries({ queryKey: ["dataset", datasetId] });
      queryClient.invalidateQueries({ queryKey: ["dataset-rows-preview", datasetId] });
      queryClient.invalidateQueries({ queryKey: ["validation-workflow", datasetId] });
    },
  });

  const themesQuery = useQuery({
    queryKey: ["theme-recommendations"],
    queryFn: getThemeRecommendations,
    enabled: tab === "theme",
  });
  const [selectedThemeName, setSelectedThemeName] = useState<string | null>(null);

  const openInStudio = useMutation({
    mutationFn: (recommendation: VisualizationRecommendation) => {
      if (!datasetQuery.data) throw new Error("Dataset not loaded yet");
      return createVisualization(datasetQuery.data.project_id, {
        title: recommendation.title,
        // story_id doubles as a client-side key: it's a real stories.id only for
        // insight-backed recommendations, and a synthetic tag ("gemini-chart:1",
        // "ai-finding:0") for the rest. The API column is a stories FK, so anything
        // that isn't a UUID has to be persisted as null or the POST 422s.
        story_id: isUuid(recommendation.story_id) ? recommendation.story_id : null,
        spec: recommendation.spec,
      });
    },
    onSuccess: (visualization) => {
      router.push(`/studio/${visualization.id}`);
    },
  });

  const isOpeningRecommendation = (recommendation: VisualizationRecommendation) =>
    openInStudio.isPending && openInStudio.variables?.story_id === recommendation.story_id;

  const favoritesQuery = useQuery({
    queryKey: ["dataset-favorites", datasetId],
    queryFn: () => getDatasetFavorites(datasetId),
    enabled: isReady,
  });

  const favoriteMutation = useMutation({
    mutationFn: async (recommendation: VisualizationRecommendation) => {
      if (!datasetQuery.data) throw new Error("Dataset not loaded yet");
      const visualization = await createVisualization(datasetQuery.data.project_id, {
        title: recommendation.title,
        story_id: isUuid(recommendation.story_id) ? recommendation.story_id : null,
        spec: recommendation.spec,
      });
      return setVisualizationFavorite(visualization.id, true);
    },
    onSuccess: (_visualization, recommendation) => {
      setFavoritedStoryIds((prev) => new Set(prev).add(recommendation.story_id));
      queryClient.invalidateQueries({ queryKey: ["dataset-favorites", datasetId] });
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: (visualizationId: string) => setVisualizationFavorite(visualizationId, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dataset-favorites", datasetId] });
    },
  });

  const isTogglingFavorite = (recommendation: VisualizationRecommendation) =>
    favoriteMutation.isPending && favoriteMutation.variables?.story_id === recommendation.story_id;

  const handleConfirmWorkflow = async (version: "raw" | "cleaned") => {
    await applyWorkflowMutation.mutateAsync(version === "raw" ? "original" : "cleaned");
  };

  const stageEntries = Object.entries(analysis?.stages ?? {});
  const activeStageIndex = stageEntries.findIndex(([, s]) => s === "processing");
  const stageLabels = stageEntries.map(([key]) => ANALYSIS_STAGE_LABELS[key] ?? key);

  const recommendations = analysis?.recommendations?.top ?? [];
  const recommendationGroups = analysis?.recommendations?.groups ?? [];
  const themes = themesQuery.data ? [...themesQuery.data.top, ...themesQuery.data.rest] : [];
  const chartEvaluations = analysis?.recommendations?.evaluations ?? [];
  const applicableChartCount = chartEvaluations.filter((item) => item.applicable).length;

  const showWorkflowDiff =
    workflowQuery.data &&
    !workflowChosen &&
    !applyWorkflowMutation.isSuccess;

  return (
    <AppShell>
      <PipelineStepper current="recommend" projectId={datasetQuery.data?.project_id} datasetId={datasetId} />
      <section className="mx-auto flex w-full max-w-[1240px] flex-col px-5 py-10 sm:px-7 lg:py-12">
        <div className="mb-7">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
            Data preparation
          </p>
          <h1 className="font-headline text-[30px] font-bold tracking-[-0.035em] sm:text-[34px]">
            Review your dataset
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Compare the immutable original with Gemini&apos;s validated cleaning proposal, then
            choose which version should power your visualizations.
          </p>
        </div>
        {workflowQuery.isLoading && <ProcessingState label="Auditing dataset quality…" />}
        {applyWorkflowMutation.isPending && <ProcessingState label="Applying cleaning and generating recommendations…" />}

        {workflowQuery.isError && (
          <ErrorState
            title="Workflow failed"
            description="Couldn't audit the dataset. Please ensure your dataset is fully processed."
          />
        )}

        {workflowQuery.data && !applyWorkflowMutation.isPending && (
          <>
            {showWorkflowDiff ? (
              <DatasetDiffGrid
                datasetId={datasetId}
                workflow={workflowQuery.data}
                onConfirm={handleConfirmWorkflow}
              />
            ) : (
              <>
                {isReady && (
                  <>
                    <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                    <h2 className="font-headline text-[26px] font-bold">
                      {recommendations.length} way{recommendations.length === 1 ? "" : "s"} to see your data
                    </h2>
                    <Button variant="outline" disabled={refreshMutation.isPending} onClick={() => refreshMutation.mutate()}>{refreshMutation.isPending ? "Starting…" : "Re-analyze with Gemini"}</Button>
                    </div>
                    {refreshMutation.isError && <p role="alert" className="mb-4 text-sm text-negative">Couldn&apos;t start analysis. Please try again.</p>}
                    {typeof analysis?.ai_findings?.chart_error === "string" && <p role="alert" className="mb-4 rounded-lg border border-warning/30 p-3 text-sm text-muted-foreground">Gemini chart evaluation was unavailable. Displaying computed suggestions; re-analyze to retry.</p>}
                    <p className="mb-6 max-w-[640px] text-[14.5px] text-muted-foreground">
                      Explore applicable charts ranked by analytical relevance. Each includes its column
                      mappings and explanation; expand chart coverage to inspect exclusions.
                    </p>
                    {rowsQuery.data && <p className="mb-4 text-xs text-muted-foreground">Chart previews use up to 100 rows from the selected dataset version. Preview totals and distributions may differ from full-dataset statistics.</p>}

                    <Tabs
                      layoutId="recommend-tab"
                      className="mb-7"
                      value={tab}
                      onChange={(id) => setTab(id as "curated" | "theme")}
                      options={[
                        { id: "curated", label: `Curated · ${recommendations.length}` },
                        { id: "theme", label: "Theme & branding" },
                      ]}
                    />

                    {tab === "curated" && (
                      <>
                        {!!favoritesQuery.data?.length && (
                          <div className="mb-7 rounded-xl border border-border-strong bg-surface-muted p-4">
                            <h3 className="mb-3 font-headline text-[13px] font-bold uppercase tracking-[0.06em] text-subtle-foreground">
                              ★ Your favorites
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {favoritesQuery.data.map((viz) => (
                                <div
                                  key={viz.id}
                                  className="flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-sm"
                                >
                                  <button
                                    type="button"
                                    className="font-medium hover:underline"
                                    onClick={() => router.push(`/studio/${viz.id}`)}
                                  >
                                    {viz.title}
                                  </button>
                                  <button
                                    type="button"
                                    aria-label="Remove from favorites"
                                    disabled={
                                      removeFavoriteMutation.isPending &&
                                      removeFavoriteMutation.variables === viz.id
                                    }
                                    onClick={() => removeFavoriteMutation.mutate(viz.id)}
                                    className="text-accent hover:opacity-70 disabled:opacity-50"
                                  >
                                    ★
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {analysis?.recommendations?.shortfall_reason && (
                          <p className="mb-5 text-sm text-muted-foreground">
                            {analysis.recommendations.shortfall_reason}
                          </p>
                        )}
                        {chartEvaluations.length > 0 && (
                          <details className="mb-6 rounded-xl border border-border bg-surface px-4 py-3">
                            <summary className="cursor-pointer text-sm font-semibold">
                              Chart coverage · {applicableChartCount} applicable of {chartEvaluations.length} evaluated
                            </summary>
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              {chartEvaluations.map((item) => (
                                <div key={item.chart_type} className="rounded-lg bg-surface-muted p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-medium">{getChartDefinition(item.chart_type)?.label ?? item.chart_type}</span>
                                    <span className={item.applicable ? "text-xs text-positive" : "text-xs text-muted-foreground"}>
                                      {item.applicable ? "Applicable" : "Not applicable"}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.reason}</p>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                        {recommendations.length === 0 ? (
                          <EmptyState
                            title="No recommendations yet"
                            description="This dataset didn't produce any confident visualization candidates."
                          />
                        ) : (
                          <>
                            {openInStudio.isError && (
                              <p role="alert" className="mb-4 text-sm text-negative">
                                Couldn&apos;t open this chart in the studio:{" "}
                                {openInStudio.error instanceof ApiError
                                  ? openInStudio.error.detail
                                  : "please try again."}
                              </p>
                            )}
                            {recommendationGroups.map((group) => (
                              <div key={group.category} className="mb-8 last:mb-0">
                                <h3 className="mb-3 font-headline text-[15px] font-bold text-foreground">
                                  {categoryLabel(group.category)}
                                  <span className="ml-1.5 font-mono text-[12px] font-normal text-muted-foreground">
                                    {group.recommendations.length}
                                  </span>
                                </h3>
                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                                  {(expandedCategories.has(group.category) ? group.recommendations : group.recommendations.slice(0, 4)).map((rec, index) => (
                                    <div key={rec.story_id} className="flex flex-col gap-2.5">
                                      <RecommendationCard
                                        recommendation={rec}
                                        index={index}
                                        previewRows={rowsQuery.data?.rows}
                                        isFavorite={favoritedStoryIds.has(rec.story_id)}
                                        isTogglingFavorite={isTogglingFavorite(rec)}
                                        onToggleFavorite={(r) => favoriteMutation.mutate(r)}
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="flex-1"
                                          onClick={() => setPreviewRec(rec)}
                                        >
                                          Preview
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="default"
                                          className="flex-1"
                                          disabled={openInStudio.isPending}
                                          onClick={() => openInStudio.mutate(rec)}
                                        >
                                          {isOpeningRecommendation(rec) ? "Opening…" : "Open in studio"}
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {group.recommendations.length > 4 && (
                                  <Button
                                    variant="ghost"
                                    className="mt-3"
                                    onClick={() => setExpandedCategories((current) => {
                                      const next = new Set(current);
                                      if (next.has(group.category)) next.delete(group.category); else next.add(group.category);
                                      return next;
                                    })}
                                  >
                                    {expandedCategories.has(group.category) ? "Show fewer" : `Show all ${group.recommendations.length}`}
                                  </Button>
                                )}
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )}

                    {tab === "theme" && (
                      <>
                        <p className="mb-5 max-w-[640px] text-[13.5px] text-subtle-foreground">
                          AiVis suggests contrast-checked palettes. Pick one now — you can still switch
                          per chart in the studio.
                        </p>
                        {themesQuery.isLoading && <ProcessingState label="Loading themes…" />}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {themes.map((theme) => (
                            <ThemeCard
                              key={theme.name}
                              theme={theme}
                              selected={selectedThemeName === theme.name}
                              onSelect={() => setSelectedThemeName(theme.name)}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                {isProcessing && (
                  <div className="flex flex-col gap-4">
                    <h2 className="font-headline text-lg font-bold">Analyzing dataset…</h2>
                    <StagedProcessing
                      stages={stageLabels}
                      activeIndex={activeStageIndex === -1 ? 0 : activeStageIndex}
                    />
                  </div>
                )}

                {isFailed && (
                  <ErrorState
                    title="Analysis failed"
                    description={analysis?.error ?? "Something went wrong during analysis."}
                  />
                )}

                {!analysis && analysisQuery.isLoading && <ProcessingState label="Loading analysis…" />}
              </>
            )}
          </>
        )}
      </section>

      <Drawer open={!!previewRec} onClose={() => setPreviewRec(null)}>
        {previewRec && (
          <>
            <span className="mb-5 inline-block rounded-full bg-accent-muted px-2.5 py-1 font-mono text-[11.5px] font-bold text-accent-hover">
              {Math.round(previewRec.confidence * 100)}% confidence
            </span>
            <h2 className="mb-2.5 font-headline text-[22px] font-bold">{previewRec.title}</h2>
            <div className="mb-5 flex h-[220px] items-center justify-center rounded-xl bg-surface-muted p-6">
              {rowsQuery.data?.rows && (
                <VisualizationRenderer
                  // The drawer already renders the title as an <h2> above; leaving it on the spec
                  // draws it a second time inside the chart, which also overflows the fixed-height
                  // preview box and collides with the heading.
                  spec={{
                    ...previewRec.spec,
                    typography: { ...previewRec.spec.typography, title: null },
                    layout: { ...previewRec.spec.layout, height: 190 },
                  }}
                  rows={rowsQuery.data.rows}
                />
              )}
            </div>
            <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-subtle-foreground">
              {getChartDefinition(previewRec.spec.chart_type)?.label ?? previewRec.spec.chart_type}
            </div>
            <p className="mb-7 text-sm leading-relaxed text-muted-foreground">
              {previewRec.description}
            </p>
            <Button
              variant="default"
              className="w-full"
              disabled={openInStudio.isPending}
              onClick={() => openInStudio.mutate(previewRec)}
            >
              {isOpeningRecommendation(previewRec) ? "Opening…" : "Open in studio →"}
            </Button>
          </>
        )}
      </Drawer>
    </AppShell>
  );
}
