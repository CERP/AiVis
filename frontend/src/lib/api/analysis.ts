import { apiClient } from "@/lib/api/client";
import type { VisualizationRecommendation } from "@/lib/api/types";

/** Mirrors backend/app/schemas/analysis.py. Kept by hand until codegen exists. */

export type AnalysisStageStatus = "complete" | "processing" | "pending";

export type AnalysisStatus =
  | "queued"
  | "profiling_quality"
  | "building_ai_context"
  | "ai_analyzing"
  | "generating_recommendations"
  | "validating"
  | "ranking"
  | "generating_previews"
  | "ready"
  | "failed";

export interface DataQualityIssue {
  type: string;
  column: string | null;
  description: string;
  severity: "low" | "medium" | "high";
  recommendation: string;
}

export interface DataQuality {
  score: number;
  issues: DataQualityIssue[];
}

export interface AnalysisRecommendations {
  top: VisualizationRecommendation[];
  shortfall_reason: string | null;
}

export interface Analysis {
  id: string;
  dataset_id: string;
  dataset_version_id: string;
  status: AnalysisStatus;
  progress: number;
  stages: Record<string, AnalysisStageStatus>;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  pipeline_version: number;
  prompt_version: number;
  retry_count: number;
  data_quality: DataQuality | null;
  ai_findings: Record<string, unknown> | null;
  recommendations: AnalysisRecommendations | null;
}

/** Uploading a dataset alone starts the whole pipeline server-side -- this is the only
 * endpoint the frontend needs to reach the final recommendations; no manual "Analyze" call. */
export function getAnalysis(datasetId: string) {
  return apiClient.get<Analysis>(`/api/datasets/${datasetId}/analysis`);
}

export function retryAnalysis(datasetId: string) {
  return apiClient.post<Analysis>(`/api/datasets/${datasetId}/analysis/retry`);
}

export const ANALYSIS_STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  profiling_quality: "Analyzing data quality",
  building_ai_context: "Building AI context",
  ai_analyzing: "AI is analyzing the dataset",
  generating_recommendations: "Generating recommendations",
  validating: "Validating visualizations",
  ranking: "Ranking visualizations",
  generating_previews: "Generating previews",
};
