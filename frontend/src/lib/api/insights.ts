import { apiClient } from "@/lib/api/client";

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

export function getProfile(datasetId: string) {
  return apiClient.get<DatasetProfile>(`/api/datasets/${datasetId}/profile`);
}
