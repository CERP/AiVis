"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";

import { Skeleton } from "@/components/ui/states";
import { apiClient } from "@/lib/api/client";
import { listDatasets, type Dataset } from "@/lib/api/datasets";

interface Project {
  id: string;
  name: string;
}

/** Two-step project -> dataset picker rather than one flat cross-project list: fetching every
 * project's datasets up front would be exactly the N+1 pattern avoided everywhere else in this
 * app. Only the chosen project's datasets are ever fetched. No profile/analysis calls here --
 * name, filename, and status are all this needs, and all three are already on the list payload. */
export function DatasetPicker({
  onSelect,
  onClose,
}: {
  onSelect: (dataset: Dataset) => void;
  onClose: () => void;
}) {
  const [projectId, setProjectId] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiClient.get<Project[]>("/api/projects"),
  });

  const datasetsQuery = useQuery({
    queryKey: ["datasets", projectId],
    queryFn: () => listDatasets(projectId as string),
    enabled: !!projectId,
  });

  const selectedProject = projectsQuery.data?.find((p) => p.id === projectId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dataset picker"
        onClick={onClose}
        className="absolute inset-0 bg-panel/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a dataset"
        className="relative max-h-[70vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-lg-token)] border border-border bg-surface p-5"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        {projectId ? (
          <button
            type="button"
            onClick={() => setProjectId(null)}
            className="mb-3 flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft aria-hidden className="h-3.5 w-3.5" /> Projects
          </button>
        ) : (
          <h2 className="mb-3 text-[16px] font-semibold text-foreground">Choose a project</h2>
        )}

        {!projectId && (
          <>
            {projectsQuery.isLoading && (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}
            {projectsQuery.data?.length === 0 && (
              <p className="text-[13px] text-muted-foreground">No projects yet.</p>
            )}
            <ul>
              {projectsQuery.data?.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => setProjectId(project.id)}
                    className="w-full rounded-[var(--radius-sm-token)] px-2 py-2.5 text-left text-[14px] font-medium text-foreground hover:bg-surface-muted"
                  >
                    {project.name}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {projectId && (
          <>
            <h2 className="mb-3 text-[16px] font-semibold text-foreground">
              {selectedProject?.name ?? "Choose a dataset"}
            </h2>
            {datasetsQuery.isLoading && (
              <div className="flex flex-col gap-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}
            {datasetsQuery.data?.length === 0 && (
              <p className="text-[13px] text-muted-foreground">No datasets in this project yet.</p>
            )}
            <ul>
              {datasetsQuery.data
                ?.filter((d) => d.status === "ready")
                .map((dataset) => (
                  <li key={dataset.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(dataset)}
                      className="w-full rounded-[var(--radius-sm-token)] px-2 py-2.5 text-left text-[14px] font-medium text-foreground hover:bg-surface-muted"
                    >
                      {dataset.original_filename}
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
