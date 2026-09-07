"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

export interface TabOption {
  id: string;
  label: string;
}

export function Tabs({
  options,
  value,
  onChange,
  layoutId,
  className,
}: {
  options: TabOption[];
  value: string;
  onChange: (id: string) => void;
  layoutId: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex max-w-full gap-1 overflow-x-auto rounded-[calc(var(--radius-token)+2px)] bg-surface-muted p-1",
        className
      )}
    >
      {options.map((option) => {
        const isActive = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.id)}
            className={cn(
              "relative shrink-0 rounded-[var(--radius-token)] px-3.5 py-1.5 text-sm font-semibold transition-colors",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 -z-10 rounded-[var(--radius-token)] bg-surface shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
