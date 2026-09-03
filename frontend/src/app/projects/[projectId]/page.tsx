"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, ProcessingState, StatusPill } from "@/components/ui/states";
import { Headline } from "@/components/ui/typography";
import { ApiError } from "@/lib/api/client";
import { listDatasets, uploadDatasetWithProgress, type Dataset } from "@/lib/api/datasets";
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

export default function ProjectDetailPage() {
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
      <section className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
        <Headline as="h1" className="text-3xl">
          Datasets
        </Headline>

        <div>
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
              backgroundColor: isDraggingOver ? "var(--accent-muted)" : "transparent",
            }}
            transition={{ duration: 0.15 }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-token)] border-2 border-dashed px-8 py-10 text-center",
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
                <p className="text-sm font-medium">Drag a file here, or click to browse</p>
                <p className="text-xs text-muted-foreground">
                  CSV, TSV, JSON, or Excel — up to 200MB
                </p>
                {/* Decorative only -- the whole dropzone (outer div) is the real button;
                    a nested <button> here would be an invalid nested-interactive-control. */}
                <span
                  aria-hidden
                  className="mt-2 inline-flex h-10 items-center justify-center rounded-[var(--radius-token)] bg-accent px-4 text-sm font-medium text-accent-foreground"
                >
                  Upload a dataset
                </span>
              </>
            )}
          </motion.div>
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
              <motion.li
                key={dataset.id}
                whileHover={{ x: 2 }}
                className="flex items-center justify-between rounded-[var(--radius-token)] border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  {dataset.status === "ready" ? (
                    <Link
                      href={`/datasets/${dataset.id}`}
                      aria-label={`Open dataset ${dataset.original_filename}`}
                      className="font-medium hover:underline"
                    >
                      {dataset.original_filename}
                    </Link>
                  ) : (
                    <span className="font-medium">{dataset.original_filename}</span>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {(dataset.size_bytes / 1024).toFixed(1)} KB
                  </p>
                  {dataset.status === "failed" && dataset.error_message && (
                    <p role="alert" className="text-xs text-negative">
                      {dataset.error_message}
                    </p>
                  )}
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
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
