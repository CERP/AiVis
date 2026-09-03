/** Mirrors backend/app/schemas/recommendation.py. Kept by hand until codegen exists. */

import type { VisualizationSpec } from "@/lib/visualization/spec";

export interface VisualizationRecommendation {
  story_id: string;
  title: string;
  description: string;
  spec: VisualizationSpec;
  confidence: number;
}
