"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
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
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editNameInput, setEditNameInput] = useState("");

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

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiClient.patch<Project>(`/api/projects/${id}`, { name }),
    onSuccess: () => {
      setEditingProject(null);
      setEditNameInput("");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/api/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return (
    <AppShell>
      <section className="mx-auto max-w-[1240px] px-5 py-10 sm:px-7 lg:py-12">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
              Workspace
            </p>
            <h1 className="font-headline text-[34px] font-bold tracking-[-0.04em]">Your projects</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
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

        <div className="mb-9 rounded-2xl border border-accent/15 bg-gradient-to-r from-accent-muted to-surface px-5 py-5 shadow-sm shadow-accent/5 sm:px-6">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold text-accent-hover">
            <Plus aria-hidden className="h-4 w-4" /> Start a new analysis
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
              placeholder="Project name, e.g. Class 7 performance"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <Button type="submit" variant="accent" disabled={createProject.isPending}>
              Create project
            </Button>
          </form>
        </div>

        <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.09em] text-subtle-foreground">
          Recent projects
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
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.map((project) => (
              <motion.li key={project.id} whileHover={{ y: -2 }}>
                <div className="group relative h-full">
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex h-full min-h-36 flex-col justify-between rounded-2xl border border-border bg-surface p-5 pr-20 shadow-sm shadow-black/[0.02] transition-colors hover:border-accent/30"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted text-accent">
                      <FolderKanban aria-hidden className="h-4 w-4" />
                    </div>
                    <div className="mt-6 min-w-0">
                      <div className="truncate font-headline text-[16px] font-bold">{project.name}</div>
                      <div className="mt-1 text-[12.5px] text-subtle-foreground">
                        {project.dataset_count} dataset{project.dataset_count === 1 ? "" : "s"} ·
                        updated {relativeTime(project.updated_at)}
                      </div>
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-12 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-muted-foreground hover:text-accent z-10 transition-colors"
                    disabled={deleteProjectMutation.isPending || updateProjectMutation.isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingProject(project);
                      setEditNameInput(project.name);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-muted-foreground hover:text-negative z-10 transition-colors"
                    disabled={deleteProjectMutation.isPending || updateProjectMutation.isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm(`Are you sure you want to delete the project "${project.name}" and all of its datasets?`)) {
                        deleteProjectMutation.mutate(project.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      {editingProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            className="bg-surface border border-border rounded-xl shadow-2xl p-6 max-w-md w-full animate-in fade-in zoom-in duration-200"
            onSubmit={(e) => {
              e.preventDefault();
              if (editNameInput.trim()) {
                updateProjectMutation.mutate({ id: editingProject.id, name: editNameInput.trim() });
              }
            }}
          >
            <h3 className="text-[18px] font-bold text-foreground mb-3">
              Rename project
            </h3>
            <p className="text-[14px] text-muted-foreground mb-4">
              Enter a new name for your project:
            </p>
            <Input
              className="w-full mb-6"
              placeholder="Project name"
              value={editNameInput}
              onChange={(e) => setEditNameInput(e.target.value)}
            />
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingProject(null)}
                className="text-[13.5px] font-medium"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="accent"
                disabled={updateProjectMutation.isPending}
                className="text-[13.5px] font-semibold"
              >
                Save
              </Button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
