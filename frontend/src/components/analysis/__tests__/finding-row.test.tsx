import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/visualization/visualization-renderer", () => ({
  VisualizationRenderer: () => <div data-testid="chart-render">chart</div>,
}));

import { FindingRow } from "../finding-row";
import type { VisualizationRecommendation } from "@/lib/api/types";

function makeFinding(overrides: Partial<VisualizationRecommendation> = {}): VisualizationRecommendation {
  return {
    story_id: "s1",
    title: "Revenue accelerated after March",
    description: "Monthly revenue grew 34% faster after March than before.",
    category: "trend",
    confidence: 0.9,
    spec: {
      chart_type: "line",
      encoding: {
        x: { field: "signup_date", type: "temporal" },
        y: { field: "revenue", type: "quantitative" },
      },
      transformations: [],
      filters: [],
      annotations: [],
      theme: "default",
      typography: {},
      layout: { show_legend: true, show_grid: true },
      metadata: { dataset_id: "d1", dataset_version_id: "v1" },
    },
    ...overrides,
  } as VisualizationRecommendation;
}

describe("FindingRow", () => {
  it("shows the Insight label and glyph for a conclusion-style category", () => {
    render(<FindingRow recommendation={makeFinding({ category: "trend" })} onOpenStudio={vi.fn()} />);
    expect(screen.getByText("Insight")).toBeInTheDocument();
  });

  it("shows the Exploration label for a relationship/distribution-style category", () => {
    render(<FindingRow recommendation={makeFinding({ category: "relationship" })} onOpenStudio={vi.fn()} />);
    expect(screen.getByText("Exploration")).toBeInTheDocument();
  });

  it("renders the headline, explanation, and relevant fields", () => {
    render(<FindingRow recommendation={makeFinding()} onOpenStudio={vi.fn()} />);
    expect(screen.getByText("Revenue accelerated after March")).toBeInTheDocument();
    expect(screen.getByText(/grew 34% faster/)).toBeInTheDocument();
    expect(screen.getByText("signup_date · revenue")).toBeInTheDocument();
  });

  it("renders a chart preview", () => {
    render(<FindingRow recommendation={makeFinding()} previewRows={[{ revenue: 1 }]} onOpenStudio={vi.fn()} />);
    expect(screen.getByTestId("chart-render")).toBeInTheDocument();
  });

  it("degrades gracefully to a glyph when no preview rows are available, instead of breaking the row", () => {
    render(<FindingRow recommendation={makeFinding()} onOpenStudio={vi.fn()} />);
    expect(screen.queryByTestId("chart-render")).not.toBeInTheDocument();
    expect(screen.getByText("Revenue accelerated after March")).toBeInTheDocument();
  });

  it("calls onOpenStudio with the recommendation", async () => {
    const onOpenStudio = vi.fn();
    render(<FindingRow recommendation={makeFinding()} onOpenStudio={onOpenStudio} />);
    screen.getByRole("button", { name: "Open in Studio" }).click();
    expect(onOpenStudio).toHaveBeenCalledWith(makeFinding());
  });

  it("never shows a confidence-percentage badge (description text may still contain a % naturally)", () => {
    render(<FindingRow recommendation={makeFinding()} onOpenStudio={vi.fn()} />);
    expect(screen.queryByText(/\d+%\s*confidence/i)).not.toBeInTheDocument();
  });
});
