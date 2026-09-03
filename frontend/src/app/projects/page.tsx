"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Headline } from "@/components/ui/typography";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { apiClient } from "@/lib/api/client";

interface Project {
  id: string;
  name: string;
  description: string | null;
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
      <section className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
        <Headline as="h1" className="text-3xl">
          Your projects
        </Headline>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">New project</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex gap-3"
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
                placeholder="Project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
              <Button type="submit" disabled={createProject.isPending}>
                Create
              </Button>
            </form>
          </CardContent>
        </Card>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {isError && <ErrorState description="Couldn't load your projects." />}
        {data && data.length === 0 && (
          <EmptyState
            title="No projects yet"
            description="Create a project above to start uploading datasets."
          />
        )}
        {data && data.length > 0 && (
          <ul className="flex flex-col gap-2">
            {data.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="block rounded-[var(--radius-token)] border border-border bg-surface p-4 shadow-sm transition-shadow hover:bg-surface-muted hover:shadow-md"
                >
                  {project.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
