import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnnotationList } from "../annotation-list";
import type { Annotation } from "@/lib/visualization/spec";

describe("AnnotationList", () => {
  it("renders nothing when there are no annotations", () => {
    const { container } = render(<AnnotationList annotations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a reference_line annotation with its anchor for accessible parity with the on-canvas rule", () => {
    const annotations: Annotation[] = [
      { id: "a1", type: "reference_line", text: "Target", target_field: "revenue", target_value: 500 },
    ];
    render(<AnnotationList annotations={annotations} />);
    expect(screen.getByText("Target (revenue = 500)")).toBeInTheDocument();
  });

  it("renders a callout annotation with its anchor", () => {
    const annotations: Annotation[] = [
      { id: "a1", type: "callout", text: "Peak", target_field: "region", target_value: "South" },
    ];
    render(<AnnotationList annotations={annotations} />);
    expect(screen.getByText("Peak (region = South)")).toBeInTheDocument();
  });

  it("renders plain text with no anchor suffix when there is no target", () => {
    const annotations: Annotation[] = [{ id: "a1", type: "label", text: "Just a note" }];
    render(<AnnotationList annotations={annotations} />);
    expect(screen.getByText("Just a note")).toBeInTheDocument();
  });

  it("renders source_note separately, as plain attribution text with no anchor suffix", () => {
    const annotations: Annotation[] = [{ id: "a1", type: "source_note", text: "Source: internal", target_field: "revenue", target_value: 5 }];
    render(<AnnotationList annotations={annotations} />);
    expect(screen.getByText("Source: internal")).toBeInTheDocument();
  });

  it("renders every annotation regardless of whether it also has an on-canvas mark", () => {
    const annotations: Annotation[] = [
      { id: "a1", type: "reference_line", text: "Ref", target_field: "revenue", target_value: 1 },
      { id: "a2", type: "highlighted_region", text: "Region", target_field: "revenue", target_value: 2 },
      { id: "a3", type: "source_note", text: "Note" },
    ];
    render(<AnnotationList annotations={annotations} />);
    expect(screen.getByText("Ref (revenue = 1)")).toBeInTheDocument();
    expect(screen.getByText("Region (revenue = 2)")).toBeInTheDocument();
    expect(screen.getByText("Note")).toBeInTheDocument();
  });
});
