"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { CategoryRail } from "@/components/explorer/category-rail";
import { ChartCard } from "@/components/explorer/chart-card";
import { ChartDetailPanel } from "@/components/explorer/chart-detail-panel";
import { DatasetPicker } from "@/components/explorer/dataset-picker";
import { ApiError } from "@/lib/api/client";
import { getDataset, type Dataset } from "@/lib/api/datasets";
import { getProfile } from "@/lib/api/insights";
import { createVisualization } from "@/lib/api/visualizations";
import { CHART_REGISTRY, type ChartCategory, type ChartTypeDefinition } from "@/lib/visualization/registry";
import { buildDraftEncoding } from "@/lib/visualization/draft-encoding";
import { categoriesWithCounts, chartsInCategory } from "@/lib/visualization/chart-taxonomy";
import type { VisualizationSpec } from "@/lib/visualization/spec";

function matchesSearch(def: ChartTypeDefinition, query: string): boolean {
  const q = query.toLowerCase();
  return (
    def.label.toLowerCase().includes(q) ||
    def.category.toLowerCase().includes(q) ||
    def.subcategory.toLowerCase().includes(q) ||
    def.description.toLowerCase().includes(q)
  );
}

export default function ChartExplorerPage() {
  return (
    <Suspense fallback={null}>
      <ChartExplorerContent />
    </Suspense>
  );
}

function ChartExplorerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contextDatasetId = searchParams.get("datasetId");

  const categories = categoriesWithCounts();
  const [active, setActive] = useState<ChartCategory | null>(categories[0]?.category ?? null);
  const [query, setQuery] = useState("");
  const [selectedDef, setSelectedDef] = useState<ChartTypeDefinition | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const contextDatasetQuery = useQuery({
    queryKey: ["dataset", contextDatasetId],
    queryFn: () => getDataset(contextDatasetId as string),
    enabled: !!contextDatasetId,
    retry: false,
  });

  const contextDataset =
    contextDatasetId && contextDatasetQuery.isSuccess ? contextDatasetQuery.data : null;
  const contextDatasetInvalid = !!contextDatasetId && contextDatasetQuery.isError;

  const createMutation = useMutation({
    mutationFn: async ({
      dataset,
      def,
    }: {
      dataset: Pick<Dataset, "id" | "project_id">;
      def: ChartTypeDefinition;
    }) => {
      const profile = await getProfile(dataset.id);
      const encoding = buildDraftEncoding(def, profile.columns);
      if (!encoding) {
        throw new Error(`${def.label} isn't compatible with the columns in this dataset.`);
      }
      const spec: VisualizationSpec = {
        chart_type: def.id,
        encoding,
        transformations: [],
        filters: [],
        annotations: [],
        theme: "minimal",
        typography: { title: def.label },
        layout: { show_legend: true, show_grid: true },
        metadata: { dataset_id: dataset.id, dataset_version_id: profile.dataset_version_id },
      };
      return createVisualization(dataset.project_id, { title: def.label, story_id: null, spec });
    },
    onSuccess: (visualization) => {
      setCreateError(null);
      router.push(`/projects/${visualization.project_id}/visualizations/${visualization.id}`);
    },
    onError: (err) => {
      setCreateError(err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "Couldn't create this chart.");
    },
  });

  function handleUseChart() {
    if (!selectedDef) return;
    setCreateError(null);
    if (contextDataset) {
      createMutation.mutate({ dataset: contextDataset, def: selectedDef });
    } else {
      setShowPicker(true);
    }
  }

  const visibleCharts = query.trim()
    ? CHART_REGISTRY.filter((def) => matchesSearch(def, query))
    : active
      ? chartsInCategory(active)
      : [];

  return (
    <AppShell>
      <section className="mx-auto flex max-w-[1320px] flex-col gap-6 px-5 py-8 sm:px-7">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-headline text-[22px] font-semibold tracking-tight">Chart Explorer</h1>
            {contextDataset && (
              <span className="rounded-[var(--radius-sm-token)] border border-border bg-surface-muted px-2.5 py-1 text-[12.5px] text-muted-foreground">
                For {contextDataset.original_filename}
              </span>
            )}
          </div>
          {contextDatasetInvalid && (
            <p role="alert" className="text-[13px] text-negative">
              Couldn&apos;t load this dataset context. You can still browse charts and pick a dataset when you&apos;re ready.
            </p>
          )}
          <div className="relative max-w-sm">
            <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search charts…"
              aria-label="Search charts"
              className="h-9 w-full rounded-[var(--radius-token)] border border-border-strong bg-surface pl-8 pr-3 text-[13.5px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <CategoryRail
            className="lg:w-[180px] lg:shrink-0"
            active={query.trim() ? null : active}
            onChange={(category) => {
              setQuery("");
              setActive(category);
            }}
          />

          <div className="flex min-w-0 flex-1 gap-6">
            <div className="min-w-0 flex-1">
              {createError && (
                <p role="alert" className="mb-4 text-[13px] text-negative">
                  {createError}
                </p>
              )}
              {visibleCharts.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-[13.5px] text-muted-foreground">
                    {query.trim() ? `No charts match "${query}".` : "Select a category to browse charts."}
                  </p>
                  {query.trim() && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="mt-2 text-[13px] font-medium text-accent hover:underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {visibleCharts.map((def) => (
                    <ChartCard
                      key={def.id}
                      def={def}
                      selected={selectedDef?.id === def.id}
                      onSelect={() => {
                        setCreateError(null);
                        setSelectedDef(def);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {selectedDef && (
              <ChartDetailPanel
                def={selectedDef}
                isCreating={createMutation.isPending}
                onUse={handleUseChart}
                onClose={() => setSelectedDef(null)}
              />
            )}
          </div>
        </div>
      </section>

      {showPicker && selectedDef && (
        <DatasetPicker
          onClose={() => setShowPicker(false)}
          onSelect={(dataset) => {
            setShowPicker(false);
            createMutation.mutate({ dataset, def: selectedDef });
          }}
        />
      )}
    </AppShell>
  );
}
