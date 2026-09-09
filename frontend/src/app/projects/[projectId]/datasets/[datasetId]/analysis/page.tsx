"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StageTabs } from "@/components/layout/stage-tabs";
import { AISummary } from "@/components/analysis/ai-summary";
import { FindingRow } from "@/components/analysis/finding-row";
import { Button } from "@/components/ui/button";
import { ErrorState, ProcessingState, Skeleton, StagedProcessing } from "@/components/ui/states";
import {
  ANALYSIS_STAGE_LABELS,
  getAnalysis,
  getAnalysisFindings,
  retryAnalysis,
  type FindingsWindow,
} from "@/lib/api/analysis";
import { apiClient, ApiError } from "@/lib/api/client";
import { getDataset, getDatasetRows } from "@/lib/api/datasets";
import { createVisualization, setVisualizationFavorite } from "@/lib/api/visualizations";
import type { VisualizationRecommendation } from "@/lib/api/types";
import { isUuid } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
}

const FINDINGS_PAGE_SIZE = 8;

export default function AnalysisPage() {
  const params = useParams<{ projectId: string; datasetId: string }>();
  const { projectId, datasetId } = params;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [moreItems, setMoreItems] = useState<VisualizationRecommendation[]>([]);
  const [cursor, setCursor] = useState<{ offset: number | null; hasMore: boolean } | null>(null);
  const [favoritedStoryIds, setFavoritedStoryIds] = useState<Set<string>>(new Set());

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiClient.get<Project>(`/api/projects/${projectId}`),
  });

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

  const stageEntries = Object.entries(analysis?.stages ?? {});
  const activeStageIndex = stageEntries.findIndex(([, s]) => s === "processing");
  const stageLabels = stageEntries.map(([key]) => ANALYSIS_STAGE_LABELS[key] ?? key);

  const findingsQuery = useQuery({
    queryKey: ["analysis-findings", datasetId, analysis?.dataset_version_id],
    queryFn: () => getAnalysisFindings(datasetId, 0, FINDINGS_PAGE_SIZE),
    enabled: isReady,
  });

  const rowsQuery = useQuery({
    queryKey: ["dataset-rows-preview", datasetId, analysis?.dataset_version_id],
    queryFn: () => getDatasetRows(datasetId, 100, analysis?.dataset_version_id),
    enabled: isReady,
  });

  const retryMutation = useMutation({
    mutationFn: () => retryAnalysis(datasetId),
    onSuccess: (result) => queryClient.setQueryData(["analysis", datasetId], result),
  });

  const effectiveCursor: { offset: number | null; hasMore: boolean } | null =
    cursor ?? (findingsQuery.data ? { offset: findingsQuery.data.next_offset, hasMore: findingsQuery.data.has_more } : null);

  const exploreMoreMutation = useMutation({
    mutationFn: () => {
      if (!effectiveCursor?.offset && effectiveCursor?.offset !== 0) {
        throw new Error("No further findings to load");
      }
      return getAnalysisFindings(datasetId, effectiveCursor.offset, FINDINGS_PAGE_SIZE);
    },
    onSuccess: (result: FindingsWindow) => {
      setMoreItems((prev) => [...prev, ...result.items]);
      setCursor({ offset: result.next_offset, hasMore: result.has_more });
    },
  });

  const openInStudio = useMutation({
    mutationFn: (recommendation: VisualizationRecommendation) => {
      if (!datasetQuery.data) throw new Error("Dataset not loaded yet");
      return createVisualization(datasetQuery.data.project_id, {
        title: recommendation.title,
        story_id: isUuid(recommendation.story_id) ? recommendation.story_id : null,
        spec: recommendation.spec,
      });
    },
    onSuccess: (visualization) => {
      router.push(`/projects/${projectId}/visualizations/${visualization.id}`);
    },
  });

  const isOpeningRecommendation = (recommendation: VisualizationRecommendation) =>
    openInStudio.isPending && openInStudio.variables?.story_id === recommendation.story_id;

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

  const isTogglingFavorite = (recommendation: VisualizationRecommendation) =>
    favoriteMutation.isPending && favoriteMutation.variables?.story_id === recommendation.story_id;

  const allFindings = [...(findingsQuery.data?.items ?? []), ...moreItems];
  const total = findingsQuery.data?.total ?? 0;
  const hasMore = effectiveCursor?.hasMore ?? false;

  return (
    <AppShell>
      <StageTabs projectId={projectId} datasetId={datasetId} current="analysis" />
      <section className="mx-auto flex max-w-[960px] flex-col px-5 py-8 sm:px-7">
        <Breadcrumb
          className="mb-4"
          items={[
            { label: "Projects", href: "/projects" },
            { label: projectQuery.data?.name ?? "…", href: `/projects/${projectId}` },
            {
              label: datasetQuery.data?.original_filename ?? "…",
              href: `/projects/${projectId}/datasets/${datasetId}`,
            },
          ]}
        />

        {(!analysis && analysisQuery.isLoading) && <ProcessingState label="Loading analysis…" />}

        {isProcessing && (
          <div className="flex flex-col gap-4 py-6">
            <h2 className="font-headline text-[15px] font-semibold">Analyzing dataset…</h2>
            <StagedProcessing
              stages={stageLabels}
              activeIndex={activeStageIndex === -1 ? 0 : activeStageIndex}
            />
          </div>
        )}

        {isFailed && (
          <ErrorState
            title="Analysis didn't complete."
            description={(analysis?.error ?? "Something went wrong.") + " Your dataset is unaffected."}
            action={
              <Button disabled={retryMutation.isPending} onClick={() => retryMutation.mutate()}>
                Retry
              </Button>
            }
          />
        )}

        {isReady && (
          <>
            <div className="mb-8">
              <AISummary findings={findingsQuery.data?.items ?? []} />
            </div>

            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-headline text-[15px] font-semibold">
                {findingsQuery.isLoading ? "Findings" : `Findings (${total})`}
              </h2>
            </div>

            {findingsQuery.isLoading && (
              <div className="flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            )}
            {findingsQuery.isError && (
              <ErrorState
                description="Couldn't load findings."
                action={<Button onClick={() => findingsQuery.refetch()}>Retry</Button>}
              />
            )}
            {findingsQuery.data && total === 0 && (
              <p className="text-[13.5px] text-muted-foreground">
                This dataset didn&apos;t produce any confident, non-redundant visualization candidates.
              </p>
            )}

            {allFindings.length > 0 && (
              <>
                {openInStudio.isError && (
                  <p role="alert" className="mb-3 text-sm text-negative">
                    Couldn&apos;t open this chart in the studio:{" "}
                    {openInStudio.error instanceof ApiError ? openInStudio.error.detail : "please try again."}
                  </p>
                )}
                <ul>
                  {allFindings.map((finding) => (
                    <FindingRow
                      key={finding.story_id}
                      recommendation={finding}
                      previewRows={rowsQuery.data?.rows}
                      onOpenStudio={(r) => openInStudio.mutate(r)}
                      isOpeningStudio={isOpeningRecommendation(finding)}
                      isFavorite={favoritedStoryIds.has(finding.story_id)}
                      isTogglingFavorite={isTogglingFavorite(finding)}
                      onToggleFavorite={(r) => favoriteMutation.mutate(r)}
                    />
                  ))}
                </ul>

                {hasMore ? (
                  <Button
                    variant="ghost"
                    className="mt-4"
                    disabled={exploreMoreMutation.isPending}
                    onClick={() => exploreMoreMutation.mutate()}
                  >
                    {exploreMoreMutation.isPending ? "Loading…" : "Explore more angles"}
                  </Button>
                ) : (
                  total > 0 &&
                  total <= FINDINGS_PAGE_SIZE && (
                    <p className="mt-4 text-[12.5px] text-subtle-foreground">
                      AiVis found {total} strong analytical angle{total === 1 ? "" : "s"} in this dataset.
                    </p>
                  )
                )}
              </>
            )}

            <div className="mt-10 border-t border-border pt-6">
              <p className="mb-2 text-[13.5px] text-muted-foreground">Build your own chart</p>
              <Button
                variant="outline"
                onClick={() => router.push(`/explorer?datasetId=${datasetId}`)}
              >
                Explore charts <ArrowRight aria-hidden className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
