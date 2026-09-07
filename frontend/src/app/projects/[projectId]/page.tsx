"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileUp } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PipelineStepper } from "@/components/layout/pipeline-stepper";
import { Button } from "@/components/ui/button";
import { EmptyState, ProcessingState, StatusPill } from "@/components/ui/states";
import { ApiError } from "@/lib/api/client";
import { listDatasets, uploadDatasetWithProgress, type Dataset } from "@/lib/api/datasets";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Dataset["status"], string> = {
  uploading: "Uploading",
  ingesting: "Processing",
  profiling: "Analyzing",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_TONE: Record<Dataset["status"], "pending" | "positive" | "negative"> = {
  uploading: "pending",
  ingesting: "pending",
  profiling: "pending",
  ready: "positive",
  failed: "negative",
};

const ACCEPTED_EXTENSIONS = [".csv", ".tsv", ".json", ".xlsx", ".xls"];

function fileKindChip(filename: string): { label: string; className: string } {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "csv" || ext === "tsv" || ext === "json") {
    return { label: ext.toUpperCase(), className: "bg-positive-bg text-positive-accent" };
  }
  return { label: ext === "xlsx" ? "XLS" : ext.toUpperCase() || "FILE", className: "bg-surface-muted text-subtle-foreground" };
}

export default function DatasetUploadPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const { data: datasets, isLoading } = useQuery({
    queryKey: ["datasets", projectId],
    queryFn: () => listDatasets(projectId),
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.status === "uploading" || d.status === "ingesting" || d.status === "profiling")
        ? 1500
        : false,
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

  function handleFile(file: File) {
    setUploadProgress(0);
    upload.mutate(file);
  }

  return (
    <AppShell>
      <PipelineStepper current="upload" projectId={projectId} />
      <section className="mx-auto flex max-w-[920px] flex-col px-7 py-14">
        <h1 className="mb-1.5 font-headline text-[28px] font-bold">Datasets</h1>
        <p className="mb-8 text-[14.5px] text-muted-foreground">
          Upload a file to profile, clean, and generate visualization recommendations.
        </p>

        <div className="mb-8">
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
          <motion.div
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
            animate={{
              borderColor: isDraggingOver ? "var(--accent)" : "var(--border-strong)",
              backgroundColor: isDraggingOver ? "var(--accent-muted)" : "var(--surface)",
            }}
            transition={{ duration: 0.15 }}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-3.5 rounded-[14px] border-[1.5px] border-dashed px-12 py-12 text-center",
              upload.isPending && "pointer-events-none opacity-70"
            )}
          >
            {upload.isPending ? (
              <div className="flex w-full max-w-xs flex-col gap-2">
                <p className="text-sm text-muted-foreground">Uploading… {uploadProgress}%</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-muted">
                  <FileUp aria-hidden className="h-5 w-5 text-accent" />
                </div>
                <p className="text-[15.5px] font-semibold">Drag a file here, or browse</p>
                <p className="text-[13px] text-subtle-foreground">
                  CSV, TSV, JSON, or Excel · up to 200MB
                </p>
                <Button
                  variant="accent"
                  size="sm"
                  className="mt-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Browse files
                </Button>
              </>
            )}
          </motion.div>
          {uploadError && (
            <p role="alert" className="mt-2 text-sm text-negative">
              {uploadError}
            </p>
          )}
        </div>

        <div className="mb-3 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-subtle-foreground">
          Recent uploads
        </div>

        {isLoading && <ProcessingState label="Loading datasets…" />}
        {datasets && datasets.length === 0 && (
          <EmptyState
            title="No datasets yet"
            description="Upload a CSV, TSV, JSON, or Excel file to get started."
          />
        )}
        {datasets && datasets.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {datasets.map((dataset) => {
              const chip = fileKindChip(dataset.original_filename);
              return (
                <motion.li
                  key={dataset.id}
                  whileHover={{ x: 2 }}
                  className={cn(
                    "flex items-center justify-between rounded-[10px] border border-border bg-surface px-[18px] py-4",
                    dataset.status !== "ready" && dataset.status !== "failed" && "opacity-75"
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={cn(
                        "flex h-[34px] w-[34px] items-center justify-center rounded-lg font-mono text-[11px] font-semibold",
                        chip.className
                      )}
                    >
                      {chip.label}
                    </div>
                    <div>
                      {dataset.status === "ready" ? (
                        <Link
                          href={`/datasets/${dataset.id}`}
                          aria-label={`Open dataset ${dataset.original_filename}`}
                          className="font-mono text-[14.5px] font-semibold hover:underline"
                        >
                          {dataset.original_filename}
                        </Link>
                      ) : (
                        <span className="font-mono text-[14.5px] font-semibold">
                          {dataset.original_filename}
                        </span>
                      )}
                      <p className="text-[12.5px] text-subtle-foreground">
                        {(dataset.size_bytes / (1024 * 1024)).toFixed(1)} MB · uploaded{" "}
                        {relativeTime(dataset.created_at)}
                      </p>
                      {dataset.status === "failed" && dataset.error_message && (
                        <p role="alert" className="text-xs text-negative">
                          {dataset.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                  <StatusPill
                    label={
                      dataset.status === "ready" || dataset.status === "failed"
                        ? STATUS_LABEL[dataset.status]
                        : `${STATUS_LABEL[dataset.status]}…`
                    }
                    tone={STATUS_TONE[dataset.status]}
                  />
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
