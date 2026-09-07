"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, ProcessingState } from "@/components/ui/states";
import { apiClient } from "@/lib/api/client";
import { relativeTime } from "@/lib/format";

interface Project {
  id: string;
  name: string;
  description: string | null;
  dataset_count: number;
  updated_at: string;
}

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [newProjectName, setNewProjectName] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiClient.get<Project[]>("/api/projects"),
  });

  const createProject = useMutation({
    mutationFn: (name: string) => apiClient.post<Project>("/api/projects", { name }),
    onSuccess: () => {
      setNewProjectName("");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return (
    <AppShell>
      <section className="mx-auto max-w-[920px] px-6 py-14 sm:px-7">
        <div className="mb-1.5 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-headline text-[28px] font-bold">Your projects</h1>
            <p className="mt-2 text-[14.5px] text-muted-foreground">
              Projects group related datasets, recommendations, and studio visualizations for one
              report or analysis.
            </p>
          </div>
          {data && (
            <span className="shrink-0 whitespace-nowrap text-[13px] text-subtle-foreground">
              {data.length} project{data.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="mb-8 mt-7 rounded-[14px] border border-border bg-surface px-[22px] py-5">
          <div className="mb-3 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-subtle-foreground">
            New project
          </div>
          <form
            className="flex flex-col gap-2.5 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (newProjectName.trim()) createProject.mutate(newProjectName.trim());
            }}
          >
            <label htmlFor="project-name" className="sr-only">
              Project name
            </label>
            <Input
              id="project-name"
              className="flex-1"
              placeholder="e.g. Riverbend USD Board Report"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <Button type="submit" variant="accent" disabled={createProject.isPending}>
              Create project
            </Button>
          </form>
        </div>

        <div className="mb-3 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-subtle-foreground">
          All projects
        </div>

        {isLoading && <ProcessingState label="Loading projects…" />}
        {isError && <ErrorState description="Couldn't load your projects." />}
        {data && data.length === 0 && (
          <EmptyState
            title="No projects yet"
            description="Create a project above to start uploading datasets."
          />
        )}
        {data && data.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {data.map((project) => (
              <motion.li key={project.id} whileHover={{ x: 2 }}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-[18px] hover:border-border-strong"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-accent-muted font-headline text-[15px] font-bold text-accent-hover">
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{project.name}</div>
                    <div className="mt-0.5 text-[12.5px] text-subtle-foreground">
                      {project.dataset_count} dataset{project.dataset_count === 1 ? "" : "s"} ·
                      updated {relativeTime(project.updated_at)}
                    </div>
                  </div>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
