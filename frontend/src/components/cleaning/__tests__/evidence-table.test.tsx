import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EvidenceTable } from "../evidence-table";

describe("EvidenceTable", () => {
  it("renders before/after example pairs", () => {
    render(
      <EvidenceTable
        examples={[{ before: "male", after: "Male" }]}
        changedInPreview={1}
        previewSize={20}
      />
    );
    expect(screen.getByText("male")).toBeInTheDocument();
    expect(screen.getByText("Male")).toBeInTheDocument();
  });

  it("caps visible examples and labels the remainder honestly as 'in preview'", () => {
    render(
      <EvidenceTable
        examples={[
          { before: "a", after: "A" },
          { before: "b", after: "B" },
          { before: "c", after: "C" },
          { before: "d", after: "D" },
          { before: "e", after: "E" },
        ]}
        changedInPreview={127}
        previewSize={200}
      />
    );
    // Never claims a dataset-wide total the API doesn't provide.
    expect(screen.getByText(/127 of 200 previewed rows changed/)).toBeInTheDocument();
    expect(screen.queryByText(/127 affected values/)).not.toBeInTheDocument();
  });

  it("notes when the diff reflects more than one step sharing a column", () => {
    render(
      <EvidenceTable
        examples={[{ before: "a", after: "A" }]}
        changedInPreview={1}
        previewSize={10}
        sharedWithOtherSteps
      />
    );
    expect(screen.getByText(/reflects all proposed changes to this column/)).toBeInTheDocument();
  });

  it("shows a plain message when nothing changed in the preview", () => {
    render(<EvidenceTable examples={[]} changedInPreview={0} previewSize={20} />);
    expect(screen.getByText(/No changes visible/)).toBeInTheDocument();
  });
});
