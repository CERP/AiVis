"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ErrorState, ProcessingState } from "@/components/ui/states";
import { ApiError } from "@/lib/api/client";
import { getDataset } from "@/lib/api/datasets";

/** Backward-compatible redirect for deep links/bookmarks to the old flat route. Dataset Overview
 * now lives at /projects/[projectId]/datasets/[datasetId] -- this resolves project_id from the
 * dataset the app already knows how to fetch, then hands off. No new backend endpoint: `getDataset`
 * already returns `project_id` on the existing dataset response. */
export default function LegacyDatasetRedirectPage() {
  const params = useParams<{ datasetId: string }>();
  const datasetId = params.datasetId;
  const router = useRouter();

  const datasetQuery = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => getDataset(datasetId),
  });

  useEffect(() => {
    if (datasetQuery.data) {
      router.replace(`/projects/${datasetQuery.data.project_id}/datasets/${datasetId}`);
    }
  }, [datasetQuery.data, datasetId, router]);

  return (
    <AppShell>
      <section className="mx-auto flex max-w-[1240px] flex-col px-5 py-10 sm:px-7">
        {datasetQuery.isLoading && <ProcessingState label="Loading dataset…" />}
        {datasetQuery.isError && (
          <ErrorState
            description={
              datasetQuery.error instanceof ApiError
                ? datasetQuery.error.detail
                : "Couldn't find that dataset."
            }
          />
        )}
      </section>
    </AppShell>
  );
}
