"use client";

import { ArrowLeft, Download, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import type { VisualizationVersion } from "@/lib/api/visualizations";
import { relativeTime } from "@/lib/format";

/** Studio's own toolbar -- there is no global AppShell above this screen (Studio is a
 * dedicated workspace, per the Phase 4 refinement), so this single bar carries everything a
 * normal page would split across AppShell + Breadcrumb + page header: exit path, context,
 * version state, undo, and export. Only relocates existing controls -- undo/version/export
 * logic itself lives in the page container and is passed down as props/callbacks. */
export function StudioToolbar({
  backHref,
  breadcrumbItems,
  versionLabel,
  versions,
  canUndo,
  isUndoing,
  onUndo,
  onExportClick,
}: {
  backHref: string;
  breadcrumbItems: BreadcrumbItem[];
  versionLabel: string;
  versions: VisualizationVersion[];
  canUndo: boolean;
  isUndoing: boolean;
  onUndo: () => void;
  onExportClick: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const recentVersions = versions.slice(-10).reverse();

  return (
    <header className="flex h-auto min-h-12 shrink-0 flex-wrap items-center justify-between gap-y-1.5 border-b border-border bg-surface px-4 py-1.5 sm:h-12 sm:flex-nowrap sm:py-0 sm:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          href={backHref}
          aria-label="Back to Analysis"
          className="flex shrink-0 items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Back to Analysis</span>
        </Link>
        <Breadcrumb items={breadcrumbItems} className="min-w-0" />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="relative">
          <button
            type="button"
            aria-expanded={historyOpen}
            aria-haspopup="true"
            onClick={() => setHistoryOpen((v) => !v)}
            className="rounded-[var(--radius-sm-token)] px-1.5 py-1 text-[12.5px] text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            {versionLabel}
          </button>
          {historyOpen && recentVersions.length > 0 && (
            <div
              className="absolute right-0 top-full z-10 mt-1 w-56 rounded-[var(--radius-token)] border border-border bg-surface py-1"
              style={{ boxShadow: "var(--shadow-popover)" }}
            >
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-subtle-foreground">
                Version history
              </p>
              <ul aria-label="Version history">
                {recentVersions.map((version) => (
                  <li key={version.id} className="px-3 py-1.5 text-[12.5px] text-foreground">
                    v{version.version_number} · {relativeTime(version.created_at)}
                    {version.change_summary && (
                      <span className="ml-1 text-subtle-foreground">— {version.change_summary}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={!canUndo || isUndoing}
          onClick={onUndo}
        >
          <Undo2 aria-hidden className="h-3.5 w-3.5" />
          {isUndoing ? "Undoing…" : "Undo"}
        </Button>
        <Button variant="accent" size="sm" onClick={onExportClick}>
          <Download aria-hidden className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>
    </header>
  );
}
