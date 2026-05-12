import { describe, it, expect, beforeEach } from "vitest";
import { renderToString } from "hono/jsx/dom/server";
import { State, _clearStateBuffer } from "./State";

beforeEach(() => {
  _clearStateBuffer();
});

describe("State", () => {
  it("renders a basic show/hide pair", () => {
    const Plan = State("plan");

    const html = renderToString(
      <Plan>
        <Plan.Trigger value="free">
          <input type="radio" name="plan" value="free" />
        </Plan.Trigger>
        <Plan.Show when="free">Free plan</Plan.Show>
      </Plan>
    );

    expect(html).toContain('data-state-scope="');
    expect(html).toContain('data-state-wrap');
    expect(html).toContain('data-state-show="free"');
    expect(html).toContain("hidden");
    expect(html).toContain("Free plan");
    expect(html).toContain("<style>");
  });

  it("renders trigger with data-state-value", () => {
    const Form = State("form");

    const html = renderToString(
      <Form>
        <Form.Trigger value="valid">
          <input type="text" required />
        </Form.Trigger>
      </Form>
    );

    expect(html).toContain('data-state-value="valid"');
  });

  it("generates CSS for valid/invalid conditions", () => {
    const Form = State("form");

    const html = renderToString(
      <Form tag="form">
        <Form.Show when="valid">Valid</Form.Show>
        <Form.Show when="invalid">Invalid</Form.Show>
      </Form>
    );

    // Non-animated show: uses hidden attribute
    expect(html).toContain('hidden=""');
    // CSS rules for :valid and :invalid
    expect(html).toContain(":valid");
    expect(html).toContain(":invalid");
    expect(html).toContain("display: block");
  });

  it("generates animation CSS when animate prop is set", () => {
    const Toggle = State("toggle");

    const html = renderToString(
      <Toggle>
        <Toggle.Show when="checked" animate="fade">
          Content
        </Toggle.Show>
      </Toggle>
    );

    // Animated show: uses CSS visibility: hidden (from animation preset) instead of HTML hidden attribute
    expect(html.match(/hidden=""/g)).toBeNull();
    // Should have transition
    expect(html).toContain("transition");
    expect(html).toContain("opacity");
    // Should have hidden state
    expect(html).toContain("opacity: 0");
    expect(html).toContain("visibility: hidden");
  });

  it("generates disable CSS", () => {
    const Confirm = State("confirm");

    const html = renderToString(
      <Confirm>
        <Confirm.Disable when="unchecked">
          <button>Submit</button>
        </Confirm.Disable>
      </Confirm>
    );

    expect(html).toContain('data-state-disable="unchecked"');
    expect(html).toContain("pointer-events: none");
    expect(html).toContain("opacity: 0.5");
    expect(html).toContain("<style>");
  });

  it("uses explicit scope from opts", () => {
    const Nav = State("nav", { scope: "main-nav" });

    const html = renderToString(
      <Nav>
        <Nav.Show when="open">Menu</Nav.Show>
      </Nav>
    );

    expect(html).toContain('data-state-scope="main-nav"');
  });

  it("uses unique scope IDs for separate State() calls", () => {
    const A = State("a");
    const B = State("b");

    const htmlA = renderToString(<A><A.Show when="x">X</A.Show></A>);
    const htmlB = renderToString(<B><B.Show when="y">Y</B.Show></B>);

    expect(htmlA).toContain('data-state-scope="a-1"');
    expect(htmlB).toContain('data-state-scope="b-2"');
  });
});
