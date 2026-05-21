import { describe, it, expect } from "vitest";
import { renderToString } from "hono/jsx/dom/server";
import { View } from "./index";
import type { TenetListViewModel } from "../view-model";
import type { TenetSummary, UserInfo } from "db/tenet/service";

const mockUser: UserInfo = {
  id: 1,
  login: "testuser",
  avatarUrl: null,
  name: "Test User",
};

const mockTenet: TenetSummary = {
  id: 1,
  title: "Choose Framework",
  slug: "choose-framework",
  status: "draft",
  proposedBy: mockUser,
  createdAt: "2025-01-15T00:00:00Z",
};

describe("TenetListView", () => {
  it("renders empty state when no tenets exist", () => {
    const vm: TenetListViewModel = {
      tenets: [],
      currentUser: mockUser,
    };

    const html = renderToString(<View {...vm} />);

    expect(html).toContain("No tenets yet");
    expect(html).toContain("Propose a Tenet");
  });

  it("renders a list of tenets", () => {
    const vm: TenetListViewModel = {
      tenets: [mockTenet],
      currentUser: mockUser,
    };

    const html = renderToString(<View {...vm} />);

    expect(html).toContain("Choose Framework");
    expect(html).toContain("/tenets/choose-framework");
  });

  it("renders multiple tenets", () => {
    const tenets: TenetSummary[] = [
      mockTenet,
      {
        id: 2,
        title: "Use TypeScript",
        slug: "use-typescript",
        status: "voting",
        proposedBy: mockUser,
        createdAt: "2025-01-16T00:00:00Z",
      },
    ];

    const vm: TenetListViewModel = {
      tenets,
      currentUser: mockUser,
    };

    const html = renderToString(<View {...vm} />);

    expect(html).toContain("Choose Framework");
    expect(html).toContain("Use TypeScript");
  });

  it("renders the Propose link", () => {
    const vm: TenetListViewModel = {
      tenets: [],
      currentUser: mockUser,
    };

    const html = renderToString(<View {...vm} />);

    expect(html).toContain("/tenets/new");
  });

  it("renders page heading", () => {
    const vm: TenetListViewModel = {
      tenets: [],
      currentUser: mockUser,
    };

    const html = renderToString(<View {...vm} />);

    expect(html).toContain("Decisions");
  });
});