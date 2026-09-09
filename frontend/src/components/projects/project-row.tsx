"use client";

import { FolderKanban, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";

export interface ProjectRowProject {
  id: string;
  name: string;
  dataset_count: number;
  updated_at: string;
}

/** Whole row opens the project; rename/delete are secondary and stay out of the way behind a
 * hover/focus-revealed overflow menu so they never compete visually with the open action. */
export function ProjectRow({
  project,
  onRename,
  onDelete,
}: {
  project: ProjectRowProject;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <li className="group relative flex items-center gap-3.5 border-b border-border px-1 py-3.5 last:border-b-0 hover:bg-surface-muted">
      <Link
        href={`/projects/${project.id}`}
        className="flex min-w-0 flex-1 items-center gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm-token)] bg-surface-muted text-muted-foreground">
          <FolderKanban aria-hidden className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-foreground">
            {project.name}
          </span>
          <span className="block text-[12.5px] text-subtle-foreground">
            {project.dataset_count} dataset{project.dataset_count === 1 ? "" : "s"} · updated{" "}
            {relativeTime(project.updated_at)}
          </span>
        </span>
      </Link>

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          aria-label={`Actions for ${project.name}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm-token)] text-muted-foreground opacity-0 transition-opacity hover:bg-surface-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <MoreHorizontal aria-hidden className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full z-10 mt-1 w-40 rounded-[var(--radius-token)] border border-border bg-surface py-1"
            style={{ boxShadow: "var(--shadow-popover)" }}
          >
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 rounded-none px-3 py-2 text-[13px] font-normal"
              onClick={() => {
                setMenuOpen(false);
                onRename();
              }}
            >
              <Pencil aria-hidden className="h-3.5 w-3.5" /> Rename
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 rounded-none px-3 py-2 text-[13px] font-normal text-negative hover:text-negative"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
            >
              <Trash2 aria-hidden className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
