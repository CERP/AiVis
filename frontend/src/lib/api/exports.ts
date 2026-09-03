import { apiClient } from "@/lib/api/client";

export interface ExportRecord {
  id: string;
  visualization_version_id: string;
  format: "svg" | "png" | "pdf" | "json";
  status: "pending" | "processing" | "ready" | "failed";
  download_url: string | null;
  error_message: string | null;
  created_at: string;
}

export function createExport(
  visualizationVersionId: string,
  format: "svg" | "png" | "json",
  file: Blob,
  filename: string
) {
  const form = new FormData();
  form.append("file", file, filename);
  return apiClient.postForm<ExportRecord>(
    `/api/exports?visualization_version_id=${visualizationVersionId}&format=${format}`,
    form
  );
}
