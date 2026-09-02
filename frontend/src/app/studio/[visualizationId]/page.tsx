"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import type { View } from "vega";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { VisualizationRenderer } from "@/components/visualization/visualization-renderer";
import { ErrorState, ProcessingState } from "@/components/ui/states";
import { Headline, SectionHeading, Subtitle } from "@/components/ui/typography";
import { getDatasetRows } from "@/lib/api/datasets";
import { ApiError } from "@/lib/api/client";
import { getThemeRecommendations, type ThemeTokens } from "@/lib/api/theme";
import {
  applyCommand,
  getVisualization,
  listVersions,
  type VisualizationCommand,
} from "@/lib/api/visualizations";
import { CHART_REGISTRY } from "@/lib/visualization/registry";
import { exportPng, exportSvg } from "@/lib/visualization/export";
import { cn } from "@/lib/utils";

export default function StudioPage() {
  const params = useParams<{ visualizationId: string }>();
  const visualizationId = params.visualizationId;
  const queryClient = useQueryClient();
  const [selectedTheme, setSelectedTheme] = useState<ThemeTokens | undefined>(undefined);
  const viewRef = useRef<View | null>(null);
  const [viewReady, setViewReady] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const visualizationQuery = useQuery({
    queryKey: ["visualization", visualizationId],
    queryFn: () => getVisualization(visualizationId),
  });

  const versionsQuery = useQuery({
    queryKey: ["visualization-versions", visualizationId],
    queryFn: () => listVersions(visualizationId),
  });

  const rowsQuery = useQuery({
    queryKey: ["rows", visualizationQuery.data?.dataset_id],
    queryFn: () => getDatasetRows(visualizationQuery.data!.dataset_id),
    enabled: !!visualizationQuery.data,
  });

  const themesQuery = useQuery({
    queryKey: ["theme-recommendations"],
    queryFn: getThemeRecommendations,
  });

  const applyMutation = useMutation({
    mutationFn: (command: VisualizationCommand) => applyCommand(visualizationId, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visualization-versions", visualizationId] });
    },
  });

  const currentVersion = versionsQuery.data?.at(-1);
  const themes = themesQuery.data ? [...themesQuery.data.top, ...themesQuery.data.rest] : [];
  const activeTheme = selectedTheme ?? themes[0];

  const implementedChartTypes = CHART_REGISTRY.filter((c) => c.implemented);

  if (visualizationQuery.isError) {
    return (
      <AppShell>
        <section className="mx-auto max-w-3xl px-6 py-16">
          <ErrorState
            description={
              visualizationQuery.error instanceof ApiError
                ? visualizationQuery.error.detail
                : "Couldn't load this visualization."
            }
          />
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-16">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Headline as="h1" className="text-3xl">
              {visualizationQuery.data?.title ?? "Studio"}
            </Headline>
            {currentVersion && (
              <Subtitle className="mt-2">
                Version {currentVersion.version_number} · {currentVersion.spec.chart_type}
              </Subtitle>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!viewReady}
              onClick={async () => {
                setExportError(null);
                try {
                  if (viewRef.current) await exportSvg(viewRef.current, "visualization.svg");
                } catch (err) {
                  setExportError(err instanceof Error ? err.message : "SVG export failed.");
                }
              }}
            >
              Export SVG
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!viewReady}
              onClick={async () => {
                setExportError(null);
                try {
                  if (viewRef.current) await exportPng(viewRef.current, "visualization.png");
                } catch (err) {
                  setExportError(err instanceof Error ? err.message : "PNG export failed.");
                }
              }}
            >
              Export PNG
            </Button>
          </div>
        </div>
        {exportError && (
          <p role="alert" className="text-sm text-negative">
            {exportError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px]">
          <div className="rounded-[var(--radius-token)] border border-border p-6">
            {(!currentVersion || rowsQuery.isLoading) && (
              <ProcessingState label="Loading visualization…" />
            )}
            {currentVersion && rowsQuery.data && (
              <VisualizationRenderer
                spec={currentVersion.spec}
                rows={rowsQuery.data.rows}
                theme={activeTheme}
                onReady={(view) => {
                  viewRef.current = view;
                  setViewReady(!!view);
                }}
              />
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <SectionHeading as="h2" className="mb-3 text-sm uppercase tracking-wide">
                Chart type
              </SectionHeading>
              <div className="flex flex-col gap-1">
                {implementedChartTypes.map((chart) => (
                  <button
                    key={chart.id}
                    type="button"
                    disabled={applyMutation.isPending}
                    onClick={() =>
                      applyMutation.mutate({
                        type: "change_chart_type",
                        params: { chart_type: chart.id },
                      })
                    }
                    className={cn(
                      "rounded-[var(--radius-token)] border px-3 py-1.5 text-left text-sm",
                      currentVersion?.spec.chart_type === chart.id
                        ? "border-foreground font-medium"
                        : "border-transparent text-muted-foreground hover:border-border-strong"
                    )}
                  >
                    {chart.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <SectionHeading as="h2" className="mb-3 text-sm uppercase tracking-wide">
                Theme
              </SectionHeading>
              <div className="flex flex-wrap gap-2">
                {themes.map((theme) => (
                  <button
                    key={theme.name}
                    type="button"
                    onClick={() => setSelectedTheme(theme)}
                    className={cn(
                      "h-6 w-6 rounded-full border",
                      activeTheme?.name === theme.name ? "border-foreground" : "border-border-strong"
                    )}
                    style={{ backgroundColor: theme.categorical_colors[0] }}
                    title={theme.name.replace(/_/g, " ")}
                  />
                ))}
              </div>
            </div>

            {applyMutation.isError && (
              <p role="alert" className="text-sm text-negative">
                {applyMutation.error instanceof ApiError
                  ? applyMutation.error.detail
                  : "Couldn't apply that change."}
              </p>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
