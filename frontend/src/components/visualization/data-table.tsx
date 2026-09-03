"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";

const PAGE_SIZE = 25;

interface DataTableProps {
  rows: Record<string, unknown>[];
  title?: string | null;
}

/** Real client-side sort/pagination over actual row data -- no virtualization yet (fine at the
 * row counts this app currently handles via GET /rows' server-side cap; flagged as a follow-up
 * for genuinely large datasets, not silently pretended to scale). */
export function DataTable({ rows, title }: DataTableProps) {
  const columns = useMemo(() => (rows.length > 0 ? Object.keys(rows[0]) : []), [rows]);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDescending, setSortDescending] = useState(false);
  const [page, setPage] = useState(0);

  const sortedRows = useMemo(() => {
    if (!sortColumn) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortColumn];
      const bv = b[sortColumn];
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av ?? "").localeCompare(String(bv ?? ""));
    });
    if (sortDescending) copy.reverse();
    return copy;
  }, [rows, sortColumn, sortDescending]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const pageRows = sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(column: string) {
    if (sortColumn === column) {
      setSortDescending((d) => !d);
    } else {
      setSortColumn(column);
      setSortDescending(false);
    }
    setPage(0);
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No rows to display.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {title && <p className="text-sm font-medium">{title}</p>}
      <div className="overflow-x-auto rounded-[var(--radius-token)] border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted">
            <tr>
              {columns.map((col) => (
                <th key={col} scope="col" className="p-0">
                  <button
                    type="button"
                    onClick={() => toggleSort(col)}
                    aria-label={`Sort by ${col}`}
                    className="flex w-full items-center gap-1 px-3 py-2 text-left font-medium hover:bg-surface"
                  >
                    {col}
                    {sortColumn === col ? (
                      sortDescending ? (
                        <ArrowDown aria-hidden className="h-3 w-3" />
                      ) : (
                        <ArrowUp aria-hidden className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown aria-hidden className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="border-t border-border">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-2">
                    {String(row[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page + 1} of {totalPages} ({sortedRows.length} rows)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-[var(--radius-token)] border border-border-strong px-2 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-[var(--radius-token)] border border-border-strong px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
