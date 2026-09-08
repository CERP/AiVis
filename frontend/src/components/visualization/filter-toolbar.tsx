"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ColumnProfile } from "@/lib/api/insights";
import type { FilterOperator, VizFilter } from "@/lib/visualization/spec";
import { cn } from "@/lib/utils";

const NOMINAL_TYPES = new Set(["categorical", "geographic", "identifier", "boolean", "text"]);
const QUANTITATIVE_TYPES = new Set(["numeric", "currency"]);

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "=",
  neq: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  in: "in",
  not_null: "is set",
};

function describeSelection(filter: VizFilter): string {
  if (filter.operator === "not_null") return "is set";
  if (filter.operator === "in") {
    const values = Array.isArray(filter.value) ? filter.value : [filter.value];
    if (values.length === 1) return `is ${values[0]}`;
    if (values.length <= 3) return `is one of ${values.join(", ")}`;
    return `${values.length} values selected`;
  }
  return `${OPERATOR_LABELS[filter.operator]} ${filter.value ?? ""}`;
}

function topValues(column: ColumnProfile | undefined): string[] {
  const raw = column?.stats?.top_values;
  if (!raw || typeof raw !== "object") return [];
  return Object.keys(raw as Record<string, number>);
}

/** One slicer already applied to the chart -- shown as a standing card (not a dismissable pill)
 * so the current filter state stays visible at a glance, matching how a Power BI slicer always
 * shows its selection on the canvas rather than hiding it behind a popover. */
function ActiveSlicerCard({
  filter,
  onRemove,
  disabled,
}: {
  filter: VizFilter;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-center justify-between gap-2 rounded-[var(--radius-token)] border border-border-strong bg-surface px-3 py-2"
    >
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold uppercase tracking-[0.04em] text-subtle-foreground">
          {filter.field}
        </div>
        <div className="truncate text-sm">{describeSelection(filter)}</div>
      </div>
      <button
        type="button"
        aria-label={`Remove ${filter.field} slicer`}
        disabled={disabled}
        className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-surface-muted hover:text-negative disabled:opacity-50"
        onClick={() => onRemove(filter.id)}
      >
        <X aria-hidden className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

export function FilterToolbar({
  filters,
  columns,
  disabled,
  onAdd,
  onRemove,
}: {
  filters: VizFilter[];
  columns: ColumnProfile[];
  disabled?: boolean;
  onAdd: (filter: { field: string; operator: FilterOperator; value: string | string[] }) => void;
  onRemove: (id: string) => void;
}) {
  const [field, setField] = useState("");
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [textValue, setTextValue] = useState("");

  const column = columns.find((c) => c.name === field);
  const isNumeric = !!column && QUANTITATIVE_TYPES.has(column.semantic_type ?? "");
  const isNominal = !!column && NOMINAL_TYPES.has(column.semantic_type ?? "");
  const values = useMemo(() => topValues(column), [column]);
  const hasValueList = isNominal && values.length > 0;
  const filteredValues = useMemo(
    () => values.filter((v) => v.toLowerCase().includes(search.toLowerCase())),
    [values, search]
  );

  const resetDraft = () => {
    setField("");
    setSelectedValues(new Set());
    setSearch("");
    setRangeFrom("");
    setRangeTo("");
    setTextValue("");
  };

  const canApply = hasValueList
    ? selectedValues.size > 0
    : isNumeric
      ? rangeFrom !== "" || rangeTo !== ""
      : textValue !== "";

  const applyDraft = () => {
    if (!field) return;
    if (hasValueList) {
      onAdd({ field, operator: "in", value: Array.from(selectedValues) });
    } else if (isNumeric) {
      if (rangeFrom !== "") onAdd({ field, operator: "gte", value: rangeFrom });
      if (rangeTo !== "") onAdd({ field, operator: "lte", value: rangeTo });
    } else {
      onAdd({ field, operator: "eq", value: textValue });
    }
    resetDraft();
  };

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {filters.map((filter) => (
          <ActiveSlicerCard key={filter.id} filter={filter} onRemove={onRemove} disabled={disabled} />
        ))}
      </AnimatePresence>

      {filters.length > 1 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => filters.forEach((f) => onRemove(f.id))}
          className="self-start text-xs font-medium text-muted-foreground underline-offset-2 hover:text-negative hover:underline disabled:opacity-50"
        >
          Clear all slicers
        </button>
      )}

      <div className="rounded-[var(--radius-token)] border border-dashed border-border-strong p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-subtle-foreground">
          <SlidersHorizontal aria-hidden className="h-3.5 w-3.5" />
          Add a slicer
        </div>

        <select
          aria-label="Field to slice by"
          disabled={disabled || columns.length === 0}
          className="w-full rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1.5 text-sm"
          value={field}
          onChange={(e) => {
            setField(e.target.value);
            setSelectedValues(new Set());
            setSearch("");
            setRangeFrom("");
            setRangeTo("");
            setTextValue("");
          }}
        >
          <option value="">Select a field…</option>
          {columns.map((col) => (
            <option key={col.name} value={col.name}>
              {col.name} — {col.semantic_type ?? "unknown"}
            </option>
          ))}
        </select>

        {field && hasValueList && (
          <div className="mt-3 flex flex-col gap-2">
            {values.length > 6 && (
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  aria-label="Search values"
                  placeholder="Search values…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-[var(--radius-token)] border border-border-strong bg-surface py-1.5 pl-7 pr-2 text-sm"
                />
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {selectedValues.size} of {values.length} selected
              </span>
              <button
                type="button"
                className="font-medium text-accent-hover hover:underline"
                onClick={() =>
                  setSelectedValues((prev) =>
                    prev.size === values.length ? new Set() : new Set(values)
                  )
                }
              >
                {selectedValues.size === values.length ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-[var(--radius-token)] border border-border bg-surface p-1.5">
              {filteredValues.length === 0 && (
                <p className="px-1.5 py-1 text-xs text-muted-foreground">No matching values</p>
              )}
              {filteredValues.map((value) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-surface-muted"
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.has(value)}
                    onChange={(e) =>
                      setSelectedValues((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(value);
                        else next.delete(value);
                        return next;
                      })
                    }
                  />
                  <span className="truncate">{value}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {field && !hasValueList && isNumeric && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              aria-label="Minimum value"
              placeholder="From"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              className="w-full rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="number"
              inputMode="decimal"
              aria-label="Maximum value"
              placeholder="To"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              className="w-full rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1.5 text-sm"
            />
          </div>
        )}

        {field && !hasValueList && !isNumeric && (
          <input
            type="text"
            aria-label="Value"
            placeholder="Exact value…"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            className="mt-3 w-full rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1.5 text-sm"
          />
        )}

        {field && (
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="accent"
              className={cn(!canApply && "pointer-events-none opacity-50")}
              disabled={!canApply || disabled}
              onClick={applyDraft}
            >
              Add slicer
            </Button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              disabled={disabled}
              onClick={() => onAdd({ field, operator: "not_null", value: "" })}
            >
              Only show rows where set
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
