"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StageTabs } from "@/components/layout/stage-tabs";
import { MetricsStrip } from "@/components/datasets/metrics-strip";
import { SchemaTable } from "@/components/datasets/schema-table";
import { Button } from "@/components/ui/button";
import { ErrorState, ProcessingState, StagedProcessing } from "@/components/ui/states";
import { ANALYSIS_STAGE_LABELS, getAnalysis } from "@/lib/api/analysis";
import { apiClient, ApiError } from "@/lib/api/client";
import { getDataset } from "@/lib/api/datasets";
import { getProfile } from "@/lib/api/insights";

interface Project {
  id: string;
  name: string;
}

export default function DatasetOverviewPage() {
  const params = useParams<{ projectId: string; datasetId: string }>();
  const { projectId, datasetId } = params;
  const router = useRouter();

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiClient.get<Project>(`/api/projects/${projectId}`),
  });

  const datasetQuery = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => getDataset(datasetId),
  });

  const profileQuery = useQuery({
    queryKey: ["profile", datasetId],
    queryFn: () => getProfile(datasetId),
  });

  const analysisQuery = useQuery({
    queryKey: ["analysis", datasetId],
    queryFn: () => getAnalysis(datasetId),
    refetchInterval: (query) =>
      query.state.data && !["ready", "failed"].includes(query.state.data.status) ? 1500 : false,
  });

  const analysis = analysisQuery.data;
  const isReady = analysis?.status === "ready";
  const isFailed = analysis?.status === "failed";
  const isProcessing = !!analysis && !isReady && !isFailed;

  const stageEntries = Object.entries(analysis?.stages ?? {});
  const activeStageIndex = stageEntries.findIndex(([, s]) => s === "processing");
  const stageLabels = stageEntries.map(([key]) => ANALYSIS_STAGE_LABELS[key] ?? key);

  // The real dataset_status enum (healthy/usable_with_minor_issues/requires_cleaning/unsuitable)
  // lives behind the validation-workflow endpoint, which lazily triggers a real Gemini cleaning
  // audit the first time anything calls it. Calling that from Overview would make a page view
  // trigger a paid AI call as a side effect -- out of scope for a navigation/structure batch that
  // explicitly excludes touching cleaning logic. Instead this reuses the already-fetched
  // analysis.data_quality (score + issue count), which this page already fetches and displays.
  const hasQualityIssues = !!analysis?.data_quality && analysis.data_quality.issues.length > 0;
  const quality = analysis?.data_quality
    ? {
        score: analysis.data_quality.score,
        label: hasQualityIssues ? "Needs cleaning" : "Healthy",
        tone: (hasQualityIssues ? "warning" : "positive") as "warning" | "positive",
      }
    : undefined;

  const ctaLabel = hasQualityIssues ? "Review Cleaning" : "Continue to Analysis";
  // Messy state now has a real destination (Batch 5). Analysis doesn't yet (Batch 6), so the
  // healthy path still temporarily lands on the old /recommend flow.
  const ctaHref = hasQualityIssues
    ? `/projects/${projectId}/datasets/${datasetId}/cleaning`
    : `/datasets/${datasetId}/recommend`;

  return (
    <AppShell>
      <StageTabs projectId={projectId} datasetId={datasetId} current="overview" />
      <section className="mx-auto flex max-w-[1240px] flex-col px-5 py-8 sm:px-7">
        <Breadcrumb
          className="mb-4"
          items={[
            { label: "Projects", href: "/projects" },
            { label: projectQuery.data?.name ?? "…", href: `/projects/${projectId}` },
            { label: datasetQuery.data?.original_filename ?? "…" },
          ]}
        />

        <MetricsStrip
          rowCount={profileQuery.data?.row_count}
          columnCount={profileQuery.data?.column_count}
          piiCount={profileQuery.data?.columns.filter((c) => c.is_pii).length}
          quality={quality}
          action={
            <Button variant="accent" onClick={() => router.push(ctaHref)}>
              <Sparkles aria-hidden className="h-4 w-4" />
              {ctaLabel}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Button>
          }
        />

        <div className="mt-8">
          <h2 className="mb-3 font-headline text-[15px] font-semibold">Schema</h2>

          {profileQuery.isLoading && <ProcessingState label="Loading profile…" />}
          {profileQuery.isError && (
            <ErrorState
              title="Profiling failed"
              description={
                profileQuery.error instanceof ApiError
                  ? profileQuery.error.detail
                  : "Couldn't load the dataset profile. Your uploaded file is safe."
              }
              action={<Button onClick={() => profileQuery.refetch()}>Retry</Button>}
            />
          )}
          {profileQuery.data && <SchemaTable columns={profileQuery.data.columns} />}
        </div>

        {hasQualityIssues && analysis?.data_quality && (
          <div className="mt-8 flex flex-col gap-2.5">
            <h2 className="font-headline text-[15px] font-semibold">
              Quality issues ({analysis.data_quality.issues.length})
            </h2>
            <ul className="flex flex-col gap-2">
              {analysis.data_quality.issues.map((issue, i) => (
                <li key={`${issue.type}-${issue.column}-${i}`} className="flex items-start gap-2.5 text-[13px]">
                  <span
                    aria-hidden
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      issue.severity === "high" ? "bg-negative" : "bg-warning"
                    }`}
                  />
                  <div>
                    <p className="font-medium text-foreground">{issue.description}</p>
                    {issue.recommendation && (
                      <p className="text-subtle-foreground">{issue.recommendation}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isProcessing && (
          <div className="mt-8 flex flex-col gap-4">
            <h2 className="font-headline text-[15px] font-semibold">Analyzing dataset…</h2>
            <StagedProcessing
              stages={stageLabels}
              activeIndex={activeStageIndex === -1 ? 0 : activeStageIndex}
            />
          </div>
        )}

        {isFailed && (
          <div className="mt-8">
            <ErrorState
              title="Analysis failed"
              description={analysis?.error ?? "Something went wrong during analysis."}
            />
          </div>
        )}
      </section>
    </AppShell>
  );
}
