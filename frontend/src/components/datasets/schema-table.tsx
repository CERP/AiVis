import type { ColumnProfile } from "@/lib/api/insights";

function typeLabel(column: ColumnProfile): string {
  const type = column.semantic_type ?? column.raw_type;
  if (type === "categorical" || type === "text") return "CAT";
  if (type === "numeric" || type === "currency") return "NUM";
  if (type === "date") return "DATE";
  return type ? type.slice(0, 4).toUpperCase() : "COL";
}

/** The dominant content on Dataset Overview -- real table semantics (not a div grid) so
 * screen readers get row/column structure, plain-mono type labels instead of colored chips
 * (type is metadata, not a status), and no zebra striping or sticky header: this batch keeps
 * exactly one sticky bar (StageTabs) below the app shell rather than stacking a third. */
export function SchemaTable({ columns }: { columns: ColumnProfile[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle-foreground">
            <th scope="col" className="py-2.5 pr-4 font-semibold">
              Column
            </th>
            <th scope="col" className="py-2.5 pr-4 font-semibold">
              Type
            </th>
            <th scope="col" className="py-2.5 pr-4 text-right font-semibold">
              Nulls
            </th>
            <th scope="col" className="py-2.5 pr-4 text-right font-semibold">
              Unique
            </th>
            <th scope="col" className="py-2.5 font-semibold">
              Privacy
            </th>
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={column.id} className="border-b border-border last:border-b-0 hover:bg-surface-muted">
              <td className="max-w-[280px] truncate py-2.5 pr-4 font-mono text-[13.5px] font-medium text-foreground">
                {column.name}
              </td>
              <td className="py-2.5 pr-4 font-mono text-[12px] text-muted-foreground">
                {typeLabel(column)}
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-[13px] text-muted-foreground">
                {column.null_count.toLocaleString()}
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-[13px] text-muted-foreground">
                {column.unique_count.toLocaleString()}
              </td>
              <td
                className={
                  column.is_pii
                    ? "py-2.5 text-[12.5px] font-medium text-warning"
                    : "py-2.5 text-[12.5px] text-subtle-foreground"
                }
              >
                {column.is_pii ? "Protected" : "Standard"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
