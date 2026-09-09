"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DatasetRow } from "@/components/projects/dataset-row";
import { VisualizationRow } from "@/components/projects/visualization-row";
import { Button } from "@/components/ui/button";
import { ErrorState, ProcessingState, Skeleton } from "@/components/ui/states";
import { apiClient, ApiError } from "@/lib/api/client";
import { listDatasets, uploadDatasetWithProgress, deleteDataset } from "@/lib/api/datasets";
import { listVisualizations } from "@/lib/api/visualizations";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
}

const ACCEPTED_EXTENSIONS = [".csv", ".tsv", ".json", ".xlsx", ".xls"];

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiClient.get<Project>(`/api/projects/${projectId}`),
  });

  const datasetsQuery = useQuery({
    queryKey: ["datasets", projectId],
    queryFn: () => listDatasets(projectId),
    refetchInterval: (query) =>
      query.state.data?.some(
        (d) => d.status === "uploading" || d.status === "ingesting" || d.status === "profiling"
      )
        ? 1500
        : false,
  });

  const visualizationsQuery = useQuery({
    queryKey: ["visualizations", projectId],
    queryFn: () => listVisualizations(projectId),
  });

  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadDatasetWithProgress(projectId, file, (percent) => setUploadProgress(percent)),
    onSuccess: () => {
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ["datasets", projectId] });
    },
    onError: (err) => {
      setUploadError(err instanceof ApiError ? err.detail : "Upload failed.");
    },
    onSettled: () => setUploadProgress(0),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDataset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets", projectId] });
    },
  });

  function handleFile(file: File) {
    setUploadProgress(0);
    upload.mutate(file);
  }

  const datasets = datasetsQuery.data;
  const visualizations = visualizationsQuery.data;
  const hasDatasets = !!datasets && datasets.length > 0;

  return (
    <AppShell>
      <section className="mx-auto max-w-[880px] px-5 py-10 sm:px-7 lg:py-12">
        <Breadcrumb
          className="mb-4"
          items={[
            { label: "Projects", href: "/projects" },
            { label: projectQuery.data?.name ?? "…" },
          ]}
        />
        <h1 className="mb-8 font-headline text-[22px] font-semibold tracking-tight">
          {projectQuery.data?.name ?? "Project"}
        </h1>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        <div className="mb-10">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="font-headline text-[15px] font-semibold">Datasets</h2>
            {hasDatasets && (
              <Button
                variant="outline"
                size="sm"
                disabled={upload.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus aria-hidden className="h-3.5 w-3.5" /> Upload dataset
              </Button>
            )}
          </div>

          {upload.isPending && (
            <div className="mb-3 flex flex-col gap-1.5 rounded-[var(--radius-token)] border border-border bg-surface p-3">
              <p className="text-[12.5px] text-muted-foreground">Uploading… {uploadProgress}%</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          {uploadError && (
            <p role="alert" className="mb-3 text-sm text-negative">
              {uploadError}
            </p>
          )}

          {datasetsQuery.isLoading && (
            <div className="flex flex-col gap-2.5">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-[52px] w-full" />
              ))}
            </div>
          )}
          {datasetsQuery.isError && (
            <ErrorState
              description="Couldn't load datasets."
              action={<Button onClick={() => datasetsQuery.refetch()}>Retry</Button>}
            />
          )}
          {!datasetsQuery.isLoading && !datasetsQuery.isError && !hasDatasets && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload a dataset by clicking or dragging a file here"
              onClick={() => !upload.isPending && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !upload.isPending) {
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2.5 rounded-[var(--radius-token)] border-[1.5px] border-dashed px-8 py-10 text-center transition-colors",
                isDraggingOver ? "border-accent bg-accent-muted" : "border-border-strong",
                upload.isPending && "pointer-events-none opacity-70"
              )}
            >
              <FileUp aria-hidden className="h-5 w-5 text-muted-foreground" />
              <p className="text-[14px] font-medium">Drag a file here, or browse</p>
              <p className="text-[12.5px] text-subtle-foreground">CSV, TSV, JSON, or Excel · up to 1GB</p>
            </div>
          )}
          {hasDatasets && (
            <ul>
              {datasets.map((dataset) => (
                <DatasetRow
                  key={dataset.id}
                  dataset={dataset}
                  deleteDisabled={deleteMutation.isPending}
                  onDelete={() => {
                    if (confirm(`Are you sure you want to delete ${dataset.original_filename}?`)) {
                      deleteMutation.mutate(dataset.id);
                    }
                  }}
                />
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-headline text-[15px] font-semibold">Visualizations</h2>

          {visualizationsQuery.isLoading && (
            <ProcessingState label="Loading visualizations…" />
          )}
          {visualizationsQuery.isError && (
            <ErrorState
              description="Couldn't load visualizations."
              action={<Button onClick={() => visualizationsQuery.refetch()}>Retry</Button>}
            />
          )}
          {visualizations && visualizations.length === 0 && (
            <p className="text-[13px] text-muted-foreground">
              Visualizations will appear here once you analyze a dataset.
            </p>
          )}
          {visualizations && visualizations.length > 0 && (
            <ul>
              {visualizations.map((visualization) => (
                <VisualizationRow key={visualization.id} visualization={visualization} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}
