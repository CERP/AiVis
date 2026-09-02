"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { EmptyState, ErrorState, ProcessingState } from "@/components/ui/states";
import { Headline, SectionHeading, Subtitle } from "@/components/ui/typography";
import { ApiError } from "@/lib/api/client";
import { getDataset } from "@/lib/api/datasets";
import { applyCleaning } from "@/lib/api/cleaning";
import {
  analyzeInsights,
  analyzeStories,
  getProfile,
  getRecommendations,
  listInsights,
} from "@/lib/api/insights";
import { createVisualization } from "@/lib/api/visualizations";
import type { VisualizationRecommendation } from "@/lib/api/types";
import { computeCleaningSuggestions } from "@/lib/cleaning-suggestions";

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

  const insightsQuery = useQuery({
    queryKey: ["insights", datasetId],
    queryFn: () => listInsights(datasetId),
  });

  const hasBeenAnalyzed = (insightsQuery.data?.length ?? 0) > 0;

  const recommendationsQuery = useQuery({
    queryKey: ["recommendations", datasetId],
    queryFn: () => getRecommendations(datasetId),
    enabled: hasBeenAnalyzed,
  });

  const runAnalysis = useMutation({
    mutationFn: async () => {
      await analyzeInsights(datasetId);
      await analyzeStories(datasetId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insights", datasetId] });
      queryClient.invalidateQueries({ queryKey: ["recommendations", datasetId] });
    },
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

  return (
    <AppShell>
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-16">
        <div>
          <Headline as="h1" className="text-3xl">
            Dataset overview
          </Headline>
          {profileQuery.data && (
            <Subtitle className="mt-2">
              {profileQuery.data.row_count.toLocaleString()} rows ·{" "}
              {profileQuery.data.column_count} columns
            </Subtitle>
          )}
        </div>

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profileQuery.data.columns.map((col) => (
              <div key={col.id} className="rounded-[var(--radius-token)] border border-border p-4">
                <p className="font-medium">{col.name}</p>
                <p className="text-xs text-muted-foreground">
                  {col.semantic_type ?? col.raw_type} · {col.null_count} nulls ·{" "}
                  {col.unique_count} unique
                  {col.is_pii ? " · PII" : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="flex flex-col gap-3">
            <SectionHeading as="h2" className="text-lg">
              Suggested cleanup
            </SectionHeading>
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <div
                  key={`${s.columnName}-${s.operationType}`}
                  className="flex items-center justify-between gap-4 rounded-[var(--radius-token)] border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.reason}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
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
                </div>
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

        {!hasBeenAnalyzed && (
          <div>
            <Button
              variant="accent"
              onClick={() => runAnalysis.mutate()}
              disabled={runAnalysis.isPending || !profileQuery.data}
            >
              {runAnalysis.isPending ? "Analyzing…" : "Discover insights"}
            </Button>
            {runAnalysis.isError && (
              <p role="alert" className="mt-2 text-sm text-negative">
                {runAnalysis.error instanceof ApiError
                  ? runAnalysis.error.detail
                  : "Analysis failed."}
              </p>
            )}
          </div>
        )}

        {hasBeenAnalyzed && (
          <div className="flex flex-col gap-6">
            <SectionHeading as="h2">8 ways to see your data</SectionHeading>

            {recommendationsQuery.isLoading && <ProcessingState label="Ranking visualizations…" />}
            {recommendationsQuery.data && recommendationsQuery.data.top.length === 0 && (
              <EmptyState
                title="No recommendations yet"
                description="This dataset didn't produce any confident visualization candidates."
              />
            )}
            {recommendationsQuery.data && recommendationsQuery.data.top.length > 0 && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {recommendationsQuery.data.top.map((rec, index) => (
                  <RecommendationCard
                    key={rec.story_id}
                    recommendation={rec}
                    index={index}
                    onOpenStudio={(r) => openInStudio.mutate(r)}
                    isOpeningStudio={openInStudio.isPending}
                  />
                ))}
              </div>
            )}

            {recommendationsQuery.data && recommendationsQuery.data.derived.length > 0 && (
              <div className="mt-4 flex flex-col gap-4">
                <SectionHeading as="h2" className="text-lg">
                  Explore more
                </SectionHeading>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {recommendationsQuery.data.derived.map((rec, index) => (
                    <RecommendationCard
                      key={rec.story_id}
                      recommendation={rec}
                      index={index}
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
