"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadDataset } from "@/lib/api/datasets";
import type { ValidationWorkflowResponse, WorkflowAnomaly } from "@/lib/api/datasets";

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

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 rounded-xl p-5">
        <h3 className="text-[16px] font-bold text-yellow-800 dark:text-yellow-400 mb-2">
          Gemini dataset audit · {workflow.dataset_status.replaceAll("_", " ")}
        </h3>
        <p className="text-[14px] text-yellow-700 dark:text-yellow-300 mb-3">
          Quality score {workflow.data_quality_score_before} → {workflow.data_quality_score_after ?? "—"}. Gemini proposed {workflow.cleaning_recipe.length} cleaning step{workflow.cleaning_recipe.length === 1 ? "" : "s"}, changing {workflow.changed_cells} cells across {workflow.changed_rows} rows.
        </p>
        {workflow.cleaning_summary.length > 0 && (
          <ul className="mb-3 list-disc pl-5 text-[13px] text-yellow-800 dark:text-yellow-300">
            {workflow.cleaning_summary.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {workflow.cleaning_recipe.map((p, idx) => (
            <span
              key={idx}
              className="text-[11px] font-semibold bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 px-2.5 py-1 rounded-full border border-yellow-200 dark:border-yellow-800"
            >
              {p.column_name ? `${p.column_name}: ` : ""}{p.action_type.replaceAll("_", " ")}
            </span>
          ))}
        </div>
        {workflow.remaining_issues.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-white/60 p-3 dark:bg-black/10">
            <p className="mb-1 text-[12px] font-bold uppercase tracking-wide">Unresolved issues</p>
            {workflow.remaining_issues.map((issue, index) => (
              <p key={`${issue.column_name}-${issue.row_index}-${index}`} className="text-[13px]">
                {issue.column_name ? `${issue.column_name}: ` : ""}{issue.description}
              </p>
            ))}
          </div>
        )}
        {workflow.validation_errors.length > 0 && (
          <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-[13px] text-destructive">
            The cleaned candidate was rejected by AiVis integrity checks: {workflow.validation_errors.join("; ")}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Before Column */}
        <div className="flex flex-col border border-border bg-surface rounded-xl p-5 h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-[16px] text-foreground flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                Before (Raw Data)
              </h4>
              <p className="text-[12px] text-muted-foreground">
                Contains {workflow.anomalies.length} identified data-quality issue{workflow.anomalies.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="relative group">
              <button className="text-[13px] bg-secondary-bg hover:bg-secondary-bg/80 border border-border text-foreground px-3 py-1.5 rounded-lg font-medium inline-flex items-center gap-1 transition-colors">
                Export Raw ▾
              </button>
              <div className="absolute right-0 mt-1 hidden group-hover:block bg-surface border border-border rounded-lg shadow-lg py-1 w-32 z-10">
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
            </div>
          </div>

          <div className="flex-1 overflow-auto border border-border rounded-lg max-h-[350px]">
            <table className="min-w-full divide-y divide-border border-collapse text-left">
              <thead className="bg-secondary-bg sticky top-0 z-[1]">
                <tr>
                  <th className="px-4 py-3 text-[12px] font-bold text-muted-foreground w-12 border-b border-border">#</th>
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
                    <td className="px-4 py-2.5 text-[12px] text-subtle-foreground font-mono bg-secondary-bg/50 border-r border-border sticky left-0">
                      {rIdx + 1}
                    </td>
                    {columns.map((col) => {
                      const val = row[col];
                      const anomaly = getCellAnomaly(col, rIdx);
                      return (
                        <td
                          key={col}
                          title={anomaly ? `${anomaly.issue_type}: ${anomaly.description}` : undefined}
                          className={`px-4 py-2.5 text-[13px] transition-colors truncate max-w-[180px] ${
                            anomaly
                              ? "bg-destructive/15 text-destructive border-2 border-destructive/30 font-medium"
                              : "text-foreground"
                          }`}
                        >
                          {val !== null && val !== undefined ? String(val) : <span className="text-subtle-foreground italic">null</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 self-start">
            <Button
              variant="outline"
              onClick={() => handleGenerateClick("raw")}
              className="text-[13.5px] h-10 px-5 font-semibold"
            >
              Make Graphs
            </Button>
          </div>
        </div>

        {/* After Column */}
        <div className="flex flex-col border border-border bg-surface rounded-xl p-5 h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-[16px] text-foreground flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                After (Gemini-cleaned)
              </h4>
              <p className="text-[12px] text-muted-foreground">
                Preview of recommended clean state
              </p>
            </div>
            <div className="relative group">
              <button className="text-[13px] bg-secondary-bg hover:bg-secondary-bg/80 border border-border text-foreground px-3 py-1.5 rounded-lg font-medium inline-flex items-center gap-1 transition-colors">
                Export Cleaned ▾
              </button>
              <div className="absolute right-0 mt-1 hidden group-hover:block bg-surface border border-border rounded-lg shadow-lg py-1 w-32 z-10">
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
            </div>
          </div>

          <div className="flex-1 overflow-auto border border-border rounded-lg max-h-[350px]">
            <table className="min-w-full divide-y divide-border border-collapse text-left">
              <thead className="bg-secondary-bg sticky top-0 z-[1]">
                <tr>
                  <th className="px-4 py-3 text-[12px] font-bold text-muted-foreground w-12 border-b border-border">#</th>
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
                    <td className="px-4 py-2.5 text-[12px] text-subtle-foreground font-mono bg-secondary-bg/50 border-r border-border sticky left-0">
                      {rIdx + 1}
                    </td>
                    {columns.map((col) => {
                      const val = row[col];
                      return (
                        <td
                          key={col}
                          className="px-4 py-2.5 text-[13px] text-foreground truncate max-w-[180px]"
                        >
                          {val !== null && val !== undefined ? String(val) : <span className="text-subtle-foreground italic">null</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 self-start">
            <Button
              variant="default"
              disabled={cleaningUnavailable}
              onClick={() => handleGenerateClick("cleaned")}
              className="text-[13.5px] h-10 px-5 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Make Graphs
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-xl shadow-2xl p-6 max-w-md w-full animate-in fade-in zoom-in duration-200">
            <h3 className="text-[18px] font-bold text-foreground mb-3">
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
                variant={selectedVersion === "cleaned" ? "default" : "outline"}
                onClick={confirmGenerate}
                className={`text-[13.5px] font-semibold ${
                  selectedVersion === "cleaned" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : ""
                }`}
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
