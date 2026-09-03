"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import type { View } from "vega";

import { AppShell } from "@/components/layout/app-shell";
import { AnnotationList } from "@/components/visualization/annotation-list";
import { Button } from "@/components/ui/button";
import { VisualizationRenderer } from "@/components/visualization/visualization-renderer";
import { ErrorState, ProcessingState } from "@/components/ui/states";
import { Headline, SectionHeading, Subtitle } from "@/components/ui/typography";
import { getDatasetRows } from "@/lib/api/datasets";
import { ApiError } from "@/lib/api/client";
import { createExport } from "@/lib/api/exports";
import { getProfile } from "@/lib/api/insights";
import { getThemeRecommendations, type ThemeTokens } from "@/lib/api/theme";
import {
  applyCommand,
  getVisualization,
  listVersions,
  type VisualizationCommand,
} from "@/lib/api/visualizations";
import { CHART_REGISTRY } from "@/lib/visualization/registry";
import { exportPng, exportSvg } from "@/lib/visualization/export";
import { encodingTypeForColumn } from "@/lib/visualization/encoding-helpers";
import { textAnnotations } from "@/lib/visualization/to-vega-lite";
import type { AnnotationType } from "@/lib/visualization/spec";
import { cn } from "@/lib/utils";

const CHANNELS = ["x", "y", "color"] as const;
const AGGREGATIONS = ["none", "sum", "mean", "median", "count", "min", "max"] as const;
const ANNOTATION_TYPES: AnnotationType[] = [
  "reference_line",
  "callout",
  "label",
  "highlighted_region",
  "source_note",
];

export default function StudioPage() {
  const params = useParams<{ visualizationId: string }>();
  const visualizationId = params.visualizationId;
  const queryClient = useQueryClient();
  const [selectedTheme, setSelectedTheme] = useState<ThemeTokens | undefined>(undefined);
  const viewRef = useRef<View | null>(null);
  const [viewReady, setViewReady] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState<{
    type: AnnotationType;
    text: string;
    targetField: string;
    targetValue: string;
  }>({ type: "reference_line", text: "", targetField: "", targetValue: "" });

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

  const profileQuery = useQuery({
    queryKey: ["profile", visualizationQuery.data?.dataset_id],
    queryFn: () => getProfile(visualizationQuery.data!.dataset_id),
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
  const persistedTheme = themes.find((t) => t.name === currentVersion?.spec.theme);
  const activeTheme = selectedTheme ?? persistedTheme ?? themes[0];

  const implementedChartTypes = CHART_REGISTRY.filter((c) => c.implemented);
  const columns = profileQuery.data?.columns ?? [];

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
              disabled={!viewReady || !currentVersion}
              onClick={async () => {
                setExportError(null);
                try {
                  if (!viewRef.current || !currentVersion) return;
                  const blob = await exportSvg(viewRef.current, "visualization.svg");
                  await createExport(currentVersion.id, "svg", blob, "visualization.svg");
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
              disabled={!viewReady || !currentVersion}
              onClick={async () => {
                setExportError(null);
                try {
                  if (!viewRef.current || !currentVersion) return;
                  const blob = await exportPng(viewRef.current, "visualization.png");
                  await createExport(currentVersion.id, "png", blob, "visualization.png");
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
              <>
                <VisualizationRenderer
                  spec={currentVersion.spec}
                  rows={rowsQuery.data.rows}
                  theme={activeTheme}
                  onReady={(view) => {
                    viewRef.current = view;
                    setViewReady(!!view);
                  }}
                />
                <AnnotationList annotations={textAnnotations(currentVersion.spec)} />
              </>
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
                    onClick={() => {
                      setSelectedTheme(theme);
                      applyMutation.mutate({
                        type: "change_theme",
                        params: { theme: theme.name },
                      });
                    }}
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

            <div>
              <SectionHeading as="h2" className="mb-3 text-sm uppercase tracking-wide">
                Data mapping
              </SectionHeading>
              <div className="flex flex-col gap-3">
                {CHANNELS.map((channel) => {
                  const current = currentVersion?.spec.encoding[channel];
                  return (
                    <div key={channel} className="flex flex-col gap-1">
                      <label htmlFor={`channel-${channel}`} className="text-xs uppercase text-muted-foreground">
                        {channel}
                      </label>
                      <select
                        id={`channel-${channel}`}
                        className="rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1 text-sm"
                        value={current?.field ?? ""}
                        disabled={applyMutation.isPending || columns.length === 0}
                        onChange={(e) => {
                          const field = e.target.value;
                          if (!field) return;
                          const column = columns.find((c) => c.name === field);
                          if (!column) return;
                          applyMutation.mutate({
                            type: "change_field",
                            params: {
                              channel,
                              field,
                              encoding_type: encodingTypeForColumn(column),
                            },
                          });
                        }}
                      >
                        <option value="">— none —</option>
                        {columns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                      {current && (
                        <select
                          className="rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1 text-xs text-muted-foreground"
                          value={current.aggregation ?? "none"}
                          disabled={applyMutation.isPending}
                          onChange={(e) =>
                            applyMutation.mutate({
                              type: "change_aggregation",
                              params: { channel, aggregation: e.target.value },
                            })
                          }
                        >
                          {AGGREGATIONS.map((agg) => (
                            <option key={agg} value={agg}>
                              {agg === "none" ? "no aggregation" : agg}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <SectionHeading as="h2" className="mb-3 text-sm uppercase tracking-wide">
                Annotations
              </SectionHeading>
              <div className="flex flex-col gap-2">
                {currentVersion?.spec.annotations.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-[var(--radius-token)] border border-border p-2 text-xs"
                  >
                    <span className="truncate">
                      <span className="font-medium">{a.type.replace(/_/g, " ")}:</span> {a.text}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground hover:text-negative"
                      onClick={() =>
                        applyMutation.mutate({
                          type: "remove_annotation",
                          params: { id: a.id },
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <select
                  className="rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1 text-xs"
                  value={annotationDraft.type}
                  onChange={(e) =>
                    setAnnotationDraft((d) => ({ ...d, type: e.target.value as AnnotationType }))
                  }
                >
                  {ANNOTATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1 text-xs"
                  placeholder="Text"
                  value={annotationDraft.text}
                  onChange={(e) => setAnnotationDraft((d) => ({ ...d, text: e.target.value }))}
                />
                {annotationDraft.type === "reference_line" && (
                  <>
                    <select
                      className="rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1 text-xs"
                      value={annotationDraft.targetField}
                      onChange={(e) =>
                        setAnnotationDraft((d) => ({ ...d, targetField: e.target.value }))
                      }
                    >
                      <option value="">target field…</option>
                      {currentVersion?.spec.encoding.x && (
                        <option value={currentVersion.spec.encoding.x.field}>
                          {currentVersion.spec.encoding.x.field} (x)
                        </option>
                      )}
                      {currentVersion?.spec.encoding.y && (
                        <option value={currentVersion.spec.encoding.y.field}>
                          {currentVersion.spec.encoding.y.field} (y)
                        </option>
                      )}
                    </select>
                    <input
                      className="rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1 text-xs"
                      placeholder="Target value"
                      value={annotationDraft.targetValue}
                      onChange={(e) =>
                        setAnnotationDraft((d) => ({ ...d, targetValue: e.target.value }))
                      }
                    />
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={applyMutation.isPending || !annotationDraft.text}
                  onClick={() => {
                    const numericTarget = Number(annotationDraft.targetValue);
                    applyMutation.mutate({
                      type: "add_annotation",
                      params: {
                        id: crypto.randomUUID(),
                        type: annotationDraft.type,
                        text: annotationDraft.text,
                        target_field: annotationDraft.targetField || null,
                        target_value:
                          annotationDraft.targetValue && !Number.isNaN(numericTarget)
                            ? numericTarget
                            : (annotationDraft.targetValue || null),
                      },
                    });
                    setAnnotationDraft({
                      type: "reference_line",
                      text: "",
                      targetField: "",
                      targetValue: "",
                    });
                  }}
                >
                  Add annotation
                </Button>
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
