"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/states";
import type { Dataset } from "@/lib/api/datasets";
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

function fileKindChip(filename: string): { label: string; className: string } {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "csv" || ext === "tsv" || ext === "json") {
    return { label: ext.toUpperCase(), className: "bg-positive-bg text-positive-accent" };
  }
  return {
    label: ext === "xlsx" ? "XLS" : ext.toUpperCase() || "FILE",
    className: "bg-surface-muted text-subtle-foreground",
  };
}

/** No quality/data-quality label here on purpose -- the datasets list endpoint doesn't carry
 * that cheaply, and fetching it per row would mean one extra request per dataset on a page
 * that's meant to be a fast-loading hub, not a detail view. */
export function DatasetRow({
  dataset,
  onDelete,
  deleteDisabled,
}: {
  dataset: Dataset;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  const chip = fileKindChip(dataset.original_filename);
  const isOpenable = dataset.status === "ready";

  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border px-1 py-3.5 last:border-b-0 hover:bg-surface-muted",
        !isOpenable && dataset.status !== "failed" && "opacity-75"
      )}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm-token)] font-mono text-[11px] font-semibold",
            chip.className
          )}
        >
          {chip.label}
        </span>
        <div className="min-w-0">
          {isOpenable ? (
            <Link
              href={`/datasets/${dataset.id}`}
              aria-label={`Open dataset ${dataset.original_filename}`}
              className="block truncate font-mono text-[13.5px] font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1"
            >
              {dataset.original_filename}
            </Link>
          ) : (
            <span className="block truncate font-mono text-[13.5px] font-semibold text-foreground">
              {dataset.original_filename}
            </span>
          )}
          <p className="text-[12px] text-subtle-foreground">
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
      <div className="flex shrink-0 items-center gap-2">
        <StatusPill
          label={isOpenable || dataset.status === "failed" ? STATUS_LABEL[dataset.status] : `${STATUS_LABEL[dataset.status]}…`}
          tone={STATUS_TONE[dataset.status]}
        />
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Delete ${dataset.original_filename}`}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-negative"
          disabled={deleteDisabled}
          onClick={onDelete}
        >
          <Trash2 aria-hidden className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
