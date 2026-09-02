import { apiClient } from "@/lib/api/client";

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

export function uploadDataset(projectId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiClient.postForm<Dataset>(`/api/datasets?project_id=${projectId}`, form);
}
