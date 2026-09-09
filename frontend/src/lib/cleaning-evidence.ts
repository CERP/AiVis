import type { ValidationWorkflowResponse, WorkflowCleaningStep } from "@/lib/api/datasets";
import type { OperationEvidence } from "@/components/cleaning/operation-row";

/** Diffs the workflow's existing before/after preview sample for one step's column -- this is
 * the FULL recipe's before/after, so when two steps share a column the diff reflects both
 * combined, not just this one step in isolation (flagged via `sharedWithOtherSteps` rather than
 * silently misattributed). No new data is fetched or invented; this only reads what
 * GET /validation-workflow already returned. */
export function computeEvidence(
  workflow: ValidationWorkflowResponse,
  step: WorkflowCleaningStep,
  allSteps: WorkflowCleaningStep[]
): OperationEvidence {
  const previewSize = workflow.before.rows.length;
  if (!step.column_name) {
    return { examples: [], changedInPreview: 0, previewSize, sharedWithOtherSteps: false };
  }
  const col = step.column_name;
  const sharedWithOtherSteps = allSteps.filter((s) => s.column_name === col).length > 1;
  const examples: { before: unknown; after: unknown }[] = [];
  let changedInPreview = 0;

  for (let i = 0; i < previewSize; i++) {
    const before = workflow.before.rows[i]?.[col];
    const after = workflow.after.rows[i]?.[col];
    if (before !== after) {
      changedInPreview += 1;
      if (examples.length < 5) examples.push({ before, after });
    }
  }

  return { examples, changedInPreview, previewSize, sharedWithOtherSteps };
}
