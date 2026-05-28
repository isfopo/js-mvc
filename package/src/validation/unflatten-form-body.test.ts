import { describe, it, expect } from "vitest";
import { unflattenFormBody } from "./unflatten-form-body";

describe("unflattenFormBody", () => {
  it("passes through flat keys unchanged", () => {
    const result = unflattenFormBody({ title: "Test", context: "Hello" });
    expect(result).toEqual({ title: "Test", context: "Hello" });
  });

  it("unflattens single-level bracket notation", () => {
    const result = unflattenFormBody({ "options[0]": "A", "options[1]": "B" });
    expect(result).toEqual({ options: ["A", "B"] });
  });

  it("unflattens two-level bracket notation", () => {
    const result = unflattenFormBody({
      "options[0][title]": "React",
      "options[0][pros]": "Fast",
      "options[1][title]": "Vue",
      "options[1][pros]": "Simple",
    });
    expect(result).toEqual({
      options: [
        { title: "React", pros: "Fast" },
        { title: "Vue", pros: "Simple" },
      ],
    });
  });

  it("handles mixed flat and nested keys", () => {
    const result = unflattenFormBody({
      title: "Test",
      "options[0][title]": "Option A",
    });
    expect(result).toEqual({
      title: "Test",
      options: [{ title: "Option A" }],
    });
  });

  it("handles empty string keys", () => {
    const result = unflattenFormBody({});
    expect(result).toEqual({});
  });

  it("handles a single option", () => {
    const result = unflattenFormBody({
      "options[0][title]": "Only Option",
      "options[0][description]": "Desc",
    });
    expect(result).toEqual({
      options: [{ title: "Only Option", description: "Desc" }],
    });
  });

  it("handles missing intermediate indices gracefully", () => {
    const result = unflattenFormBody({
      "options[2][title]": "Third",
    });
    expect(result).toEqual({
      options: [undefined, undefined, { title: "Third" }],
    });
  });
});
