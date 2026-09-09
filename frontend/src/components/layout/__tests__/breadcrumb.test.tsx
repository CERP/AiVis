import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Breadcrumb } from "../breadcrumb";

describe("Breadcrumb", () => {
  it("renders segments in order", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Projects", href: "/projects" },
          { label: "Acme Q3 Sales", href: "/projects/acme" },
          { label: "sales_q3.csv" },
        ]}
      />
    );

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Projects");
    expect(items.at(-1)).toHaveTextContent("sales_q3.csv");
  });

  it("renders earlier segments as links and the last segment as plain text", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Projects", href: "/projects" },
          { label: "sales_q3.csv" },
        ]}
      />
    );

    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/projects");
    expect(screen.queryByRole("link", { name: "sales_q3.csv" })).not.toBeInTheDocument();
  });

  it("marks the final segment with aria-current", () => {
    render(
      <Breadcrumb
        items={[{ label: "Projects", href: "/projects" }, { label: "sales_q3.csv" }]}
      />
    );

    expect(screen.getByText("sales_q3.csv")).toHaveAttribute("aria-current", "page");
  });

  it("wraps in a semantic breadcrumb nav", () => {
    render(<Breadcrumb items={[{ label: "Projects" }]} />);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });

  it("renders a single item without a separator or link", () => {
    render(<Breadcrumb items={[{ label: "Projects" }]} />);
    expect(screen.getByText("Projects")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not break rendering with a long label", () => {
    const longLabel = "a".repeat(200);
    render(
      <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: longLabel }]} />
    );
    expect(screen.getByText(longLabel)).toBeInTheDocument();
  });

  it("renders nothing for an empty item list", () => {
    const { container } = render(<Breadcrumb items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
