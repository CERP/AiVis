/** Mirrors backend/app/schemas/recommendation.py. Kept by hand until codegen exists. */

import type { VisualizationSpec } from "@/lib/visualization/spec";

export interface VisualizationRecommendation {
  story_id: string;
  title: string;
  analytical_question: string;
  explanation: string;
  why_recommended: string;
  spec: VisualizationSpec;
  confidence: number;
}

export interface RecommendationsResponse {
  top: VisualizationRecommendation[];
  derived: VisualizationRecommendation[];
}
