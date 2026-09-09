"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { ErrorState, ProcessingState } from "@/components/ui/states";
import { ApiError } from "@/lib/api/client";
import { getVisualization } from "@/lib/api/visualizations";

/** Backward-compatible redirect for deep links/bookmarks. Studio now lives at
 * /projects/[projectId]/visualizations/[visualizationId] -- the visualization response already
 * carries `project_id` directly, so this needs no extra fetch beyond the one it would have made
 * anyway. No AppShell here (matches the new route's dedicated-shell treatment) so a bookmarked
 * link doesn't flash the global nav before redirecting away from it. */
export default function LegacyStudioRedirectPage() {
  const params = useParams<{ visualizationId: string }>();
  const visualizationId = params.visualizationId;
  const router = useRouter();

  const visualizationQuery = useQuery({
    queryKey: ["visualization", visualizationId],
    queryFn: () => getVisualization(visualizationId),
  });

  useEffect(() => {
    if (visualizationQuery.data) {
      router.replace(
        `/projects/${visualizationQuery.data.project_id}/visualizations/${visualizationId}`
      );
    }
  }, [visualizationQuery.data, visualizationId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {visualizationQuery.isLoading && <ProcessingState label="Opening visualization studio…" />}
      {visualizationQuery.isError && (
        <ErrorState
          description={
            visualizationQuery.error instanceof ApiError
              ? visualizationQuery.error.detail
              : "Couldn't load this visualization."
          }
        />
      )}
    </div>
  );
}
