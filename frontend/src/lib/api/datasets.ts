import { apiClient, ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Dataset {
  id: string;
  project_id: string;
  name: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  status: "uploading" | "ingesting" | "profiling" | "ready" | "failed";
  error_message: string | null;
  created_at: string;
}

export function listDatasets(projectId: string) {
  return apiClient.get<Dataset[]>(`/api/datasets?project_id=${projectId}`);
}

export function getDataset(datasetId: string) {
  return apiClient.get<Dataset>(`/api/datasets/${datasetId}`);
}

export function uploadDataset(projectId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiClient.postForm<Dataset>(`/api/datasets?project_id=${projectId}`, form);
}

/** fetch() has no upload-progress event, so real byte-level progress needs XMLHttpRequest --
 * used only here, the rest of the app keeps using the simpler fetch-based apiClient. */
export function uploadDatasetWithProgress(
  projectId: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<Dataset> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/api/datasets?project_id=${projectId}`);
    const token = useAuthStore.getState().token;
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as Dataset);
        return;
      }
      let detail = xhr.statusText;
      try {
        detail = JSON.parse(xhr.responseText).detail ?? detail;
      } catch {
        // response wasn't JSON -- keep statusText
      }
      reject(new ApiError(xhr.status, detail));
    };
    xhr.onerror = () => reject(new ApiError(0, "Network error during upload"));

    xhr.send(form);
  });
}

export interface DatasetRows {
  dataset_version_id: string;
  total_row_count: number;
  returned_row_count: number;
  rows: Record<string, unknown>[];
}

export function getDatasetRows(datasetId: string, limit = 500, versionId?: string) {
  const version = versionId ? `&version_id=${versionId}` : "";
  return apiClient.get<DatasetRows>(`/api/datasets/${datasetId}/rows?limit=${limit}${version}`);
}

export interface WorkflowAnomaly {
  column_name: string | null;
  row_index: number | null;
  value: unknown;
  issue_type: string;
  description: string;
}

export interface WorkflowPreview {
  rows: Record<string, unknown>[];
}

export interface WorkflowCleaningStep {
  column_name: string | null;
  action_type: string;
  reason: string;
  params: Record<string, unknown>;
}

export interface ValidationWorkflowResponse {
  audit_id: string;
  source_version_id: string;
  cleaned_version_id: string | null;
  workflow_status: "ready" | "validation_failed" | "applied";
  dataset_status: "healthy" | "usable_with_minor_issues" | "requires_cleaning" | "unsuitable";
  data_quality_score_before: number;
  data_quality_score_after: number | null;
  columns: string[];
  before: WorkflowPreview;
  after: WorkflowPreview;
  anomalies: WorkflowAnomaly[];
  remaining_issues: WorkflowAnomaly[];
  cleaning_recipe: WorkflowCleaningStep[];
  cleaning_summary: string[];
  changed_cells: number;
  changed_rows: number;
  removed_rows: number;
  validation_errors: string[];
}

export function getValidationWorkflow(datasetId: string, limit = 100) {
  return apiClient.get<ValidationWorkflowResponse>(`/api/datasets/${datasetId}/validation-workflow?limit=${limit}`);
}

export interface WorkflowSelectionResponse {
  dataset_version_id: string;
  version_number: number;
  selection: "original" | "cleaned";
  cleaned_version_created: boolean;
  analysis_status: "queued";
}

export function applyValidationWorkflow(
  datasetId: string,
  auditId: string,
  selection: "original" | "cleaned"
) {
  return apiClient.post<WorkflowSelectionResponse>(
    `/api/datasets/${datasetId}/validation-workflow/apply`,
    { audit_id: auditId, selection }
  );
}

export async function downloadDataset(
  datasetId: string,
  version: "raw" | "cleaned",
  format: "csv" | "xlsx",
  auditId?: string
) {
  const token = useAuthStore.getState().token;
  const response = await fetch(
    `${API_BASE_URL}/api/datasets/${datasetId}/export/${version}/${format}${auditId ? `?audit_id=${auditId}` : ""}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
  );
  if (!response.ok) throw new ApiError(response.status, "Dataset download failed");
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename = disposition.match(/filename=([^;]+)/)?.[1] ?? `dataset-${version}.${format}`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.replaceAll('"', "");
  anchor.click();
  URL.revokeObjectURL(url);
}

export function deleteDataset(datasetId: string) {
  return apiClient.delete<void>(`/api/datasets/${datasetId}`);
}
