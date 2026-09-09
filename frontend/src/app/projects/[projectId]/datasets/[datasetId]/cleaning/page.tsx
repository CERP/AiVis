"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StageTabs } from "@/components/layout/stage-tabs";
import { OperationRow } from "@/components/cleaning/operation-row";
import { QualityComparison } from "@/components/cleaning/quality-comparison";
import { Button } from "@/components/ui/button";
import { ErrorState, ProcessingState } from "@/components/ui/states";
import { apiClient, ApiError } from "@/lib/api/client";
import {
  applyValidationWorkflow,
  downloadDataset,
  getDataset,
  getValidationWorkflow,
} from "@/lib/api/datasets";
import { computeEvidence } from "@/lib/cleaning-evidence";

interface Project {
  id: string;
  name: string;
}

const QUALITY_STATUS_LABEL: Record<string, string> = {
  healthy: "Healthy",
  usable_with_minor_issues: "Minor issues",
  requires_cleaning: "Needs cleaning",
  unsuitable: "Unsuitable",
};

export default function CleaningReviewPage() {
  const params = useParams<{ projectId: string; datasetId: string }>();
  const { projectId, datasetId } = params;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectedForAuditId, setSelectedForAuditId] = useState<string | null>(null);
  const [appliedVersionId, setAppliedVersionId] = useState<string | null>(null);

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiClient.get<Project>(`/api/projects/${projectId}`),
  });

  const datasetQuery = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => getDataset(datasetId),
  });

  const workflowQuery = useQuery({
    queryKey: ["validation-workflow", datasetId],
    queryFn: () => getValidationWorkflow(datasetId),
  });

  const workflow = workflowQuery.data;
  const recipe = workflow?.cleaning_recipe ?? [];

  // Every step starts selected -- "Accept all" is the implicit default, matching the approved
  // Cleaning UX (a user opts OUT of a proposed change, rather than opting in from nothing).
  // Adjusted during render (React's recommended pattern for resetting state when a prop/query
  // result changes) rather than in an effect, so there's no extra render-then-reset flash.
  if (workflow && selectedForAuditId !== workflow.audit_id) {
    setSelectedForAuditId(workflow.audit_id);
    setSelected(new Set(recipe.map((_, i) => i)));
  }

  const applyMutation = useMutation({
    mutationFn: (payload: { selection: "original" | "cleaned"; indices?: number[] }) => {
      if (!workflow) throw new Error("Workflow not loaded");
      return applyValidationWorkflow(datasetId, workflow.audit_id, payload.selection, payload.indices);
    },
    onSuccess: (result) => {
      setAppliedVersionId(result.dataset_version_id);
      queryClient.invalidateQueries({ queryKey: ["dataset", datasetId] });
      queryClient.invalidateQueries({ queryKey: ["analysis", datasetId] });
      queryClient.invalidateQueries({ queryKey: ["validation-workflow", datasetId] });
    },
  });

  const toggleStep = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const isHealthy = workflow?.dataset_status === "healthy" && recipe.length === 0;
  const isUnsuitable = workflow?.dataset_status === "unsuitable";
  const hasFullRecipeErrors = (workflow?.validation_errors.length ?? 0) > 0;

  const qualityAfterCaveat =
    workflow && selected.size < recipe.length
      ? "Potential score with all suggested changes applied"
      : undefined;

  return (
    <AppShell>
      <StageTabs projectId={projectId} datasetId={datasetId} current="cleaning" />
      <section className="mx-auto flex max-w-[1240px] flex-col px-5 py-8 sm:px-7">
        <Breadcrumb
          className="mb-4"
          items={[
            { label: "Projects", href: "/projects" },
            { label: projectQuery.data?.name ?? "…", href: `/projects/${projectId}` },
            {
              label: datasetQuery.data?.original_filename ?? "…",
              href: `/projects/${projectId}/datasets/${datasetId}`,
            },
          ]}
        />

        {workflowQuery.isLoading && <ProcessingState label="Generating cleaning proposal…" />}
        {workflowQuery.isError && (
          <ErrorState
            title="Couldn't generate a cleaning proposal."
            description={
              (workflowQuery.error instanceof ApiError
                ? workflowQuery.error.detail
                : "Please try again.") + " Your original data is untouched."
            }
            action={<Button onClick={() => workflowQuery.refetch()}>Retry</Button>}
          />
        )}

        {appliedVersionId && (
          <div className="mb-6 flex flex-col gap-3 rounded-[var(--radius-token)] border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13.5px] text-foreground">Cleaning applied to a new dataset version.</p>
            <Button variant="accent" onClick={() => router.push(`/datasets/${datasetId}/recommend`)}>
              Continue to Analysis <ArrowRight aria-hidden className="h-4 w-4" />
            </Button>
          </div>
        )}

        {workflow && !appliedVersionId && isHealthy && (
          <div className="flex flex-col items-start gap-3 py-10">
            <p className="text-[15px] font-medium text-foreground">
              No cleaning needed. This dataset is healthy.
            </p>
            <Button
              variant="accent"
              onClick={() => router.push(`/datasets/${datasetId}/recommend`)}
            >
              Continue to Analysis <ArrowRight aria-hidden className="h-4 w-4" />
            </Button>
          </div>
        )}

        {workflow && !appliedVersionId && isUnsuitable && (
          <div className="flex flex-col gap-4 py-6">
            <div>
              <p className="text-[15px] font-semibold text-foreground">
                This dataset isn&apos;t suitable for automatic cleaning.
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Quality score: {workflow.data_quality_score_before}/100
              </p>
            </div>
            {(workflow.anomalies.length > 0 || workflow.remaining_issues.length > 0) && (
              <ul className="flex flex-col gap-1.5">
                {[...workflow.anomalies, ...workflow.remaining_issues].map((issue, i) => (
                  <li key={i} className="text-[13px] text-muted-foreground">
                    {issue.column_name ? `${issue.column_name}: ` : ""}
                    {issue.description}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2.5">
              <Button
                variant="accent"
                disabled={applyMutation.isPending}
                onClick={() => applyMutation.mutate({ selection: "original" })}
              >
                Use original anyway
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/projects/${projectId}/datasets/${datasetId}`)}
              >
                Return to Overview
              </Button>
              <Button variant="outline" onClick={() => void downloadDataset(datasetId, "raw", "csv")}>
                Download original
              </Button>
            </div>
            {applyMutation.isError && (
              <p role="alert" className="text-sm text-negative">
                {applyMutation.error instanceof ApiError
                  ? applyMutation.error.detail
                  : "Couldn't apply. Your original data is untouched."}
              </p>
            )}
          </div>
        )}

        {workflow && !appliedVersionId && !isHealthy && !isUnsuitable && (
          <div className="flex flex-col gap-8 lg:flex-row">
            <div className="flex-1 lg:max-w-[68%]">
              {hasFullRecipeErrors && (
                <p role="alert" className="mb-4 rounded-[var(--radius-token)] border border-warning/30 bg-warning/5 px-3.5 py-3 text-[13px] text-foreground">
                  Gemini&apos;s full cleaning candidate failed AiVis integrity checks
                  ({workflow.validation_errors.join("; ")}). You can still apply a subset of the
                  proposed changes below.
                </p>
              )}

              <h2 className="mb-3 font-headline text-[15px] font-semibold">
                Proposed changes ({recipe.length})
              </h2>
              <ul>
                {recipe.map((step, index) => (
                  <OperationRow
                    key={index}
                    step={step}
                    selected={selected.has(index)}
                    onToggle={() => toggleStep(index)}
                    evidence={computeEvidence(workflow, step, recipe)}
                  />
                ))}
              </ul>

              {workflow.remaining_issues.length > 0 && (
                <div className="mt-8 flex flex-col gap-2">
                  <h2 className="font-headline text-[15px] font-semibold">
                    Flagged, not changed ({workflow.remaining_issues.length})
                  </h2>
                  <p className="text-[12.5px] text-subtle-foreground">
                    AiVis noticed these but did not change them automatically.
                  </p>
                  <ul className="flex flex-col gap-1.5 border-t border-dashed border-border pt-3">
                    {workflow.remaining_issues.map((issue, i) => (
                      <li key={i} className="text-[13px] text-muted-foreground">
                        {issue.column_name ? `${issue.column_name}: ` : ""}
                        {issue.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="lg:w-[32%] lg:shrink-0">
              <div className="flex flex-col gap-5 lg:sticky lg:top-[104px]">
                <p className="text-[13.5px] font-medium text-foreground">
                  Verdict: {QUALITY_STATUS_LABEL[workflow.dataset_status] ?? workflow.dataset_status}
                </p>
                <QualityComparison
                  before={workflow.data_quality_score_before}
                  after={workflow.data_quality_score_after}
                  afterCaveat={qualityAfterCaveat}
                />
                <p className="text-[13px] text-muted-foreground">
                  {selected.size} of {recipe.length} operations selected
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="accent"
                    disabled={applyMutation.isPending}
                    onClick={() => applyMutation.mutate({ selection: "cleaned", indices: Array.from(selected) })}
                  >
                    Apply selected
                  </Button>
                  <Button
                    variant="outline"
                    disabled={applyMutation.isPending || hasFullRecipeErrors}
                    onClick={() => applyMutation.mutate({ selection: "cleaned" })}
                  >
                    Accept all
                  </Button>
                  <Button
                    variant="outline"
                    disabled={applyMutation.isPending}
                    onClick={() => applyMutation.mutate({ selection: "original" })}
                  >
                    Reject all
                  </Button>
                </div>
                {applyMutation.isError && (
                  <p role="alert" className="text-[12.5px] text-negative">
                    {applyMutation.error instanceof ApiError
                      ? applyMutation.error.detail
                      : "Couldn't apply. Your original data is untouched, and your selection is unchanged."}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
