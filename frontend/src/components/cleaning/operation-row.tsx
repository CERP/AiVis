"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { EvidenceTable } from "@/components/cleaning/evidence-table";
import type { WorkflowCleaningStep } from "@/lib/api/datasets";
import { operationMethod, operationTitle } from "@/lib/cleaning-descriptions";

export interface OperationEvidence {
  examples: { before: unknown; after: unknown }[];
  changedInPreview: number;
  previewSize: number;
  sharedWithOtherSteps: boolean;
}

/** Selection is per transformation step, never per row/value -- checking this box means "apply
 * this whole operation," not "apply it to some of the values it touches." */
export function OperationRow({
  step,
  selected,
  onToggle,
  evidence,
}: {
  step: WorkflowCleaningStep;
  selected: boolean;
  onToggle: () => void;
  evidence: OperationEvidence;
}) {
  const [expanded, setExpanded] = useState(false);
  const title = operationTitle(step);

  return (
    <li className="border-b border-border py-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Include: ${title}`}
          className="mt-0.5 h-4 w-4 shrink-0 rounded-[var(--radius-sm-token)] border-border-strong text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex flex-1 items-start justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1"
        >
          <span className={selected ? "min-w-0" : "min-w-0 text-muted-foreground"}>
            <span className="block text-[14px] font-semibold text-foreground">{title}</span>
            <span className="block text-[12.5px] text-subtle-foreground">
              {evidence.changedInPreview} of {evidence.previewSize} previewed rows affected
              {step.column_name ? ` · ${step.column_name}` : ""}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {expanded && (
        <div className="ml-7 mt-3 flex flex-col gap-3 border-l border-border pl-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-subtle-foreground">
              Why this change?
            </p>
            <p className="mt-0.5 text-[13px] text-foreground">{step.reason}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-subtle-foreground">
              Method
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{operationMethod(step)}</p>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-subtle-foreground">
              Evidence
            </p>
            <EvidenceTable
              examples={evidence.examples}
              changedInPreview={evidence.changedInPreview}
              previewSize={evidence.previewSize}
              sharedWithOtherSteps={evidence.sharedWithOtherSteps}
            />
          </div>
        </div>
      )}
    </li>
  );
}
