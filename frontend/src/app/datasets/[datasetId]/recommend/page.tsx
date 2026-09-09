"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ErrorState, ProcessingState } from "@/components/ui/states";
import { ApiError } from "@/lib/api/client";
import { getAnalysis } from "@/lib/api/analysis";
import { getDataset } from "@/lib/api/datasets";

/** Retired combined cleaning+recommendations+theme screen -- Cleaning and Analysis now have
 * their own real nested routes (Batches 5-6), and nothing in the app's own navigation points
 * here anymore. This exists purely as a redirect shell for old deep links/bookmarks.
 *
 * Resolving "does this dataset still need cleaning" reuses the same already-fetched
 * analysis.data_quality proxy Overview/Cleaning already rely on (see Batch 4/5 notes) rather
 * than calling the validation-workflow endpoint, which would lazily trigger a real Gemini audit
 * as a side effect of simply landing on an old bookmark -- exactly the kind of surprise paid AI
 * call this redirect must not cause. */
export default function LegacyRecommendRedirectPage() {
  const params = useParams<{ datasetId: string }>();
  const datasetId = params.datasetId;
  const router = useRouter();

  const datasetQuery = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => getDataset(datasetId),
  });

  const analysisQuery = useQuery({
    queryKey: ["analysis", datasetId],
    queryFn: () => getAnalysis(datasetId),
  });

  const projectId = datasetQuery.data?.project_id;
  const hasQualityIssues = (analysisQuery.data?.data_quality?.issues.length ?? 0) > 0;

  useEffect(() => {
    if (!projectId || !analysisQuery.data) return;
    const destination = hasQualityIssues
      ? `/projects/${projectId}/datasets/${datasetId}/cleaning`
      : `/projects/${projectId}/datasets/${datasetId}/analysis`;
    router.replace(destination);
  }, [projectId, analysisQuery.data, hasQualityIssues, datasetId, router]);

  const isError = datasetQuery.isError || analysisQuery.isError;

  return (
    <AppShell>
      <section className="mx-auto flex max-w-[1240px] flex-col px-5 py-10 sm:px-7">
        {!isError && <ProcessingState label="Loading dataset…" />}
        {isError && (
          <ErrorState
            description={
              datasetQuery.error instanceof ApiError
                ? datasetQuery.error.detail
                : "Couldn't load this dataset."
            }
          />
        )}
      </section>
    </AppShell>
  );
}
