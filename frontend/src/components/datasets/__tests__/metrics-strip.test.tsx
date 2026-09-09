import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetricsStrip } from "../metrics-strip";

describe("MetricsStrip", () => {
  it("renders available metrics", () => {
    render(<MetricsStrip rowCount={12400} columnCount={18} piiCount={2} />);
    expect(screen.getByText(/12,400 rows/)).toBeInTheDocument();
    expect(screen.getByText(/18 columns/)).toBeInTheDocument();
    expect(screen.getByText(/2 PII/)).toBeInTheDocument();
  });

  it("renders the quality score and label when provided", () => {
    render(
      <MetricsStrip
        rowCount={100}
        columnCount={5}
        piiCount={0}
        quality={{ score: 62, label: "Needs cleaning", tone: "warning" }}
      />
    );
    expect(screen.getByText(/62 — Needs cleaning/)).toBeInTheDocument();
  });

  it("omits missing optional metrics without breaking layout", () => {
    render(<MetricsStrip rowCount={100} />);
    expect(screen.getByText("100 rows")).toBeInTheDocument();
    expect(screen.queryByText(/columns/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PII/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Quality/)).not.toBeInTheDocument();
  });

  it("renders nothing when no metrics or quality are available", () => {
    const { container } = render(<MetricsStrip />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the action slot", () => {
    render(<MetricsStrip rowCount={1} action={<button>Continue to Analysis</button>} />);
    expect(screen.getByRole("button", { name: "Continue to Analysis" })).toBeInTheDocument();
  });
});
