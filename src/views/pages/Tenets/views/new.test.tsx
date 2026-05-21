import { describe, it, expect } from "vitest";
import { renderToString } from "hono/jsx/dom/server";
import { View } from "./new";
import type { TenetFormViewModel } from "../view-model";

describe("TenetNewView", () => {
  it("renders the form heading", () => {
    const vm: TenetFormViewModel = { isEditing: false };
    const html = renderToString(<View {...vm} />);

    expect(html).toContain("Propose a Tenet");
  });

  it("renders the title input", () => {
    const vm: TenetFormViewModel = { isEditing: false };
    const html = renderToString(<View {...vm} />);

    expect(html).toContain('name="title"');
  });

  it("renders the context textarea", () => {
    const vm: TenetFormViewModel = { isEditing: false };
    const html = renderToString(<View {...vm} />);

    expect(html).toContain('name="context"');
  });

  it("renders the submit button", () => {
    const vm: TenetFormViewModel = { isEditing: false };
    const html = renderToString(<View {...vm} />);

    expect(html).toContain("Create Tenet");
  });

  it("renders the form with POST method", () => {
    const vm: TenetFormViewModel = { isEditing: false };
    const html = renderToString(<View {...vm} />);

    expect(html).toContain('action="/tenets"');
    expect(html).toContain('method="post"');
  });

  it("renders initial option fields", () => {
    const vm: TenetFormViewModel = { isEditing: false };
    const html = renderToString(<View {...vm} />);

    // Should have two initial option cards (Option 1 and Option 2)
    expect(html).toContain("Option 1");
    expect(html).toContain("Option 2");
  });

  it("renders the add option button", () => {
    const vm: TenetFormViewModel = { isEditing: false };
    const html = renderToString(<View {...vm} />);

    expect(html).toContain("Add option");
  });

  it("renders validation errors when provided", () => {
    const vm: TenetFormViewModel = {
      isEditing: false,
      validationErrors: {
        title: "Title is required",
        context: "Context is required",
      },
    };
    const html = renderToString(<View {...vm} />);

    expect(html).toContain("Title is required");
    expect(html).toContain("Context is required");
  });

  it("renders aria-invalid on fields with errors", () => {
    const vm: TenetFormViewModel = {
      isEditing: false,
      validationErrors: {
        title: "Title is required",
      },
    };
    const html = renderToString(<View {...vm} />);

    expect(html).toContain('aria-invalid="true"');
  });

  it("renders options validation error", () => {
    const vm: TenetFormViewModel = {
      isEditing: false,
      validationErrors: {
        options: "At least one option is required",
      },
    };
    const html = renderToString(<View {...vm} />);

    expect(html).toContain("At least one option is required");
  });

  it("renders without validation errors when none provided", () => {
    const vm: TenetFormViewModel = { isEditing: false };
    const html = renderToString(<View {...vm} />);

    // Should not have aria-invalid attributes
    expect(html).not.toContain('aria-invalid="true"');
  });
});