import { apiClient } from "@/lib/api/client";
import type { RecommendationsResponse } from "@/lib/api/types";

export interface ColumnProfile {
  id: string;
  name: string;
  ordinal: number;
  raw_type: string;
  semantic_type: string | null;
  is_pii: boolean;
  null_count: number;
  unique_count: number;
  stats: Record<string, unknown>;
}

export interface DatasetProfile {
  dataset_version_id: string;
  row_count: number;
  column_count: number;
  columns: ColumnProfile[];
}

export interface Insight {
  id: string;
  type: string;
  title: string;
  description: string;
  fields: string[];
  confidence: number;
}

export interface Story {
  id: string;
  title: string;
  analytical_question: string;
  recommended_chart_type: string | null;
  confidence: number;
}

export function getProfile(datasetId: string) {
  return apiClient.get<DatasetProfile>(`/api/datasets/${datasetId}/profile`);
}

export function listInsights(datasetId: string) {
  return apiClient.get<Insight[]>(`/api/datasets/${datasetId}/insights`);
}

export function analyzeInsights(datasetId: string) {
  return apiClient.post<Insight[]>(`/api/datasets/${datasetId}/insights/analyze`);
}

export function listStories(datasetId: string) {
  return apiClient.get<Story[]>(`/api/datasets/${datasetId}/stories`);
}

export function analyzeStories(datasetId: string) {
  return apiClient.post<Story[]>(`/api/datasets/${datasetId}/stories/analyze`);
}

export function getRecommendations(datasetId: string) {
  return apiClient.get<RecommendationsResponse>(
    `/api/datasets/${datasetId}/visualizations/recommendations`
  );
}
