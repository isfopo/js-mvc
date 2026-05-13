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

  // ── Condition-specific CSS selectors ──────────────────────────────────────

  describe("condition selectors", () => {
    it('uses :focus-within for "focused" condition', () => {
      const Field = State("field");
      const html = renderToString(
        <Field>
          <Field.Show when="focused">Help</Field.Show>
        </Field>
      );
      expect(html).toContain(":focus-within");
      expect(html).toContain("display: block");
    });

    it('uses :has(:checked) for "checked" condition', () => {
      const Tog = State("tog");
      const html = renderToString(
        <Tog>
          <Tog.Show when="checked">Visible when checked</Tog.Show>
        </Tog>
      );
      expect(html).toContain(":has(:checked)");
      expect(html).toContain('data-state-show="checked"');
    });

    it('uses :not(:has(:checked)) for "unchecked" condition', () => {
      const Tog = State("tog");
      const html = renderToString(
        <Tog>
          <Tog.Hide when="unchecked">Hidden when unchecked</Tog.Hide>
        </Tog>
      );
      expect(html).toContain(":not(:has(:checked))");
      expect(html).toContain('data-state-hide="unchecked"');
    });

    it('uses :has([data-state-value="X"]:checked) for value-based conditions', () => {
      const Color = State("color");
      const html = renderToString(
        <Color>
          <Color.Trigger value="red">
            <input type="radio" name="c" value="red" />
          </Color.Trigger>
          <Color.Show when="red">Red</Color.Show>
        </Color>
      );
      expect(html).toContain('[data-state-value="red"]:checked');
      expect(html).toContain('data-state-show="red"');
      expect(html).toContain('data-state-value="red"');
    });
  });

  // ── Effect type: Hide ─────────────────────────────────────────────────────

  describe("Hide effect", () => {
    it("renders visible by default, hides on condition (non-animated)", () => {
      const Tog = State("tog");
      const html = renderToString(
        <Tog>
          <Tog.Hide when="checked">Hide me</Tog.Hide>
        </Tog>
      );
      expect(html).not.toContain('hidden=""');
      expect(html).toContain('data-state-hide="checked"');
      expect(html).toContain("display: none");
    });

    it("renders animated Hide with transition", () => {
      const Tog = State("tog");
      const html = renderToString(
        <Tog>
          <Tog.Hide when="checked" animate="fade">
            Hide me animated
          </Tog.Hide>
        </Tog>
      );
      expect(html).toContain("transition: opacity 200ms");
      expect(html).toContain("visibility: hidden");
      expect(html).toContain("opacity: 0");
    });
  });

  // ── Effect type: Enable ───────────────────────────────────────────────────

  describe("Enable effect", () => {
    it("renders disabled by default, enables on condition", () => {
      const Confirm = State("confirm");
      const html = renderToString(
        <Confirm>
          <Confirm.Enable when="checked">
            <button>Go</button>
          </Confirm.Enable>
        </Confirm>
      );
      expect(html).toContain('data-state-enable="checked"');
      expect(html).toContain("opacity: 0.5");
      expect(html).toContain("pointer-events: none");
      expect(html).toContain("opacity: 1");
      expect(html).toContain("pointer-events: auto");
      expect(html).toContain("user-select: auto");
    });

    it("supports animate with Enable", () => {
      const Confirm = State("confirm");
      const html = renderToString(
        <Confirm>
          <Confirm.Enable when="checked" animate="fade">
            <button>Animated Go</button>
          </Confirm.Enable>
        </Confirm>
      );
      expect(html).toContain("transition: opacity 200ms");
    });
  });

  // ── Animation presets ─────────────────────────────────────────────────────

  describe("animation presets", () => {
    const presets = [
      ["fade", "opacity 200ms", ["opacity: 0"]],
      ["slide-up", "opacity 200ms, transform 200ms", ["translateY(8px)"]],
      ["slide-down", "opacity 200ms, transform 200ms", ["translateY(-8px)"]],
      ["scale", "opacity 200ms, transform 200ms", ["scale(0.95)"]],
      ["slide-left", "opacity 200ms, transform 200ms", ["translateX(8px)"]],
      ["slide-right", "opacity 200ms, transform 200ms", ["translateX(-8px)"]],
    ] as const;

    for (const [name, expectedTransition, expectedTransform] of presets) {
      it(`generates correct CSS for "${name}" preset`, () => {
        const Anim = State("anim");
        const html = renderToString(
          <Anim>
            <Anim.Show when="checked" animate={name}>
              Animated content
            </Anim.Show>
          </Anim>
        );
        expect(html.match(/hidden=""/g)).toBeNull();
        expect(html).toContain(expectedTransition);
        expect(html).toContain("visibility: hidden");
        expect(html).toContain("pointer-events: none");
        for (const val of expectedTransform) {
          expect(html).toContain(val);
        }
      });
    }
  });

  // ── Custom transition ─────────────────────────────────────────────────────

  describe("custom transition", () => {
    it("overrides animation preset transition when transition prop is set", () => {
      const Anim = State("anim");
      const html = renderToString(
        <Anim>
          <Anim.Show when="checked" animate="fade" transition="opacity 500ms ease-in">
            Slow fade
          </Anim.Show>
        </Anim>
      );
      expect(html).toContain("transition: opacity 500ms ease-in");
      expect(html).not.toContain("transition: opacity 200ms");
    });
  });

  // ── HTML tags ─────────────────────────────────────────────────────────────

  describe("HTML tag support", () => {
    it("renders Wrapper as a different tag", () => {
      const Form = State("form");
      const html = renderToString(
        <Form tag="form">
          <Form.Show when="valid">Valid</Form.Show>
        </Form>
      );
      expect(html).toContain("<form");
      expect(html).toContain("</form>");
    });

    it("renders Show with a different tag", () => {
      const Tog = State("tog");
      const html = renderToString(
        <Tog>
          <Tog.Show when="checked" tag="span">
            Inline content
          </Tog.Show>
        </Tog>
      );
      expect(html).toContain("<span");
      expect(html).toContain("</span>");
    });

    it("uses correct display value for span tags", () => {
      const Tog = State("tog");
      const html = renderToString(
        <Tog>
          <Tog.Show when="checked" tag="span">
            Inline
          </Tog.Show>
        </Tog>
      );
      expect(html).toContain("display: inline");
    });
  });

  // ── Extra props passthrough ────────────────────────────────────────────────

  describe("props passthrough", () => {
    it("passes extra props through Wrapper", () => {
      const W = State("w");
      const html = renderToString(
        <W class="my-class" id="my-id" data-custom="value">
          <W.Show when="x">X</W.Show>
        </W>
      );
      expect(html).toContain('class="my-class"');
      expect(html).toContain('id="my-id"');
      expect(html).toContain('data-custom="value"');
    });

    it("passes extra props through Show", () => {
      const W = State("w");
      const html = renderToString(
        <W>
          <W.Show when="x" class="custom-show" id="show-id">
            Show content
          </W.Show>
        </W>
      );
      expect(html).toContain('class="custom-show"');
      expect(html).toContain('id="show-id"');
    });

    it("passes extra props through Hide", () => {
      const W = State("w");
      const html = renderToString(
        <W>
          <W.Hide when="x" class="custom-hide">
            Hide content
          </W.Hide>
        </W>
      );
      expect(html).toContain('class="custom-hide"');
    });

    it("passes extra props through Disable", () => {
      const W = State("w");
      const html = renderToString(
        <W>
          <W.Disable when="x" data-test="disable-me">
            Disable target
          </W.Disable>
        </W>
      );
      expect(html).toContain('data-test="disable-me"');
    });

    it("passes extra props through Enable", () => {
      const W = State("w");
      const html = renderToString(
        <W>
          <W.Enable when="x" data-test="enable-me">
            Enable target
          </W.Enable>
        </W>
      );
      expect(html).toContain('data-test="enable-me"');
    });
  });

  // ── Multiple effects in one wrapper ───────────────────────────────────────

  describe("multiple effects", () => {
    it("supports Show + Hide + Disable + Enable in one wrapper", () => {
      const All = State("all");
      const html = renderToString(
        <All>
          <All.Show when="valid">Show</All.Show>
          <All.Hide when="invalid">Hide</All.Hide>
          <All.Disable when="unchecked">Disable</All.Disable>
          <All.Enable when="checked">Enable</All.Enable>
        </All>
      );
      expect(html).toContain('data-state-show="valid"');
      expect(html).toContain('data-state-hide="invalid"');
      expect(html).toContain('data-state-disable="unchecked"');
      expect(html).toContain('data-state-enable="checked"');
      expect(html.match(/<style>/g)?.length).toBe(4);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles custom scope name correctly in all CSS rules", () => {
      const Custom = State("custom", { scope: "my-custom-scope" });
      const html = renderToString(
        <Custom tag="form">
          <Custom.Show when="valid">Valid</Custom.Show>
          <Custom.Show when="invalid">Invalid</Custom.Show>
          <Custom.Disable when="unchecked">Disabled</Custom.Disable>
        </Custom>
      );
      const scopeRefs = html.match(/data-state-scope="my-custom-scope"/g);
      expect(scopeRefs?.length).toBeGreaterThanOrEqual(1);
      expect(html).toContain('[data-state-scope="my-custom-scope"]:valid');
      expect(html).toContain('[data-state-scope="my-custom-scope"]:invalid');
      expect(html).toContain('[data-state-scope="my-custom-scope"]:not(:has(:checked))');
    });
  });
});
