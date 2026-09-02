"use client";

import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/layout/app-shell";
import { Headline } from "@/components/ui/typography";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { apiClient } from "@/lib/api/client";

interface Project {
  id: string;
  name: string;
  description: string | null;
}

export default function ProjectsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiClient.get<Project[]>("/api/projects"),
  });

  return (
    <AppShell>
      <section className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
        <Headline as="h1" className="text-3xl">
          Your projects
        </Headline>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {isError && <ErrorState description="Couldn't load your projects." />}
        {data && data.length === 0 && (
          <EmptyState
            title="No projects yet"
            description="Create a project to start uploading datasets."
          />
        )}
        {data && data.length > 0 && (
          <ul className="flex flex-col gap-2">
            {data.map((project) => (
              <li key={project.id} className="rounded-[var(--radius-token)] border border-border p-4">
                {project.name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
