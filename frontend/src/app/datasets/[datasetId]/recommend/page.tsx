"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
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
import { ANALYSIS_STAGE_LABELS, getAnalysis } from "@/lib/api/analysis";
import { getDataset, getDatasetRows } from "@/lib/api/datasets";
import { getThemeRecommendations } from "@/lib/api/theme";
import { createVisualization } from "@/lib/api/visualizations";
import type { VisualizationRecommendation } from "@/lib/api/types";
import { getChartDefinition } from "@/lib/visualization/registry";

export default function RecommendPage() {
  const params = useParams<{ datasetId: string }>();
  const datasetId = params.datasetId;
  const router = useRouter();
  const [tab, setTab] = useState<"curated" | "theme">("curated");
  const [previewRec, setPreviewRec] = useState<VisualizationRecommendation | null>(null);

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
  const isReady = analysis?.status === "ready";
  const isFailed = analysis?.status === "failed";
  const isProcessing = !!analysis && !isReady && !isFailed;

  const rowsQuery = useQuery({
    queryKey: ["dataset-rows-preview", datasetId],
    queryFn: () => getDatasetRows(datasetId, 100),
    enabled: isReady,
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
        story_id: recommendation.story_id,
        spec: recommendation.spec,
      });
    },
    onSuccess: (visualization) => {
      router.push(`/studio/${visualization.id}`);
    },
  });

  const stageEntries = Object.entries(analysis?.stages ?? {});
  const activeStageIndex = stageEntries.findIndex(([, s]) => s === "processing");
  const stageLabels = stageEntries.map(([key]) => ANALYSIS_STAGE_LABELS[key] ?? key);

  const recommendations = analysis?.recommendations?.top ?? [];
  const themes = themesQuery.data ? [...themesQuery.data.top, ...themesQuery.data.rest] : [];

  return (
    <AppShell>
      <PipelineStepper current="recommend" projectId={datasetQuery.data?.project_id} datasetId={datasetId} />
      <section className="mx-auto flex max-w-[1180px] flex-col px-7 py-12">
        {isReady && (
          <>
            <h1 className="mb-1.5 font-headline text-[28px] font-bold">
              {recommendations.length} way{recommendations.length === 1 ? "" : "s"} to see your data
            </h1>
            <p className="mb-6 max-w-[640px] text-[14.5px] text-muted-foreground">
              Ranked by analytical relevance — the strength of the pattern behind each chart — not
              by how many chart types are technically possible.
            </p>

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
                {analysis?.recommendations?.shortfall_reason && (
                  <p className="mb-5 text-sm text-muted-foreground">
                    {analysis.recommendations.shortfall_reason}
                  </p>
                )}
                {recommendations.length === 0 ? (
                  <EmptyState
                    title="No recommendations yet"
                    description="This dataset didn't produce any confident visualization candidates."
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {recommendations.map((rec, index) => (
                      <div key={rec.story_id} className="flex flex-col gap-2.5">
                        <RecommendationCard
                          recommendation={rec}
                          index={index}
                          previewRows={rowsQuery.data?.rows}
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
                            {openInStudio.isPending ? "Opening…" : "Open in studio"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
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
                  spec={{ ...previewRec.spec, layout: { ...previewRec.spec.layout, height: 190 } }}
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
              {openInStudio.isPending ? "Opening…" : "Open in studio →"}
            </Button>
          </>
        )}
      </Drawer>
    </AppShell>
  );
}
