"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown, Download } from "lucide-react";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import type { View } from "vega";

import { AppShell } from "@/components/layout/app-shell";
import { AnnotationList } from "@/components/visualization/annotation-list";
import { Button } from "@/components/ui/button";
import { FilterToolbar } from "@/components/visualization/filter-toolbar";
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
import { CHART_REGISTRY, getChartDefinition, type EncodingChannel } from "@/lib/visualization/registry";
import { exportPng, exportSvg } from "@/lib/visualization/export";
import { encodingTypeForColumn } from "@/lib/visualization/encoding-helpers";
import { textAnnotations } from "@/lib/visualization/to-vega-lite";
import type { AnnotationType } from "@/lib/visualization/spec";
import { cn } from "@/lib/utils";

// The only channels the CHANGE_FIELD/CHANGE_AGGREGATION commands accept
// (backend/app/visualization/commands.py); other registry channels (x2, measure2, OHLC, ...)
// are set by chart-type-specific Vega builders, not manual mapping.
const MAPPABLE_CHANNELS = ["x", "y", "color", "size", "detail"] as const;
const CHANNEL_LABELS: Record<(typeof MAPPABLE_CHANNELS)[number], string> = {
  x: "X-Axis",
  y: "Y-Axis",
  color: "Color / Legend",
  size: "Size",
  detail: "Detail (tooltip)",
};
const AGGREGATIONS = ["none", "sum", "mean", "median", "count", "min", "max"] as const;
const ANNOTATION_TYPES: AnnotationType[] = [
  "reference_line",
  "callout",
  "label",
  "highlighted_region",
  "source_note",
];
const ANNOTATION_DESCRIPTIONS: Record<AnnotationType, string> = {
  reference_line: "Marks a fixed threshold or target value for comparison.",
  callout: "Draws attention to a specific point on the chart, e.g. a peak or anomaly.",
  label: "A plain text label attached to the chart.",
  highlighted_region: "Shades a range of the chart to draw attention to a span of values.",
  source_note: "Attribution or methodology text shown below the chart.",
};

export default function StudioPage() {
  const params = useParams<{ visualizationId: string }>();
  const visualizationId = params.visualizationId;
  const queryClient = useQueryClient();
  const [selectedTheme, setSelectedTheme] = useState<ThemeTokens | undefined>(undefined);
  const viewRef = useRef<View | null>(null);
  const [viewReady, setViewReady] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [hoveredTheme, setHoveredTheme] = useState<ThemeTokens | undefined>(undefined);
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
  const selectedThemeForDisplay = selectedTheme ?? persistedTheme ?? themes[0];
  const activeTheme = hoveredTheme ?? selectedThemeForDisplay;

  const implementedChartTypes = CHART_REGISTRY.filter((c) => c.implemented);
  const columns = profileQuery.data?.columns ?? [];

  const activeChartDefinition = currentVersion
    ? getChartDefinition(currentVersion.spec.chart_type)
    : undefined;
  const relevantChannels = activeChartDefinition
    ? MAPPABLE_CHANNELS.filter((ch) =>
        [...activeChartDefinition.requiredEncodings, ...activeChartDefinition.optionalEncodings].includes(
          ch as EncodingChannel
        )
      )
    : MAPPABLE_CHANNELS;
  const mappingChannels = relevantChannels.length > 0 ? relevantChannels : MAPPABLE_CHANNELS;

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
                setExportSuccess(null);
                try {
                  if (!viewRef.current || !currentVersion) return;
                  const blob = await exportSvg(viewRef.current, "visualization.svg");
                  await createExport(currentVersion.id, "svg", blob, "visualization.svg");
                  setExportSuccess("Exported visualization.svg");
                } catch (err) {
                  setExportError(err instanceof Error ? err.message : "SVG export failed.");
                }
              }}
            >
              <Download aria-hidden className="mr-1.5 h-4 w-4" />
              Export SVG
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!viewReady || !currentVersion}
              onClick={async () => {
                setExportError(null);
                setExportSuccess(null);
                try {
                  if (!viewRef.current || !currentVersion) return;
                  const blob = await exportPng(viewRef.current, "visualization.png");
                  await createExport(currentVersion.id, "png", blob, "visualization.png");
                  setExportSuccess("Exported visualization.png");
                } catch (err) {
                  setExportError(err instanceof Error ? err.message : "PNG export failed.");
                }
              }}
            >
              <Download aria-hidden className="mr-1.5 h-4 w-4" />
              Export PNG
            </Button>
          </div>
        </div>
        {exportError && (
          <p role="alert" className="text-sm text-negative">
            {exportError}
          </p>
        )}
        <AnimatePresence>
          {exportSuccess && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="status"
              aria-live="polite"
              onAnimationComplete={() => {
                setTimeout(() => setExportSuccess(null), 2500);
              }}
              className="flex items-center gap-1.5 text-sm text-positive"
            >
              <CheckCircle2 aria-hidden className="h-4 w-4" />
              {exportSuccess}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px]">
          <div className="overflow-hidden rounded-[var(--radius-token)] border border-border bg-surface shadow-md">
            <div className="flex items-center justify-between border-b border-border bg-surface-muted px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Preview
            </div>
            <FilterToolbar
              filters={currentVersion?.spec.filters ?? []}
              columns={columns}
              disabled={applyMutation.isPending}
              onAdd={(filter) =>
                applyMutation.mutate({
                  type: "filter_data",
                  params: { id: crypto.randomUUID(), ...filter },
                })
              }
              onRemove={(id) =>
                applyMutation.mutate({ type: "remove_filter", params: { id } })
              }
            />
            <div className="p-6">
            {(!currentVersion || rowsQuery.isLoading) && (
              <ProcessingState label="Loading visualization…" />
            )}
            {currentVersion && rowsQuery.data && (
              <motion.div
                key={currentVersion.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
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
              </motion.div>
            )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <button
              type="button"
              aria-expanded={inspectorOpen}
              aria-controls="studio-inspector"
              onClick={() => setInspectorOpen((v) => !v)}
              className="flex items-center justify-between rounded-[var(--radius-token)] border border-border-strong px-3 py-2 text-sm font-medium lg:hidden"
            >
              Chart settings
              <ChevronDown
                aria-hidden
                className={cn("h-4 w-4 transition-transform", inspectorOpen && "rotate-180")}
              />
            </button>

            <div
              id="studio-inspector"
              className={cn("flex-col gap-6", inspectorOpen ? "flex" : "hidden", "lg:flex")}
            >
            <div>
              <SectionHeading as="h2" className="mb-3 text-sm uppercase tracking-wide">
                Chart type
              </SectionHeading>
              <div className="flex flex-col gap-1">
                {implementedChartTypes.map((chart) => {
                  const isActive = currentVersion?.spec.chart_type === chart.id;
                  return (
                    <motion.button
                      key={chart.id}
                      type="button"
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.12 }}
                      disabled={applyMutation.isPending}
                      onClick={() =>
                        applyMutation.mutate({
                          type: "change_chart_type",
                          params: { chart_type: chart.id },
                        })
                      }
                      className={cn(
                        "relative rounded-[var(--radius-token)] border px-3 py-1.5 text-left text-sm",
                        isActive
                          ? "border-foreground font-medium"
                          : "border-transparent text-muted-foreground hover:border-border-strong"
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="chart-type-active"
                          className="absolute inset-0 -z-10 rounded-[var(--radius-token)] bg-surface-muted"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      {chart.label}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div>
              <SectionHeading as="h2" className="mb-3 text-sm uppercase tracking-wide">
                Theme
              </SectionHeading>
              <div className="flex flex-wrap gap-1">
                {themes.map((theme) => (
                  <motion.button
                    key={theme.name}
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    transition={{ duration: 0.12 }}
                    onMouseEnter={() => setHoveredTheme(theme)}
                    onMouseLeave={() => setHoveredTheme(undefined)}
                    onFocus={() => setHoveredTheme(theme)}
                    onBlur={() => setHoveredTheme(undefined)}
                    onClick={() => {
                      setSelectedTheme(theme);
                      setHoveredTheme(undefined);
                      applyMutation.mutate({
                        type: "change_theme",
                        params: { theme: theme.name },
                      });
                    }}
                    title={theme.name.replace(/_/g, " ")}
                    aria-label={`Apply ${theme.name.replace(/_/g, " ")} theme`}
                    aria-pressed={selectedThemeForDisplay?.name === theme.name}
                    className="flex h-10 w-10 items-center justify-center"
                  >
                    <motion.span
                      whileHover={{ scale: 1.15 }}
                      className={cn(
                        "grid h-6 w-6 grid-cols-2 grid-rows-2 overflow-hidden rounded-full border-2",
                        selectedThemeForDisplay?.name === theme.name
                          ? "border-foreground"
                          : "border-border-strong"
                      )}
                    >
                      {theme.categorical_colors.slice(0, 4).map((color, i) => (
                        <span key={i} style={{ backgroundColor: color }} />
                      ))}
                    </motion.span>
                  </motion.button>
                ))}
              </div>
            </div>

            <div>
              <SectionHeading as="h2" className="mb-3 text-sm uppercase tracking-wide">
                Data mapping
              </SectionHeading>
              <div className="flex flex-col gap-3">
                {mappingChannels.map((channel) => {
                  const current = currentVersion?.spec.encoding[channel];
                  return (
                    <div key={channel} className="flex flex-col gap-1">
                      <label htmlFor={`channel-${channel}`} className="text-xs uppercase text-muted-foreground">
                        {CHANNEL_LABELS[channel]}
                      </label>
                      <div className="flex items-center gap-1.5">
                        {channel === "color" && current && (
                          <span
                            aria-hidden
                            title="Uses the active theme's color palette"
                            className="h-4 w-4 shrink-0 rounded-full border border-border-strong"
                            style={{ backgroundColor: activeTheme?.categorical_colors[0] }}
                          />
                        )}
                        <select
                          id={`channel-${channel}`}
                          className="w-full rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1 text-sm"
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
                              {col.name} — {col.semantic_type ?? "unknown"}
                            </option>
                          ))}
                        </select>
                      </div>
                      {current && (
                        <select
                          aria-label={`Aggregation for ${channel}`}
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
                <AnimatePresence initial={false}>
                  {currentVersion?.spec.annotations.map((a) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-between gap-2 overflow-hidden rounded-[var(--radius-token)] border border-border p-2 text-xs"
                    >
                      <span className="truncate">
                        <span className="font-medium">{a.type.replace(/_/g, " ")}:</span> {a.text}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${a.type.replace(/_/g, " ")} annotation: ${a.text}`}
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
                    </motion.div>
                  ))}
                </AnimatePresence>

                <select
                  aria-label="New annotation type"
                  title={ANNOTATION_DESCRIPTIONS[annotationDraft.type]}
                  className="rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1 text-xs"
                  value={annotationDraft.type}
                  onChange={(e) =>
                    setAnnotationDraft((d) => ({ ...d, type: e.target.value as AnnotationType }))
                  }
                >
                  {ANNOTATION_TYPES.map((t) => (
                    <option key={t} value={t} title={ANNOTATION_DESCRIPTIONS[t]}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {ANNOTATION_DESCRIPTIONS[annotationDraft.type]}
                </p>
                <input
                  aria-label="New annotation text"
                  className="rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1 text-xs"
                  placeholder="Text"
                  value={annotationDraft.text}
                  onChange={(e) => setAnnotationDraft((d) => ({ ...d, text: e.target.value }))}
                />
                {annotationDraft.type === "reference_line" && (
                  <>
                    <select
                      aria-label="Reference line target field"
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
                      aria-label="Reference line target value"
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
        </div>
      </section>
    </AppShell>
  );
}
