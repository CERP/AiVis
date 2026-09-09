import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SchemaTable } from "../schema-table";
import type { ColumnProfile } from "@/lib/api/insights";

const columns: ColumnProfile[] = [
  {
    id: "c1",
    name: "customer_id",
    ordinal: 0,
    raw_type: "string",
    semantic_type: "categorical",
    is_pii: true,
    null_count: 0,
    unique_count: 12400,
    stats: {},
  },
  {
    id: "c2",
    name: "revenue",
    ordinal: 1,
    raw_type: "float",
    semantic_type: "numeric",
    is_pii: false,
    null_count: 3,
    unique_count: 8201,
    stats: {},
  },
];

describe("SchemaTable", () => {
  it("renders real table semantics", () => {
    render(<SchemaTable columns={columns} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(5);
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2 data rows
  });

  it("renders each column's name, type, null/unique counts, and privacy state", () => {
    render(<SchemaTable columns={columns} />);
    expect(screen.getByText("customer_id")).toBeInTheDocument();
    expect(screen.getByText("revenue")).toBeInTheDocument();
    expect(screen.getByText("CAT")).toBeInTheDocument();
    expect(screen.getByText("NUM")).toBeInTheDocument();
    expect(screen.getByText("Protected")).toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
    expect(screen.getByText("12,400")).toBeInTheDocument();
  });

  it("renders an empty table body for no columns", () => {
    render(<SchemaTable columns={[]} />);
    expect(screen.getAllByRole("row")).toHaveLength(1); // header only
  });
});
