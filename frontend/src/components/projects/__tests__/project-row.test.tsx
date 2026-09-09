import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProjectRow } from "../project-row";

const project = {
  id: "p1",
  name: "Acme Q3 Sales",
  dataset_count: 3,
  updated_at: new Date().toISOString(),
};

describe("ProjectRow", () => {
  it("renders the project name and metadata", () => {
    render(<ProjectRow project={project} onRename={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("Acme Q3 Sales")).toBeInTheDocument();
    expect(screen.getByText(/3 datasets/)).toBeInTheDocument();
  });

  it("links the row to the project", () => {
    render(<ProjectRow project={project} onRename={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByRole("link", { name: /Acme Q3 Sales/ })).toHaveAttribute(
      "href",
      "/projects/p1"
    );
  });

  it("keeps rename/delete reachable via the overflow menu", async () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();
    render(<ProjectRow project={project} onRename={onRename} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole("button", { name: `Actions for ${project.name}` }));
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(onRename).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: `Actions for ${project.name}` }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("singularizes the dataset count label", () => {
    render(
      <ProjectRow
        project={{ ...project, dataset_count: 1 }}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText(/1 dataset ·/)).toBeInTheDocument();
  });
});
