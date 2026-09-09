import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StageTabs } from "../stage-tabs";

describe("StageTabs", () => {
  it("renders Overview, Cleaning, and Analysis labels", () => {
    render(<StageTabs projectId="p1" datasetId="d1" current="overview" />);
    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cleaning" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analysis" })).toBeInTheDocument();
  });

  it("marks Overview as the active/current stage", () => {
    render(<StageTabs projectId="p1" datasetId="d1" current="overview" />);
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Cleaning" })).not.toHaveAttribute("aria-current");
  });

  it("points Overview at the nested dataset route", () => {
    render(<StageTabs projectId="p1" datasetId="d1" current="overview" />);
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/projects/p1/datasets/d1"
    );
  });

  it("points the transitional Cleaning/Analysis tabs at the existing /recommend flow, not a dead link", () => {
    render(<StageTabs projectId="p1" datasetId="d1" current="overview" />);
    expect(screen.getByRole("link", { name: "Cleaning" })).toHaveAttribute(
      "href",
      "/datasets/d1/recommend"
    );
    expect(screen.getByRole("link", { name: "Analysis" })).toHaveAttribute(
      "href",
      "/datasets/d1/recommend"
    );
  });

  it("wraps in a semantic navigation landmark", () => {
    render(<StageTabs projectId="p1" datasetId="d1" current="overview" />);
    expect(screen.getByRole("navigation", { name: "Dataset stages" })).toBeInTheDocument();
  });
});
