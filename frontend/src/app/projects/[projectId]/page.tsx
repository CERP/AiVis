"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState, ProcessingState } from "@/components/ui/states";
import { Headline } from "@/components/ui/typography";
import { ApiError } from "@/lib/api/client";
import { listDatasets, uploadDataset, type Dataset } from "@/lib/api/datasets";

const STATUS_LABEL: Record<Dataset["status"], string> = {
  uploading: "Uploading",
  ingesting: "Processing",
  profiling: "Analyzing",
  ready: "Ready",
  failed: "Failed",
};

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: datasets, isLoading } = useQuery({
    queryKey: ["datasets", projectId],
    queryFn: () => listDatasets(projectId),
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.status === "uploading" || d.status === "ingesting" || d.status === "profiling")
        ? 1500
        : false,
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadDataset(projectId, file),
    onSuccess: () => {
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ["datasets", projectId] });
    },
    onError: (err) => {
      setUploadError(err instanceof ApiError ? err.detail : "Upload failed.");
    },
  });

  return (
    <AppShell>
      <section className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
        <Headline as="h1" className="text-3xl">
          Datasets
        </Headline>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.json,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="accent"
            onClick={() => fileInputRef.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? "Uploading…" : "Upload a dataset"}
          </Button>
          {uploadError && (
            <p role="alert" className="mt-2 text-sm text-negative">
              {uploadError}
            </p>
          )}
        </div>

        {isLoading && <ProcessingState label="Loading datasets…" />}
        {datasets && datasets.length === 0 && (
          <EmptyState
            title="No datasets yet"
            description="Upload a CSV, TSV, JSON, or Excel file to get started."
          />
        )}
        {datasets && datasets.length > 0 && (
          <ul className="flex flex-col gap-2">
            {datasets.map((dataset) => (
              <li
                key={dataset.id}
                className="flex items-center justify-between rounded-[var(--radius-token)] border border-border p-4"
              >
                <div>
                  {dataset.status === "ready" ? (
                    <Link href={`/datasets/${dataset.id}`} className="font-medium hover:underline">
                      {dataset.original_filename}
                    </Link>
                  ) : (
                    <span className="font-medium">{dataset.original_filename}</span>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {(dataset.size_bytes / 1024).toFixed(1)} KB
                  </p>
                </div>
                <StatusPill status={dataset.status} error={dataset.error_message} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

function StatusPill({ status, error }: { status: Dataset["status"]; error: string | null }) {
  if (status === "failed") {
    return (
      <span className="rounded-full bg-accent-muted px-2 py-0.5 text-xs text-negative" title={error ?? undefined}>
        Failed
      </span>
    );
  }
  if (status === "ready") {
    return (
      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-positive">Ready</span>
    );
  }
  return (
    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">
      {STATUS_LABEL[status]}…
    </span>
  );
}
