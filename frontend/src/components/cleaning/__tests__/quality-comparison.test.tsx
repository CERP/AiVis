import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QualityComparison } from "../quality-comparison";

describe("QualityComparison", () => {
  it("renders before and after scores", () => {
    render(<QualityComparison before={62} after={94} />);
    expect(screen.getByText("62")).toBeInTheDocument();
    expect(screen.getByText("94")).toBeInTheDocument();
  });

  it("does not show a caveat when the full recipe is selected", () => {
    render(<QualityComparison before={62} after={94} />);
    expect(screen.queryByText(/Potential/)).not.toBeInTheDocument();
  });

  it("shows the caveat when the score reflects only a partial selection", () => {
    render(
      <QualityComparison
        before={62}
        after={94}
        afterCaveat="Potential score with all suggested changes applied"
      />
    );
    expect(screen.getByText(/Potential score with all suggested changes applied/)).toBeInTheDocument();
  });

  it("renders a dash when no after score is available", () => {
    render(<QualityComparison before={62} after={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
