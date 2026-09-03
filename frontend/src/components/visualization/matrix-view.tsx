"use client";

import { useMemo, useState } from "react";

import type { Aggregation } from "@/lib/visualization/spec";
import { pivot } from "@/lib/visualization/d3-data";

type SupportedAggregation = "sum" | "mean" | "count" | "min" | "max" | "median";

function toSupported(aggregation: Aggregation | undefined): SupportedAggregation {
  return aggregation && aggregation !== "none" ? aggregation : "sum";
}

interface MatrixViewProps {
  rows: Record<string, unknown>[];
  rowField: string;
  columnField: string;
  valueField: string;
  aggregation?: Aggregation;
  title?: string | null;
}

/**
 * Matrix: a real cross-tabulation with row/column subtotals and a grand total, distinct from the
 * heatmap (which colours pre-shaped rows without pivoting). The pivot itself lives in
 * `lib/visualization/d3-data.ts::pivot` so the aggregation maths is unit-tested independently of
 * rendering; mean subtotals are recomputed from the underlying values rather than averaging cell
 * averages, which would be wrong whenever cell counts differ.
 *
 * Conditional formatting shades each cell by its share of the largest cell, giving the matrix a
 * heatmap-like scan path without changing the numbers.
 */
export function MatrixView({
  rows,
  rowField,
  columnField,
  valueField,
  aggregation,
  title,
}: MatrixViewProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [descending, setDescending] = useState(true);
  const agg = toSupported(aggregation);

  const result = useMemo(
    () => pivot(rows, rowField, columnField, valueField, agg),
    [rows, rowField, columnField, valueField, agg]
  );

  const orderedRowKeys = useMemo(() => {
    const keys = [...result.rowKeys];
    if (!sortColumn) return keys;
    keys.sort((a, b) => {
      const av = sortColumn === "__total" ? result.rowTotals.get(a) ?? 0 : result.cells.get(a)?.get(sortColumn) ?? 0;
      const bv = sortColumn === "__total" ? result.rowTotals.get(b) ?? 0 : result.cells.get(b)?.get(sortColumn) ?? 0;
      return descending ? bv - av : av - bv;
    });
    return keys;
  }, [result, sortColumn, descending]);

  const maxCell = useMemo(() => {
    let max = 0;
    for (const row of result.cells.values()) {
      for (const v of row.values()) max = Math.max(max, Math.abs(v));
    }
    return max || 1;
  }, [result]);

  if (result.rowKeys.length === 0 || result.columnKeys.length === 0) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Not enough data to build a matrix.
      </p>
    );
  }

  function toggleSort(key: string) {
    if (sortColumn === key) setDescending((d) => !d);
    else {
      setSortColumn(key);
      setDescending(true);
    }
  }

  const format = (v: number) =>
    Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col gap-2">
      {title && <p className="text-sm font-medium">{title}</p>}
      <p className="text-xs text-muted-foreground">
        {valueField} aggregated by {agg} — {rowField} (rows) × {columnField} (columns)
      </p>
      <div className="overflow-x-auto rounded-[var(--radius-token)] border border-border">
        <table className="w-full text-right text-sm">
          <caption className="sr-only">
            {`${valueField} by ${rowField} and ${columnField}, aggregated using ${agg}, with row and column subtotals`}
          </caption>
          <thead className="bg-surface-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                {rowField}
              </th>
              {result.columnKeys.map((col) => (
                <th key={col} scope="col" className="p-0">
                  <button
                    type="button"
                    onClick={() => toggleSort(col)}
                    aria-label={`Sort rows by ${col}`}
                    className="w-full px-3 py-2 text-right font-medium hover:bg-surface"
                  >
                    {col}
                    {sortColumn === col ? (descending ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
              <th scope="col" className="p-0">
                <button
                  type="button"
                  onClick={() => toggleSort("__total")}
                  aria-label="Sort rows by total"
                  className="w-full px-3 py-2 text-right font-semibold hover:bg-surface"
                >
                  Total{sortColumn === "__total" ? (descending ? " ↓" : " ↑") : ""}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {orderedRowKeys.map((rowKey) => (
              <tr key={rowKey} className="border-t border-border">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  {rowKey}
                </th>
                {result.columnKeys.map((col) => {
                  const value = result.cells.get(rowKey)?.get(col);
                  const intensity = value === undefined ? 0 : Math.abs(value) / maxCell;
                  return (
                    <td
                      key={col}
                      className="px-3 py-2 tabular-nums"
                      style={{
                        backgroundColor:
                          value === undefined ? undefined : `color-mix(in srgb, var(--accent) ${(intensity * 22).toFixed(1)}%, transparent)`,
                      }}
                    >
                      {value === undefined ? "—" : format(value)}
                    </td>
                  );
                })}
                <td className="px-3 py-2 font-semibold tabular-nums">
                  {format(result.rowTotals.get(rowKey) ?? 0)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-border-strong bg-surface-muted">
              <th scope="row" className="px-3 py-2 text-left font-semibold">
                Total
              </th>
              {result.columnKeys.map((col) => (
                <td key={col} className="px-3 py-2 font-semibold tabular-nums">
                  {format(result.columnTotals.get(col) ?? 0)}
                </td>
              ))}
              <td className="px-3 py-2 font-bold tabular-nums">{format(result.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
