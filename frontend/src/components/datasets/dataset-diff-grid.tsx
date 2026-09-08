"use client";

import React, { useCallback, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Download, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ValidationWorkflowResponse, WorkflowAnomaly } from "@/lib/api/datasets";
import { downloadDataset } from "@/lib/api/datasets";

/** HTML collapses leading/trailing whitespace, so a value whose only difference from its cleaned
 * counterpart is padding renders identically on both sides -- which makes the change highlight
 * beside it look arbitrary ("  Hira Shah  " and "Hira Shah" both paint as `Hira Shah`). Render
 * the padding as visible middots so a trim step shows its evidence. */
function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="italic text-subtle-foreground">null</span>;
  }

  const text = String(value);
  if (text === text.trim()) return <>{text}</>;

  const leading = text.length - text.trimStart().length;
  // An all-whitespace value is entirely "leading"; counting it at both ends would double-render.
  const trailing = text.trim() === "" ? 0 : text.length - text.trimEnd().length;
  const padding = (count: number) =>
    count > 0 ? (
      <span
        title={`${count} whitespace character${count === 1 ? "" : "s"}`}
        className="text-warning/70"
      >
        {"·".repeat(count)}
      </span>
    ) : null;

  return (
    <>
      {padding(leading)}
      {text.slice(leading, text.length - trailing)}
      {padding(trailing)}
    </>
  );
}

interface DatasetDiffGridProps {
  datasetId: string;
  workflow: ValidationWorkflowResponse;
  onConfirm: (version: "raw" | "cleaned") => void;
}

export function DatasetDiffGrid({ datasetId, workflow, onConfirm }: DatasetDiffGridProps) {
  const { columns, before, after } = workflow;
  const [showModal, setShowModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<"raw" | "cleaned" | null>(null);

  const cleaningUnavailable = workflow.validation_errors.length > 0 || workflow.dataset_status === "unsuitable";

  const handleGenerateClick = (version: "raw" | "cleaned") => {
    setSelectedVersion(version);
    setShowModal(true);
  };

  const confirmGenerate = () => {
    if (selectedVersion) {
      onConfirm(selectedVersion);
    }
    setShowModal(false);
  };

  const getCellAnomaly = (columnName: string, rowIndex: number): WorkflowAnomaly | undefined => {
    return workflow.anomalies.find(
      (a) => a.column_name === columnName && a.row_index === rowIndex
    );
  };

  const cellChanged = (columnName: string, rowIndex: number) =>
    before.rows[rowIndex]?.[columnName] !== after.rows[rowIndex]?.[columnName];

  // Both panels show the same columns and rows, so a diff is only readable when the two stay
  // aligned -- scrolling one drives the other. `syncingFrom` breaks the feedback loop: setting
  // scrollLeft/scrollTop fires the peer's own scroll event, which would otherwise bounce back.
  const beforeScrollRef = useRef<HTMLDivElement>(null);
  const afterScrollRef = useRef<HTMLDivElement>(null);
  const syncingFrom = useRef<"before" | "after" | null>(null);

  const syncScroll = useCallback((source: "before" | "after") => {
    if (syncingFrom.current && syncingFrom.current !== source) return;

    const from = source === "before" ? beforeScrollRef.current : afterScrollRef.current;
    const to = source === "before" ? afterScrollRef.current : beforeScrollRef.current;
    if (!from || !to) return;
    if (to.scrollLeft === from.scrollLeft && to.scrollTop === from.scrollTop) return;

    syncingFrom.current = source;
    to.scrollLeft = from.scrollLeft;
    to.scrollTop = from.scrollTop;
    // Released on the next frame, after the peer's scroll event has been dispatched.
    requestAnimationFrame(() => {
      syncingFrom.current = null;
    });
  }, []);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm shadow-black/[0.03]">
        <div className="flex flex-col justify-between gap-5 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
              <Sparkles aria-hidden className="h-4 w-4" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline text-lg font-bold tracking-[-0.02em]">Gemini data audit</h2>
                <span className="rounded-md bg-accent-muted px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-accent-hover">
                  {workflow.dataset_status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Review Gemini&apos;s proposed changes before choosing which version to visualize.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:justify-end">
            <div className="text-right">
              <p className="font-headline text-2xl font-bold">{workflow.data_quality_score_before}</p>
              <p className="text-[10px] uppercase tracking-wide text-subtle-foreground">Before</p>
            </div>
            <ArrowRight aria-hidden className="h-4 w-4 text-subtle-foreground" />
            <div className="rounded-xl bg-positive-bg px-4 py-2 text-right">
              <p className="font-headline text-2xl font-bold text-positive">
                {workflow.data_quality_score_after ?? "—"}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-positive">After</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          {[
            [workflow.changed_cells, "Cells changed"],
            [workflow.changed_rows, "Rows affected"],
            [workflow.cleaning_recipe.length, "Recipe steps"],
            [workflow.remaining_issues.length, "Unresolved"],
          ].map(([value, label]) => (
            <div key={label} className="px-5 py-4">
              <p className="font-headline text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {(workflow.cleaning_summary.length > 0 || workflow.cleaning_recipe.length > 0) && (
          <div className="grid gap-5 border-t border-border bg-surface-muted/35 px-5 py-5 md:grid-cols-2 sm:px-6">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-subtle-foreground">Cleaning summary</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {workflow.cleaning_summary.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-subtle-foreground">Dynamic recipe</p>
              <div className="flex flex-wrap gap-2">
                {workflow.cleaning_recipe.map((step, idx) => (
                  <span key={idx} title={step.reason} className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium">
                    {step.column_name ? `${step.column_name} · ` : ""}{step.action_type.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {workflow.remaining_issues.length > 0 && (
          <div className="border-t border-warning/25 bg-warning/5 px-5 py-4 sm:px-6">
            <p className="mb-2 flex items-center gap-2 text-[12px] font-bold text-warning">
              <AlertTriangle aria-hidden className="h-4 w-4" /> Unresolved issues
            </p>
            {workflow.remaining_issues.map((issue, index) => (
              <p key={`${issue.column_name}-${issue.row_index}-${index}`} className="text-[13px] text-muted-foreground">
                {issue.column_name ? `${issue.column_name}: ` : ""}{issue.description}
              </p>
            ))}
          </div>
        )}
        {workflow.validation_errors.length > 0 && (
          <div role="alert" className="border-t border-negative/25 bg-negative/5 px-5 py-4 text-[13px] text-negative sm:px-6">
            The cleaned candidate was rejected by AiVis integrity checks: {workflow.validation_errors.join("; ")}
          </div>
        )}
      </div>

      {/* The two panels carry ~8 columns each, so they need more room than the page's reading
        * column. Breaking out to a viewport-centred width keeps them wider than the surrounding
        * prose without widening the rest of the page. Scoped to this grid on purpose: the
        * confirm modal below is `position: fixed`, and a transformed ancestor would make it
        * resolve against this element instead of the viewport. */}
      <div className="relative left-1/2 grid w-[min(100vw-2.5rem,1600px)] -translate-x-1/2 grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Before Column */}
        <div className="flex h-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm shadow-black/[0.03] sm:h-[460px] lg:h-[540px]">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h4 className="flex items-center gap-2 font-headline text-[16px] font-bold text-foreground">
                <AlertTriangle aria-hidden className="h-4 w-4 text-warning" />
                Original dataset
              </h4>
              <p className="text-[12px] text-muted-foreground">
                Contains {workflow.anomalies.length} identified data-quality issue{workflow.anomalies.length === 1 ? "" : "s"}
              </p>
            </div>
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-xs font-semibold hover:bg-surface-muted">
                <Download aria-hidden className="h-3.5 w-3.5" /> Download
              </summary>
              <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-border bg-surface py-1 shadow-lg">
                <button
                  onClick={() => void downloadDataset(datasetId, "raw", "csv")}
                  className="w-full text-left px-4 py-2 text-[13px] hover:bg-secondary-bg text-foreground transition-colors"
                >
                  Download CSV
                </button>
                <button
                  onClick={() => void downloadDataset(datasetId, "raw", "xlsx")}
                  className="w-full text-left px-4 py-2 text-[13px] hover:bg-secondary-bg text-foreground transition-colors"
                >
                  Download XLSX
                </button>
              </div>
            </details>
          </div>

          <div
            ref={beforeScrollRef}
            onScroll={() => syncScroll("before")}
            className="flex-1 overflow-auto"
          >
            <table className="min-w-full divide-y divide-border border-collapse text-left">
              <thead className="sticky top-0 z-[2] bg-surface-muted">
                <tr>
                  {/* Opaque + above the body gutter: both this and the body's row-number cell are
                    * sticky, so a translucent background lets the horizontally-scrolled columns
                    * underneath bleed through (a row number of 1 over a value of 1 reads as "11"). */}
                  <th className="sticky left-0 z-[3] w-12 border-b border-border bg-surface-muted px-4 py-3 text-[12px] font-bold text-muted-foreground">#</th>
                  {columns.map((col) => (
                    <th key={col} className="px-4 py-3 text-[12px] font-bold text-muted-foreground border-b border-border">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {before.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-secondary-bg/30">
                    <td className="sticky left-0 z-[1] border-r border-border bg-secondary-bg px-4 py-2.5 font-mono text-[12px] text-subtle-foreground">
                      {rIdx + 1}
                    </td>
                    {columns.map((col) => {
                      const val = row[col];
                      const anomaly = getCellAnomaly(col, rIdx);
                      return (
                        <td
                          key={col}
                          title={anomaly ? `${anomaly.issue_type}: ${anomaly.description}` : undefined}
                          className={`max-w-[180px] truncate px-4 py-2.5 text-[13px] transition-colors ${
                            anomaly
                              ? "bg-warning/10 font-medium text-foreground ring-1 ring-inset ring-warning/25"
                              : "text-foreground"
                          }`}
                        >
                          <CellValue value={val} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border bg-surface-muted/40 px-5 py-4">
            <span className="text-xs text-muted-foreground">May include identified quality issues</span>
            <Button
              variant="outline"
              onClick={() => handleGenerateClick("raw")}
              className="h-9 px-4 text-[13px] font-semibold"
            >
              Make Graphs
            </Button>
          </div>
        </div>

        {/* After Column */}
        <div className="flex h-[380px] flex-col overflow-hidden rounded-2xl border border-accent/25 bg-surface shadow-sm shadow-accent/5 sm:h-[460px] lg:h-[540px]">
          <div className="flex items-center justify-between border-b border-accent/15 bg-accent-muted/35 px-5 py-4">
            <div>
              <h4 className="flex items-center gap-2 font-headline text-[16px] font-bold text-foreground">
                <Sparkles aria-hidden className="h-4 w-4 text-accent" />
                Gemini-cleaned
              </h4>
              <p className="text-[12px] text-muted-foreground">
                Preview of recommended clean state
              </p>
            </div>
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 py-2 text-xs font-semibold hover:bg-surface-muted">
                <Download aria-hidden className="h-3.5 w-3.5" /> Download
              </summary>
              <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-border bg-surface py-1 shadow-lg">
                <button
                  disabled={cleaningUnavailable}
                  onClick={() => void downloadDataset(datasetId, "cleaned", "csv", workflow.audit_id)}
                  className="w-full text-left px-4 py-2 text-[13px] hover:bg-secondary-bg text-foreground transition-colors"
                >
                  Download CSV
                </button>
                <button
                  disabled={cleaningUnavailable}
                  onClick={() => void downloadDataset(datasetId, "cleaned", "xlsx", workflow.audit_id)}
                  className="w-full text-left px-4 py-2 text-[13px] hover:bg-secondary-bg text-foreground transition-colors"
                >
                  Download XLSX
                </button>
              </div>
            </details>
          </div>

          <div
            ref={afterScrollRef}
            onScroll={() => syncScroll("after")}
            className="flex-1 overflow-auto"
          >
            <table className="min-w-full divide-y divide-border border-collapse text-left">
              <thead className="sticky top-0 z-[2] bg-accent-muted">
                <tr>
                  <th className="sticky left-0 z-[3] w-12 border-b border-border bg-accent-muted px-4 py-3 text-[12px] font-bold text-muted-foreground">#</th>
                  {columns.map((col) => (
                    <th key={col} className="px-4 py-3 text-[12px] font-bold text-muted-foreground border-b border-border">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {after.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-secondary-bg/30">
                    <td className="sticky left-0 z-[1] border-r border-border bg-secondary-bg px-4 py-2.5 font-mono text-[12px] text-subtle-foreground">
                      {rIdx + 1}
                    </td>
                    {columns.map((col) => {
                      const val = row[col];
                      return (
                        <td
                          key={col}
                          className={`max-w-[180px] truncate px-4 py-2.5 text-[13px] text-foreground ${cellChanged(col, rIdx) ? "bg-positive-bg font-medium text-positive ring-1 ring-inset ring-positive-accent/20" : ""}`}
                        >
                          <CellValue value={val} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-accent/15 bg-accent-muted/25 px-5 py-4">
            {/* Only claim the candidate passed when it actually did -- this sits next to a
              * disabled button, so a hardcoded pass badge states the opposite of why it's off. */}
            {cleaningUnavailable ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-warning">
                <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0" />
                {workflow.dataset_status === "unsuitable"
                  ? "Dataset is unsuitable for cleaning"
                  : "Rejected by integrity checks — can't be used"}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-positive">
                <ShieldCheck aria-hidden className="h-3.5 w-3.5 shrink-0" /> Integrity checked
              </span>
            )}
            <Button
              disabled={cleaningUnavailable}
              title={
                cleaningUnavailable
                  ? "The cleaned candidate failed AiVis integrity checks, so it can't be used. Continue with the original dataset instead."
                  : undefined
              }
              onClick={() => handleGenerateClick("cleaned")}
              variant="accent"
              className="h-9 shrink-0 px-4 text-[13px] font-semibold"
            >
              Make Graphs
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="version-dialog-title" className="w-full max-w-md animate-in rounded-2xl border border-border bg-surface p-6 shadow-2xl duration-200 fade-in zoom-in">
            <h3 id="version-dialog-title" className="mb-3 text-[18px] font-bold text-foreground">
              Confirm dataset version
            </h3>
            <p className="text-[14.5px] text-muted-foreground mb-6 leading-relaxed">
              {selectedVersion === "cleaned"
                ? "You are about to generate visualizations using Gemini's cleaned dataset. The validated recipe will be saved as a new version before analysis."
                : "You are about to generate visualizations using the original dataset, which contains identified data-quality issues."}
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
                className="text-[13.5px] font-medium"
              >
                Cancel
              </Button>
              <Button
                variant={selectedVersion === "cleaned" ? "accent" : "outline"}
                onClick={confirmGenerate}
                className="text-[13.5px] font-semibold"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
