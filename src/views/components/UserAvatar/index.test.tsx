import { describe, it, expect } from "vitest";
import { renderToString } from "hono/jsx/dom/server";
import { UserAvatar } from "./index";

describe("UserAvatar", () => {
  it("renders an img tag when avatarUrl is provided", () => {
    const html = renderToString(
      <UserAvatar login="octocat" avatarUrl="https://github.com/octocat.png" />,
    );

    expect(html).toContain("<img");
    expect(html).toContain('src="https://github.com/octocat.png"');
    expect(html).toContain('alt="octocat"');
  });

  it("renders a fallback span when avatarUrl is null", () => {
    const html = renderToString(
      <UserAvatar login="octocat" avatarUrl={null} />,
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("<span");
    expect(html).toContain("O"); // First letter of "octocat" uppercased
  });

  it("uses the default size of 28", () => {
    const html = renderToString(
      <UserAvatar login="octocat" avatarUrl="https://github.com/octocat.png" />,
    );

    expect(html).toContain('width="28"');
    expect(html).toContain('height="28"');
  });

  it("uses a custom size when provided", () => {
    const html = renderToString(
      <UserAvatar login="octocat" avatarUrl="https://github.com/octocat.png" size={48} />,
    );

    expect(html).toContain('width="48"');
    expect(html).toContain('height="48"');
  });

  it("uppercases the first letter of login in fallback", () => {
    const html = renderToString(
      <UserAvatar login="alice" avatarUrl={null} />,
    );

    expect(html).toContain("A");
  });

  it("handles single-character login in fallback", () => {
    const html = renderToString(
      <UserAvatar login="x" avatarUrl={null} />,
    );

    expect(html).toContain("X");
  });
});