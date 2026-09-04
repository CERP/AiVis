"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Filter as FilterIcon, Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ColumnProfile } from "@/lib/api/insights";
import type { FilterOperator, VizFilter } from "@/lib/visualization/spec";

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

function describeFilter(filter: VizFilter): string {
  if (filter.operator === "not_null") return `${filter.field} is set`;
  return `${filter.field} ${OPERATOR_LABELS[filter.operator]} ${filter.value ?? ""}`;
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
  onAdd: (filter: { field: string; operator: FilterOperator; value: string }) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ field: string; operator: FilterOperator; value: string }>({
    field: "",
    operator: "eq",
    value: "",
  });

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-muted px-4 py-2">
      <FilterIcon aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
      <AnimatePresence initial={false}>
        {filters.map((filter) => (
          <motion.span
            key={filter.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-1 rounded-full border border-border-strong bg-surface px-2 py-0.5 text-xs"
          >
            {describeFilter(filter)}
            <button
              type="button"
              aria-label={`Remove filter: ${describeFilter(filter)}`}
              className="text-muted-foreground hover:text-negative"
              onClick={() => onRemove(filter.id)}
            >
              <X aria-hidden className="h-3 w-3" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>

      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          disabled={disabled || columns.length === 0}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 rounded-full border border-dashed border-border-strong px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50"
        >
          <Plus aria-hidden className="h-3 w-3" />
          Add filter
        </button>

        {open && (
          <div className="absolute left-0 top-full z-10 mt-2 flex w-64 flex-col gap-2 rounded-[var(--radius-token)] border border-border bg-surface p-3 shadow-md">
            <label htmlFor="filter-field" className="text-xs uppercase text-muted-foreground">
              Field
            </label>
            <select
              id="filter-field"
              className="rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1 text-sm"
              value={draft.field}
              onChange={(e) => setDraft((d) => ({ ...d, field: e.target.value }))}
            >
              <option value="">select a field…</option>
              {columns.map((col) => (
                <option key={col.name} value={col.name}>
                  {col.name} — {col.semantic_type ?? "unknown"}
                </option>
              ))}
            </select>

            <label htmlFor="filter-operator" className="text-xs uppercase text-muted-foreground">
              Condition
            </label>
            <select
              id="filter-operator"
              className="rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1 text-sm"
              value={draft.operator}
              onChange={(e) =>
                setDraft((d) => ({ ...d, operator: e.target.value as FilterOperator }))
              }
            >
              {(Object.keys(OPERATOR_LABELS) as FilterOperator[]).map((op) => (
                <option key={op} value={op}>
                  {OPERATOR_LABELS[op]}
                </option>
              ))}
            </select>

            {draft.operator !== "not_null" && (
              <>
                <label htmlFor="filter-value" className="text-xs uppercase text-muted-foreground">
                  Value
                </label>
                <input
                  id="filter-value"
                  className="rounded-[var(--radius-token)] border border-border-strong bg-surface px-2 py-1 text-sm"
                  value={draft.value}
                  onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                />
              </>
            )}

            <Button
              size="sm"
              variant="accent"
              disabled={!draft.field || (draft.operator !== "not_null" && !draft.value)}
              onClick={() => {
                onAdd(draft);
                setDraft({ field: "", operator: "eq", value: "" });
                setOpen(false);
              }}
            >
              Apply filter
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
