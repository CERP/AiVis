import { apiClient } from "@/lib/api/client";

export interface CleaningRequest {
  operation_type: string;
  column_name?: string | null;
  params?: Record<string, unknown>;
}

export interface CleaningResult {
  new_version_id: string;
  version_number: number;
  row_count: number;
  column_count: number;
  valid_count: number;
  invalid_count: number;
}

export function applyCleaning(datasetId: string, payload: CleaningRequest) {
  return apiClient.post<CleaningResult>(`/api/datasets/${datasetId}/clean`, payload);
}
