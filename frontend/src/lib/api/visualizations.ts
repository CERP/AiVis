import { apiClient } from "@/lib/api/client";
import type { VisualizationSpec } from "@/lib/visualization/spec";

export interface Visualization {
  id: string;
  project_id: string;
  dataset_id: string;
  dataset_version_id: string;
  story_id: string | null;
  title: string;
  current_version_id: string | null;
}

export interface VisualizationVersion {
  id: string;
  visualization_id: string;
  version_number: number;
  spec: VisualizationSpec;
  change_summary: string | null;
  created_by: string;
}

export interface VisualizationCommand {
  type:
    | "change_chart_type"
    | "change_field"
    | "change_aggregation"
    | "change_theme"
    | "add_annotation"
    | "remove_annotation"
    | "filter_data"
    | "change_sort"
    | "change_layout";
  params: Record<string, unknown>;
}

export function createVisualization(
  projectId: string,
  payload: { title: string; story_id?: string | null; spec: VisualizationSpec }
) {
  return apiClient.post<Visualization>(
    `/api/visualizations?project_id=${projectId}`,
    payload
  );
}

export function getVisualization(id: string) {
  return apiClient.get<Visualization>(`/api/visualizations/${id}`);
}

export function listVersions(id: string) {
  return apiClient.get<VisualizationVersion[]>(`/api/visualizations/${id}/versions`);
}

export function applyCommand(id: string, command: VisualizationCommand) {
  return apiClient.patch<VisualizationVersion>(`/api/visualizations/${id}`, { command });
}
