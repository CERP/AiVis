"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { VisualizationRenderer } from "@/components/visualization/visualization-renderer";
import { ProcessingState } from "@/components/ui/states";
import { SectionHeading, Subtitle } from "@/components/ui/typography";
import { getThemeRecommendations, type ThemeTokens } from "@/lib/api/theme";
import type { VisualizationSpec } from "@/lib/visualization/spec";
import { cn } from "@/lib/utils";

const sampleRows = [
  { region: "North", revenue: 5241.35 },
  { region: "South", revenue: 2405.6 },
  { region: "East", revenue: 2960.25 },
  { region: "West", revenue: 3010.0 },
];

const baseSpec: VisualizationSpec = {
  chart_type: "bar",
  encoding: {
    x: { field: "region", type: "nominal" },
    y: { field: "revenue", type: "quantitative", aggregation: "sum" },
  },
  transformations: [],
  filters: [],
  annotations: [],
  theme: "minimal",
  typography: { title: "Revenue by region" },
  layout: { show_legend: true, show_grid: true },
  metadata: { dataset_id: "sample", dataset_version_id: "sample" },
};

export default function ThemePreviewPage() {
  const [selected, setSelected] = useState<ThemeTokens | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ["theme-recommendations"],
    queryFn: getThemeRecommendations,
  });

  const themes = data ? [...data.top, ...data.rest] : [];
  const activeTheme = selected ?? themes[0];

  return (
    <AppShell>
      <section className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-16">
        <div>
          <SectionHeading>Choose a theme</SectionHeading>
          <Subtitle>Applies real theme tokens (colors, contrast-checked) to a live chart.</Subtitle>
        </div>

        {isLoading && <ProcessingState label="Loading themes…" />}

        {themes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {themes.map((theme) => (
              <button
                key={theme.name}
                type="button"
                onClick={() => setSelected(theme)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
                  activeTheme?.name === theme.name
                    ? "border-foreground"
                    : "border-border-strong text-muted-foreground"
                )}
              >
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-full border border-border-strong"
                  style={{ backgroundColor: theme.categorical_colors[0] }}
                />
                {theme.name.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        )}

        {activeTheme && (
          <div
            className="rounded-[var(--radius-token)] border border-border p-6"
            style={{ backgroundColor: activeTheme.background }}
          >
            <VisualizationRenderer spec={baseSpec} rows={sampleRows} theme={activeTheme} />
          </div>
        )}
      </section>
    </AppShell>
  );
}
