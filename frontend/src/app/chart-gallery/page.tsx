"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function Redirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const datasetId = searchParams.get("datasetId");
    router.replace(datasetId ? `/explorer?datasetId=${datasetId}` : "/explorer");
  }, [router, searchParams]);

  return null;
}

/** Retired dev/fixture showcase -- the real Chart Explorer now lives at /explorer. This exists
 * purely so old links/bookmarks (and the AppShell nav's previous href) keep working. Preserves
 * the datasetId query param used for contextual entry. The reusable spec+fixture content that
 * used to live on this page now lives in lib/visualization/chart-preview-specs.ts, consumed by
 * ChartCard in the new Explorer -- nothing was deleted, just relocated before this page's own
 * implementation was replaced. */
export default function LegacyChartGalleryRedirectPage() {
  return (
    <Suspense fallback={null}>
      <Redirect />
    </Suspense>
  );
}
