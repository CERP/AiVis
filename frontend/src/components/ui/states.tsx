import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[var(--radius-token)] bg-surface-muted", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-token)] border border-dashed border-border-strong px-8 py-16 text-center">
      <Inbox aria-hidden className="h-8 w-8 text-muted-foreground" />
      <p className="font-headline text-xl font-semibold">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-token)] border border-negative/30 bg-accent-muted px-8 py-16 text-center"
    >
      <AlertCircle aria-hidden className="h-8 w-8 text-negative" />
      <p className="font-headline text-xl font-semibold text-negative">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function ProcessingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm text-muted-foreground">
      <Loader2 aria-hidden className="h-4 w-4 animate-spin text-accent" />
      {label}
    </div>
  );
}

/** Status pill for async resource states (dataset upload/processing/ready/failed) --
 * aria-live so screen-reader users hear the transition, not just see the color/text change. */
export function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "pending" | "positive" | "negative";
}) {
  return (
    <motion.span
      key={label}
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
        tone === "pending" && "bg-surface-muted text-muted-foreground",
        tone === "positive" && "bg-surface-muted text-positive",
        tone === "negative" && "bg-accent-muted text-negative"
      )}
    >
      {tone === "pending" && <Loader2 aria-hidden className="h-3 w-3 animate-spin" />}
      {tone === "positive" && <CheckCircle2 aria-hidden className="h-3 w-3" />}
      {tone === "negative" && <AlertCircle aria-hidden className="h-3 w-3" />}
      {label}
    </motion.span>
  );
}

/** Compact KPI/stat tile row -- dataset-level summary numbers (row count, column count,
 * insight count) shown at a glance above the detail views, matching the dashboard "stat tile"
 * pattern from the reference screenshots. */
export function StatTile({
  label,
  value,
  index = 0,
}: {
  label: string;
  value: string | number;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="flex flex-col gap-1 rounded-[var(--radius-token)] border border-border bg-surface p-4 shadow-sm"
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-headline text-2xl font-bold">{value}</span>
    </motion.div>
  );
}

/** Shows which step of a known pipeline is active, e.g. ["Analyzing statistics", "Detecting
 * patterns", "Ranking visualizations"] with activeIndex=1 -- communicates real progress
 * through a multi-step backend call instead of one static "Loading…" label for the whole
 * duration. Completed steps get a check, the active step pulses, future steps are dimmed. */
export function StagedProcessing({
  stages,
  activeIndex,
}: {
  stages: string[];
  activeIndex: number;
}) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      {stages.map((stage, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;
        return (
          <motion.div
            key={stage}
            className={cn(
              "flex items-center gap-2 text-sm",
              isDone && "text-muted-foreground",
              isActive && "text-foreground font-medium",
              !isDone && !isActive && "text-muted-foreground/50"
            )}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]",
                isDone && "bg-positive text-background",
                isActive && "bg-accent",
                !isDone && !isActive && "border border-border-strong"
              )}
            >
              <AnimatePresence mode="wait">
                {isDone && (
                  <motion.span
                    key="check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    ✓
                  </motion.span>
                )}
                {isActive && (
                  <motion.span
                    key="pulse"
                    className="h-1.5 w-1.5 rounded-full bg-accent-foreground"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                )}
              </AnimatePresence>
            </span>
            {stage}
          </motion.div>
        );
      })}
    </div>
  );
}
