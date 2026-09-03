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

export function getDatasetRows(datasetId: string, limit = 500) {
  return apiClient.get<DatasetRows>(`/api/datasets/${datasetId}/rows?limit=${limit}`);
}
