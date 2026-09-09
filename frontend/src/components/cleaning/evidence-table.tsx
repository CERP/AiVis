interface EvidenceExample {
  before: unknown;
  after: unknown;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  return String(value);
}

/** Scoped to ONE column's before/after values from the workflow's existing preview sample --
 * never the full dataset, and never a fabricated total. The preview is capped server-side
 * (default 100 rows), so counts here are explicitly labeled "in preview," not claimed as the
 * dataset-wide affected count, which this API doesn't expose per step. */
export function EvidenceTable({
  examples,
  changedInPreview,
  previewSize,
  sharedWithOtherSteps,
}: {
  examples: EvidenceExample[];
  changedInPreview: number;
  previewSize: number;
  sharedWithOtherSteps?: boolean;
}) {
  const shown = examples.slice(0, 5);
  const remaining = changedInPreview - shown.length;

  if (changedInPreview === 0) {
    return (
      <p className="text-[12.5px] text-subtle-foreground">
        No changes visible in the current preview sample.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {shown.map((example, i) => (
        <p key={i} className="font-mono text-[12.5px] text-foreground">
          <span>{formatValue(example.before)}</span>{" "}
          <span aria-hidden className="text-subtle-foreground">
            →
          </span>{" "}
          <span>{formatValue(example.after)}</span>
        </p>
      ))}
      {remaining > 0 && (
        <p className="text-[12px] text-subtle-foreground">+{remaining} more in preview</p>
      )}
      <p className="mt-1 text-[11.5px] text-subtle-foreground">
        {changedInPreview} of {previewSize} previewed rows changed
        {sharedWithOtherSteps ? " (reflects all proposed changes to this column)" : ""}
      </p>
    </div>
  );
}
