"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown, ChevronUp, Download } from "lucide-react";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import type { View } from "vega";

import { StudioToolbar } from "@/components/studio/toolbar";
import { FieldsPanel } from "@/components/studio/fields-panel";
import { MappingTab } from "@/components/studio/mapping-tab";
import { ThemeSwatchPicker } from "@/components/studio/theme-swatch-picker";
import { AnnotationList } from "@/components/visualization/annotation-list";
import { Button } from "@/components/ui/button";
import { FilterToolbar } from "@/components/visualization/filter-toolbar";
import { Tabs } from "@/components/ui/tabs";
import { VisualizationRenderer } from "@/components/visualization/visualization-renderer";
import { ErrorState, ProcessingState } from "@/components/ui/states";
import { apiClient, ApiError } from "@/lib/api/client";
import { getDataset, getDatasetRows } from "@/lib/api/datasets";
import { createExport } from "@/lib/api/exports";
import { getProfile } from "@/lib/api/insights";
import { getThemeRecommendations, type ThemeTokens } from "@/lib/api/theme";
import {
  applyCommand,
  getVisualization,
  listVersions,
  undoVisualization,
  type VisualizationCommand,
} from "@/lib/api/visualizations";
import { exportPng, exportSvg } from "@/lib/visualization/export";
import { getChartDefinition } from "@/lib/visualization/registry";
import { textAnnotations } from "@/lib/visualization/to-vega-lite";
import { relativeTime } from "@/lib/format";
import type { AnnotationType } from "@/lib/visualization/spec";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
}

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

const RIGHT_TABS = [
  { id: "mapping", label: "Mapping" },
  { id: "filters", label: "Slicers" },
  { id: "notes", label: "Notes" },
  { id: "theme", label: "Theme" },
  { id: "export", label: "Export" },
] as const;
type RightTab = (typeof RIGHT_TABS)[number]["id"];

export default function StudioPage() {
  const params = useParams<{ projectId: string; visualizationId: string }>();
  const { projectId, visualizationId } = params;
  const queryClient = useQueryClient();

  const [selectedTheme, setSelectedTheme] = useState<ThemeTokens | undefined>(undefined);
  const [hoveredTheme, setHoveredTheme] = useState<ThemeTokens | undefined>(undefined);
  const viewRef = useRef<View | null>(null);
  const [viewReady, setViewReady] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("mapping");
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

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiClient.get<Project>(`/api/projects/${projectId}`),
  });

  const datasetQuery = useQuery({
    queryKey: ["dataset", visualizationQuery.data?.dataset_id],
    queryFn: () => getDataset(visualizationQuery.data!.dataset_id),
    enabled: !!visualizationQuery.data,
  });

  const versionsQuery = useQuery({
    queryKey: ["visualization-versions", visualizationId],
    queryFn: () => listVersions(visualizationId),
  });

  const rowsQuery = useQuery({
    queryKey: ["rows", visualizationQuery.data?.dataset_id, visualizationQuery.data?.dataset_version_id],
    queryFn: () =>
      getDatasetRows(
        visualizationQuery.data!.dataset_id,
        500,
        visualizationQuery.data!.dataset_version_id
      ),
    enabled: !!visualizationQuery.data,
  });

  const profileQuery = useQuery({
    queryKey: ["profile", visualizationQuery.data?.dataset_id, visualizationQuery.data?.dataset_version_id],
    queryFn: () =>
      getProfile(visualizationQuery.data!.dataset_id, visualizationQuery.data!.dataset_version_id),
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

  const undoMutation = useMutation({
    mutationFn: () => undoVisualization(visualizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visualization-versions", visualizationId] });
    },
  });

  const currentVersion = versionsQuery.data?.at(-1);
  const themes = themesQuery.data ? [...themesQuery.data.top, ...themesQuery.data.rest] : [];
  const persistedTheme = themes.find((t) => t.name === currentVersion?.spec.theme);
  const selectedThemeForDisplay = selectedTheme ?? persistedTheme ?? themes[0];
  const activeTheme = hoveredTheme ?? selectedThemeForDisplay;
  const columns = profileQuery.data?.columns ?? [];

  const versionLabel = applyMutation.isPending
    ? "Saving…"
    : currentVersion
      ? `v${currentVersion.version_number} · saved ${relativeTime(currentVersion.created_at)}`
      : "";

  if (visualizationQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <section className="mx-auto max-w-lg px-6">
          <ErrorState
            description={
              visualizationQuery.error instanceof ApiError
                ? visualizationQuery.error.detail
                : "Couldn't load this visualization."
            }
          />
        </section>
      </div>
    );
  }

  if (visualizationQuery.isLoading || !visualizationQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <ProcessingState label="Opening visualization studio…" />
      </div>
    );
  }

  const backHref = `/projects/${projectId}/datasets/${visualizationQuery.data.dataset_id}/analysis`;

  return (
    <div className="flex h-screen flex-col bg-background">
      <StudioToolbar
        backHref={backHref}
        breadcrumbItems={[
          { label: projectQuery.data?.name ?? "…", href: `/projects/${projectId}` },
          {
            label: datasetQuery.data?.original_filename ?? "…",
            href: `/projects/${projectId}/datasets/${visualizationQuery.data.dataset_id}`,
          },
          { label: visualizationQuery.data.title },
        ]}
        versionLabel={versionLabel}
        versions={versionsQuery.data ?? []}
        canUndo={(versionsQuery.data?.length ?? 0) >= 2}
        isUndoing={undoMutation.isPending}
        onUndo={() => undoMutation.mutate()}
        onExportClick={() => {
          setRightTab("export");
          setInspectorOpen(true);
        }}
      />

      {(exportError || undoMutation.isError || applyMutation.isError) && (
        <p role="alert" className="border-b border-negative/25 bg-negative/5 px-4 py-2 text-[13px] text-negative">
          {exportError ??
            (undoMutation.isError
              ? undoMutation.error instanceof ApiError
                ? undoMutation.error.detail
                : "Couldn't undo."
              : applyMutation.error instanceof ApiError
                ? applyMutation.error.detail
                : "Couldn't apply that change.")}
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
            onAnimationComplete={() => setTimeout(() => setExportSuccess(null), 2500)}
            className="flex items-center gap-1.5 border-b border-positive/20 bg-positive-bg px-4 py-2 text-[13px] text-positive"
          >
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
            {exportSuccess}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex min-h-0 flex-1">
        {/* Mobile-only toggles: below lg the left/right panels are bottom sheets rather than
          * always-visible columns -- Studio degrades to preview + one-panel-at-a-time editing,
          * per the explicit "don't pretend the full 3-panel editor fits on mobile" instruction. */}
        <div className="flex items-center gap-2 border-b border-border p-2 lg:hidden">
          <Button variant="outline" size="sm" onClick={() => setFieldsOpen((v) => !v)}>
            Fields {fieldsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setInspectorOpen((v) => !v)}>
            Chart settings {inspectorOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>

        <aside
          className={cn(
            "w-[240px] shrink-0 border-r border-border",
            "lg:block",
            fieldsOpen
              ? "fixed inset-x-0 bottom-0 z-40 h-[60vh] w-full border-t bg-surface lg:static lg:h-auto lg:w-[240px] lg:border-t-0"
              : "hidden"
          )}
        >
          <FieldsPanel
            chartType={currentVersion?.spec.chart_type ?? ""}
            onChangeChartType={(chartType) =>
              applyMutation.mutate({ type: "change_chart_type", params: { chart_type: chartType } })
            }
            columns={columns}
            currentEncoding={currentVersion?.spec.encoding ?? {}}
            disabled={applyMutation.isPending}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-border px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            {rowsQuery.data
              ? `Preview · ${rowsQuery.data.returned_row_count} of ${rowsQuery.data.total_row_count} rows · v${currentVersion?.version_number ?? "—"}`
              : "Preview"}
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
            {(!currentVersion || rowsQuery.isLoading) && <ProcessingState label="Loading visualization…" />}
            {currentVersion && rowsQuery.data && (
              <motion.div
                key={currentVersion.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="h-full w-full"
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
                {currentVersion.spec.annotations.length > 0 &&
                  getChartDefinition(currentVersion.spec.chart_type)?.renderer !== "vega-lite" && (
                    <p className="mt-2 text-[12px] text-subtle-foreground">
                      On-chart annotation display isn&apos;t available for this chart type yet.
                    </p>
                  )}
                <AnnotationList annotations={textAnnotations(currentVersion.spec)} />
              </motion.div>
            )}
          </div>
        </main>

        <aside
          className={cn(
            "shrink-0 border-l border-border lg:block lg:w-[320px] xl:w-[340px]",
            inspectorOpen
              ? "fixed inset-x-0 bottom-0 z-40 h-[60vh] w-full overflow-y-auto border-t bg-surface lg:static lg:h-auto lg:overflow-visible lg:border-t-0"
              : "hidden"
          )}
        >
          <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
            <Tabs
              layoutId="studio-right-tab"
              value={rightTab}
              onChange={(id) => setRightTab(id as RightTab)}
              options={RIGHT_TABS as unknown as { id: string; label: string }[]}
            />

            {rightTab === "mapping" && currentVersion && (
              <MappingTab
                chartType={currentVersion.spec.chart_type}
                encoding={currentVersion.spec.encoding}
                columns={columns}
                activeTheme={activeTheme}
                disabled={applyMutation.isPending}
                onChangeField={(channel, field, encodingType) =>
                  applyMutation.mutate({
                    type: "change_field",
                    params: { channel, field, encoding_type: encodingType },
                  })
                }
                onChangeAggregation={(channel, aggregation) =>
                  applyMutation.mutate({ type: "change_aggregation", params: { channel, aggregation } })
                }
              />
            )}

            {rightTab === "filters" && (
              <div className="flex flex-col gap-3">
                <p className="text-[11.5px] text-muted-foreground">
                  Slicers narrow the rows feeding this chart, combined with AND — pick a field to
                  filter it by its actual values.
                </p>
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
                  onRemove={(id) => applyMutation.mutate({ type: "remove_filter", params: { id } })}
                />
              </div>
            )}

            {rightTab === "notes" && (
              <div className="flex flex-col gap-2">
                <p className="mb-1 text-[11.5px] text-muted-foreground">
                  Annotations pin a note to a specific point on the chart.
                </p>
                <AnimatePresence initial={false}>
                  {currentVersion?.spec.annotations.map((a) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-between gap-2 overflow-hidden rounded-[var(--radius-sm-token)] border border-border p-2 text-[12px]"
                    >
                      <span className="truncate">
                        <span className="font-medium">{a.type.replace(/_/g, " ")}:</span> {a.text}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${a.type.replace(/_/g, " ")} annotation: ${a.text}`}
                        className="shrink-0 text-muted-foreground hover:text-negative"
                        onClick={() => applyMutation.mutate({ type: "remove_annotation", params: { id: a.id } })}
                      >
                        Remove
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <select
                  aria-label="New annotation type"
                  title={ANNOTATION_DESCRIPTIONS[annotationDraft.type]}
                  className="h-8 rounded-[var(--radius-sm-token)] border border-border-strong bg-surface px-2 text-[12px]"
                  value={annotationDraft.type}
                  onChange={(e) => setAnnotationDraft((d) => ({ ...d, type: e.target.value as AnnotationType }))}
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
                  className="h-8 rounded-[var(--radius-sm-token)] border border-border-strong bg-surface px-2 text-[12px]"
                  placeholder="Text"
                  value={annotationDraft.text}
                  onChange={(e) => setAnnotationDraft((d) => ({ ...d, text: e.target.value }))}
                />
                {(["reference_line", "callout", "label"] as AnnotationType[]).includes(annotationDraft.type) && (
                  <>
                    <p className="text-[11px] text-subtle-foreground">
                      {annotationDraft.type === "reference_line"
                        ? "Anchors the line to a fixed value on one axis."
                        : "Anchors this note to a specific data value -- the chart's own data supplies the other axis."}
                    </p>
                    <select
                      aria-label="Annotation target field"
                      className="h-8 rounded-[var(--radius-sm-token)] border border-border-strong bg-surface px-2 text-[12px]"
                      value={annotationDraft.targetField}
                      onChange={(e) => setAnnotationDraft((d) => ({ ...d, targetField: e.target.value }))}
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
                      aria-label="Annotation target value"
                      className="h-8 rounded-[var(--radius-sm-token)] border border-border-strong bg-surface px-2 text-[12px]"
                      placeholder="Target value"
                      value={annotationDraft.targetValue}
                      onChange={(e) => setAnnotationDraft((d) => ({ ...d, targetValue: e.target.value }))}
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
                            : annotationDraft.targetValue || null,
                      },
                    });
                    setAnnotationDraft({ type: "reference_line", text: "", targetField: "", targetValue: "" });
                  }}
                >
                  Add annotation
                </Button>
              </div>
            )}

            {rightTab === "theme" && (
              <ThemeSwatchPicker
                themes={themes}
                selected={selectedThemeForDisplay}
                onSelect={(theme) => {
                  setSelectedTheme(theme);
                  setHoveredTheme(undefined);
                  applyMutation.mutate({ type: "change_theme", params: { theme: theme.name } });
                }}
                onHoverChange={setHoveredTheme}
              />
            )}

            {rightTab === "export" && (
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="justify-start"
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
                  High-res SVG
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
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
                  High-res PNG
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
