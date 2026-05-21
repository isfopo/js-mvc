import { describe, it, expect } from "vitest";
import { renderToString } from "hono/jsx/dom/server";
import { StatusBadge } from "./index";
import type { TenetStatus } from "db/tenet/model";

describe("StatusBadge", () => {
  const statuses: TenetStatus[] = [
    "draft",
    "voting",
    "accepted",
    "rejected",
    "implemented",
    "superseded",
  ];

  const labels: Record<TenetStatus, string> = {
    draft: "Draft",
    voting: "Voting",
    accepted: "Accepted",
    rejected: "Rejected",
    implemented: "Implemented",
    superseded: "Superseded",
  };

  it("renders the correct label for each status", () => {
    for (const status of statuses) {
      const html = renderToString(<StatusBadge status={status} />);
      expect(html).toContain(labels[status]);
    }
  });

  it("renders a span element", () => {
    const html = renderToString(<StatusBadge status="draft" />);
    expect(html).toContain("<span");
    expect(html).toContain("</span>");
  });

  it("applies the correct CSS class for each status", () => {
    for (const status of statuses) {
      const html = renderToString(<StatusBadge status={status} />);
      // CSS module shim returns the key name as a string
      expect(html).toContain(status);
    }
  });
});