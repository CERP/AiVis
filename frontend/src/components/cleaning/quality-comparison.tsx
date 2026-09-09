/** Typography-driven before/after, not a chart or gauge -- per the design system, Cleaning
 * stays evidence-first rather than becoming another visualization. `afterCaveat` exists because
 * the backend's "after" score reflects the FULL proposed recipe; once a user deselects any step,
 * showing that number as a guaranteed outcome would be dishonest (see Batch 5 quality-score
 * handling notes) -- callers pass a caveat string instead of silently keeping the bare number. */
export function QualityComparison({
  before,
  after,
  afterCaveat,
}: {
  before: number;
  after: number | null;
  afterCaveat?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle-foreground">
        Quality
      </p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-[20px] font-semibold text-muted-foreground">{before}</span>
        <span aria-hidden className="text-subtle-foreground">
          →
        </span>
        <span className="text-[26px] font-semibold text-positive">{after ?? "—"}</span>
      </p>
      {afterCaveat && <p className="mt-1 text-[12px] text-subtle-foreground">{afterCaveat}</p>}
    </div>
  );
}
