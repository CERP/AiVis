import { AppShell } from "@/components/layout/app-shell";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { Headline, Subtitle } from "@/components/ui/typography";
import type { RecommendationsResponse } from "@/lib/api/types";

/**
 * Mock data shaped exactly like GET /api/datasets/:id/visualizations/recommendations.
 * Wire this to a real fetch once Phase 3-003 (frontend auth) exists to obtain a token.
 */
const mockRecommendations: RecommendationsResponse = {
  top: [
    {
      story_id: "1",
      title: "Revenue increased 83.3%",
      analytical_question: "How did date and revenue change over time?",
      explanation:
        "Revenue increased from 1200.50 to 2200.00 (83.3%) across the observed period.",
      why_recommended: "Derived from a 70%-confidence insight involving date, revenue.",
      confidence: 0.7,
      spec: {
        chart_type: "line",
        encoding: {
          x: { field: "date", type: "temporal" },
          y: { field: "revenue", type: "quantitative", aggregation: "sum" },
        },
        transformations: [],
        filters: [],
        annotations: [],
        theme: "minimal",
        typography: {},
        layout: { show_legend: true, show_grid: true },
        metadata: { dataset_id: "d1", dataset_version_id: "v1" },
      },
    },
    {
      story_id: "2",
      title: "Strong positive relationship between revenue and units",
      analytical_question: "How do revenue and units relate to each other?",
      explanation: "Revenue and units show a strong positive relationship (r=1.00).",
      why_recommended: "Derived from a 95%-confidence insight involving revenue, units.",
      confidence: 0.95,
      spec: {
        chart_type: "scatter",
        encoding: {
          x: { field: "units", type: "quantitative" },
          y: { field: "revenue", type: "quantitative" },
        },
        transformations: [],
        filters: [],
        annotations: [],
        theme: "minimal",
        typography: {},
        layout: { show_legend: true, show_grid: true },
        metadata: { dataset_id: "d1", dataset_version_id: "v1" },
      },
    },
    {
      story_id: "3",
      title: "Gadget leads on revenue",
      analytical_question: "Which product leads on revenue?",
      explanation:
        "Gadget has the highest total revenue (8786.35, 64.5% of the total across 2 categories).",
      why_recommended: "Derived from an 85%-confidence insight involving product, revenue.",
      confidence: 0.85,
      spec: {
        chart_type: "bar",
        encoding: {
          x: { field: "product", type: "nominal" },
          y: { field: "revenue", type: "quantitative", aggregation: "sum" },
        },
        transformations: [],
        filters: [],
        annotations: [],
        theme: "minimal",
        typography: {},
        layout: { show_legend: true, show_grid: true },
        metadata: { dataset_id: "d1", dataset_version_id: "v1" },
      },
    },
  ],
  derived: [
    {
      story_id: "4",
      title: "Most revenue values fall between 1200.50 and 2150.75",
      analytical_question: "What's the typical range of revenue?",
      explanation:
        "The middle 50% of revenue observations fall between 1200.50 and 2150.75 (median 1657.85).",
      why_recommended: "Derived from a 75%-confidence insight involving revenue.",
      confidence: 0.75,
      spec: {
        chart_type: "histogram",
        encoding: { x: { field: "revenue", type: "quantitative" } },
        transformations: [],
        filters: [],
        annotations: [],
        theme: "minimal",
        typography: {},
        layout: { show_legend: true, show_grid: true },
        metadata: { dataset_id: "d1", dataset_version_id: "v1" },
      },
    },
  ],
};

export default function RecommendationsPreviewPage() {
  return (
    <AppShell>
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-16">
        <div className="max-w-2xl">
          <Headline as="h1" className="text-4xl">
            8 ways to see your data
          </Headline>
          <Subtitle className="mt-3">
            Ranked by analytical relevance and insight strength, not just chart compatibility.
          </Subtitle>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {mockRecommendations.top.map((rec, index) => (
            <RecommendationCard key={rec.story_id} recommendation={rec} index={index} />
          ))}
        </div>

        {mockRecommendations.derived.length > 0 && (
          <div className="mt-8">
            <Subtitle className="mb-4 text-lg font-medium text-foreground">Explore more</Subtitle>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {mockRecommendations.derived.map((rec, index) => (
                <RecommendationCard key={rec.story_id} recommendation={rec} index={index} />
              ))}
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
