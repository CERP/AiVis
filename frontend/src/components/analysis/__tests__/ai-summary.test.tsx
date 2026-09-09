import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AISummary } from "../ai-summary";
import type { VisualizationRecommendation } from "@/lib/api/types";

function finding(description: string): VisualizationRecommendation {
  return {
    story_id: "s1",
    title: "t",
    description,
    category: "trend",
    confidence: 0.9,
    spec: {
      chart_type: "bar",
      encoding: {},
      transformations: [],
      filters: [],
      annotations: [],
      theme: "default",
      typography: {},
      layout: { show_legend: true, show_grid: true },
      metadata: { dataset_id: "d1", dataset_version_id: "v1" },
    } as unknown as VisualizationRecommendation["spec"],
  };
}

describe("AISummary", () => {
  it("renders a composed summary from the top findings' descriptions", () => {
    render(<AISummary findings={[finding("Revenue grew 34% after March."), finding("The West region led all others.")]} />);
    expect(screen.getByText(/Revenue grew 34% after March\./)).toBeInTheDocument();
    expect(screen.getByText(/The West region led all others\./)).toBeInTheDocument();
  });

  it("uses only the top two findings, not every one", () => {
    render(
      <AISummary
        findings={[finding("First."), finding("Second."), finding("Third should not appear.")]}
      />
    );
    expect(screen.queryByText(/Third should not appear/)).not.toBeInTheDocument();
  });

  it("renders nothing when there are no findings to summarize", () => {
    const { container } = render(<AISummary findings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not fabricate a summary when descriptions are blank", () => {
    const { container } = render(<AISummary findings={[finding(""), finding("   ")]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
