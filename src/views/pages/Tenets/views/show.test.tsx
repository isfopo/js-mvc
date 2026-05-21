import { describe, it, expect } from "vitest";
import { renderToString } from "hono/jsx/dom/server";
import { View } from "./show";
import type { TenetDetailViewModel } from "../view-model";
import type { TenetDetail, UserInfo, TenetOptionDetail, VoteDetail } from "db/tenet/service";
import type { TenetStatus } from "db/tenet/model";

const mockUser: UserInfo = {
  id: 1,
  login: "testuser",
  avatarUrl: "https://github.com/testuser.png",
  name: "Test User",
};

const mockOptions: TenetOptionDetail[] = [
  {
    id: 1,
    title: "React",
    description: "A popular UI library",
    pros: "Large ecosystem",
    cons: "Heavy bundle size",
    sortOrder: 0,
  },
  {
    id: 2,
    title: "Vue",
    description: null,
    pros: null,
    cons: null,
    sortOrder: 1,
  },
];

const mockVotes: VoteDetail[] = [
  {
    userId: 1,
    user: mockUser,
    choice: "approve",
    reason: null,
  },
];

const baseTenet: TenetDetail = {
  id: 1,
  title: "Choose Framework",
  slug: "choose-framework",
  status: "voting",
  context: "We need to pick a framework for the frontend.",
  decision: null,
  rationale: null,
  options: mockOptions,
  votes: mockVotes,
  proposedBy: mockUser,
  createdAt: "2025-01-15T00:00:00Z",
  updatedAt: "2025-01-15T00:00:00Z",
};

function makeViewModel(overrides: Partial<TenetDetailViewModel> = {}): TenetDetailViewModel {
  return {
    tenet: baseTenet,
    currentUser: mockUser,
    userVote: null,
    canVote: true,
    canTransition: true,
    allowedTransitions: ["accepted", "rejected"],
    ...overrides,
  };
}

describe("TenetShowView", () => {
  it("renders the tenet title", () => {
    const html = renderToString(<View {...makeViewModel()} />);
    expect(html).toContain("Choose Framework");
  });

  it("renders the context section", () => {
    const html = renderToString(<View {...makeViewModel()} />);
    expect(html).toContain("We need to pick a framework for the frontend.");
  });

  it("renders options with titles", () => {
    const html = renderToString(<View {...makeViewModel()} />);
    expect(html).toContain("React");
    expect(html).toContain("Vue");
  });

  it("renders option description when present", () => {
    const html = renderToString(<View {...makeViewModel()} />);
    expect(html).toContain("A popular UI library");
  });

  it("renders pros and cons when present", () => {
    const html = renderToString(<View {...makeViewModel()} />);
    expect(html).toContain("Large ecosystem");
    expect(html).toContain("Heavy bundle size");
  });

  it("renders the status badge", () => {
    const html = renderToString(<View {...makeViewModel()} />);
    // StatusBadge renders the label text for the status
    expect(html).toContain("Voting");
  });

  it("renders the proposer login", () => {
    const html = renderToString(<View {...makeViewModel()} />);
    expect(html).toContain("testuser");
  });

  it("renders the vote section when canVote is true", () => {
    const html = renderToString(<View {...makeViewModel()} />);
    expect(html).toContain("Vote");
  });

  it("hides the vote section when canVote is false", () => {
    const vm = makeViewModel({ canVote: false });
    const html = renderToString(<View {...vm} />);
    // The vote section should not appear
    expect(html).not.toContain('name="choice"');
  });

  it("renders existing vote when userVote is set", () => {
    const vm = makeViewModel({
      userVote: { choice: "approve", reason: null },
    });
    const html = renderToString(<View {...vm} />);
    expect(html).toContain("approve");
  });

  it("renders the votes table", () => {
    const html = renderToString(<View {...makeViewModel()} />);
    expect(html).toContain("testuser");
    expect(html).toContain("approve");
  });

  it("shows no votes message when votes are empty", () => {
    const tenetNoVotes = { ...baseTenet, votes: [] };
    const vm = makeViewModel({ tenet: tenetNoVotes });
    const html = renderToString(<View {...vm} />);
    expect(html).toContain("No votes yet");
  });

  it("renders transition buttons when canTransition is true", () => {
    const vm = makeViewModel({
      canTransition: true,
      allowedTransitions: ["accepted", "rejected"],
    });
    const html = renderToString(<View {...vm} />);
    expect(html).toContain("Accept");
    expect(html).toContain("Reject");
  });

  it("hides transition buttons when canTransition is false", () => {
    const vm = makeViewModel({
      canTransition: false,
      allowedTransitions: [],
    });
    const html = renderToString(<View {...vm} />);
    // Should not contain status transition form
    expect(html).not.toContain('action="/tenets/choose-framework/status"');
  });

  it("renders decision and rationale when present", () => {
    const tenetWithDecision: TenetDetail = {
      ...baseTenet,
      decision: "We chose React",
      rationale: "Larger ecosystem outweighs bundle size",
    };
    const vm = makeViewModel({ tenet: tenetWithDecision });
    const html = renderToString(<View {...vm} />);
    expect(html).toContain("We chose React");
    expect(html).toContain("Larger ecosystem outweighs bundle size");
  });

  it("does not render decision section when null", () => {
    const html = renderToString(<View {...makeViewModel()} />);
    // The decision box should not appear when decision is null
    expect(html).not.toContain("Decision:");
  });

  it("renders draft status with start voting button", () => {
    const draftTenet: TenetDetail = { ...baseTenet, status: "draft" };
    const vm = makeViewModel({
      tenet: draftTenet,
      canTransition: true,
      allowedTransitions: ["voting"],
    });
    const html = renderToString(<View {...vm} />);
    expect(html).toContain("Start Voting");
  });
});