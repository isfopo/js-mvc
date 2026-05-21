import { describe, it, expect } from "vitest";
import { renderToString } from "hono/jsx/dom/server";
import { TenetCard } from "./index";
import type { TenetSummary, UserInfo } from "db/tenet/service";

const mockUser: UserInfo = {
  id: 1,
  login: "testuser",
  avatarUrl: "https://github.com/testuser.png",
  name: "Test User",
};

const baseTenet: TenetSummary = {
  id: 1,
  title: "Choose Framework",
  slug: "choose-framework",
  status: "draft",
  proposedBy: mockUser,
  createdAt: "2025-01-15T00:00:00Z",
};

describe("TenetCard", () => {
  it("renders the tenet title", () => {
    const html = renderToString(<TenetCard tenet={baseTenet} />);
    expect(html).toContain("Choose Framework");
  });

  it("renders a link to the tenet detail page", () => {
    const html = renderToString(<TenetCard tenet={baseTenet} />);
    expect(html).toContain("/tenets/choose-framework");
  });

  it("renders the proposer's login", () => {
    const html = renderToString(<TenetCard tenet={baseTenet} />);
    expect(html).toContain("testuser");
  });

  it("renders the status badge", () => {
    const html = renderToString(<TenetCard tenet={baseTenet} />);
    // StatusBadge renders the label for the status
    expect(html).toContain("Draft");
  });

  it("renders a voting status badge", () => {
    const votingTenet: TenetSummary = { ...baseTenet, status: "voting" };
    const html = renderToString(<TenetCard tenet={votingTenet} />);
    expect(html).toContain("Voting");
  });

  it("renders an accepted status badge", () => {
    const acceptedTenet: TenetSummary = { ...baseTenet, status: "accepted" };
    const html = renderToString(<TenetCard tenet={acceptedTenet} />);
    expect(html).toContain("Accepted");
  });

  it("renders the proposer avatar", () => {
    const html = renderToString(<TenetCard tenet={baseTenet} />);
    expect(html).toContain("https://github.com/testuser.png");
  });

  it("renders fallback avatar when avatarUrl is null", () => {
    const userNoAvatar: UserInfo = { ...mockUser, avatarUrl: null };
    const tenetNoAvatar: TenetSummary = { ...baseTenet, proposedBy: userNoAvatar };
    const html = renderToString(<TenetCard tenet={tenetNoAvatar} />);
    // Should render fallback (first letter of login)
    expect(html).toContain("T"); // First letter of "testuser"
  });
});