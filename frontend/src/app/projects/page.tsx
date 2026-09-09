"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ProjectRow, type ProjectRowProject } from "@/components/projects/project-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { apiClient } from "@/lib/api/client";

interface Project extends ProjectRowProject {
  description: string | null;
}

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editNameInput, setEditNameInput] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiClient.get<Project[]>("/api/projects"),
  });

  const createProject = useMutation({
    mutationFn: (name: string) => apiClient.post<Project>("/api/projects", { name }),
    onSuccess: () => {
      setNewProjectName("");
      setIsCreating(false);
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
      <section className="mx-auto max-w-[880px] px-5 py-10 sm:px-7 lg:py-12">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h1 className="font-headline text-[22px] font-semibold tracking-tight">Projects</h1>
            {data && (
              <span className="text-[13px] text-subtle-foreground">
                {data.length} project{data.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <Button
            variant="accent"
            size="sm"
            onClick={() => setIsCreating((v) => !v)}
            aria-expanded={isCreating}
          >
            <Plus aria-hidden className="h-3.5 w-3.5" /> New project
          </Button>
        </div>

        {isCreating && (
          <form
            className="mb-6 flex flex-col gap-2.5 rounded-[var(--radius-token)] border border-border bg-surface p-4 sm:flex-row"
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
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setNewProjectName("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={createProject.isPending}>
                Create project
              </Button>
            </div>
          </form>
        )}

        {isLoading && (
          <div className="flex flex-col gap-3.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[52px] w-full" />
            ))}
          </div>
        )}
        {isError && (
          <ErrorState description="Couldn't load your projects." action={<Button onClick={() => refetch()}>Retry</Button>} />
        )}
        {data && data.length === 0 && (
          <EmptyState
            title="No projects yet"
            action={
              <Button variant="accent" size="sm" onClick={() => setIsCreating(true)}>
                <Plus aria-hidden className="h-3.5 w-3.5" /> New project
              </Button>
            }
          />
        )}
        {data && data.length > 0 && (
          <ul>
            {data.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                onRename={() => {
                  setEditingProject(project);
                  setEditNameInput(project.name);
                }}
                onDelete={() => {
                  if (
                    confirm(
                      `Are you sure you want to delete the project "${project.name}" and all of its datasets?`
                    )
                  ) {
                    deleteProjectMutation.mutate(project.id);
                  }
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-panel/45 p-4">
          <form
            className="w-full max-w-md rounded-[var(--radius-lg-token)] border border-border bg-surface p-6"
            style={{ boxShadow: "var(--shadow-modal)" }}
            onSubmit={(e) => {
              e.preventDefault();
              if (editNameInput.trim()) {
                updateProjectMutation.mutate({ id: editingProject.id, name: editNameInput.trim() });
              }
            }}
          >
            <h3 className="mb-3 text-[16px] font-semibold text-foreground">Rename project</h3>
            <Input
              className="mb-5 w-full"
              placeholder="Project name"
              value={editNameInput}
              onChange={(e) => setEditNameInput(e.target.value)}
            />
            <div className="flex items-center justify-end gap-2.5">
              <Button type="button" variant="outline" onClick={() => setEditingProject(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={updateProjectMutation.isPending}>
                Save
              </Button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
