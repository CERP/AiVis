import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routerReplace = vi.fn();
let searchParamsValue = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace }),
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}));

import LegacyChartGalleryRedirectPage from "../page";

describe("Legacy /chart-gallery redirect", () => {
  beforeEach(() => {
    routerReplace.mockClear();
    searchParamsValue = "";
  });

  it("redirects to /explorer", async () => {
    render(<LegacyChartGalleryRedirectPage />);
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/explorer"));
  });

  it("preserves the datasetId query param", async () => {
    searchParamsValue = "datasetId=d1";
    render(<LegacyChartGalleryRedirectPage />);
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/explorer?datasetId=d1"));
  });
});
