import type { FC } from "hono/jsx";
import type { StateDemoViewModel } from "../view-model";
import { State } from "../../../../utils/State";
import styles from "./index.module.css";

const Plan = State<"plan", "free" | "pro" | "enterprise">("plan");
const FormValidity = State("form");
const Confirm = State("confirm");
const FocusField = State("field");
const Color = State<"color", "red" | "blue">("color");
const AnimatedPlan = State("animation");

export const View: FC<StateDemoViewModel> = () => (
  <section>
    <h1>State() Demos</h1>
    <p>
      These demos showcase CSS-only state-driven interactivity using the{" "}
      <code>State()</code> component factory. No JavaScript required.
    </p>

    {/* ── Section 1: Radio-based show/hide ─────────────────────── */}
    <h2>1. Plan Selection (Radio → Show/Hide)</h2>
    <p>Selecting a radio button reveals the corresponding content panel.</p>

    <Plan>
      <div class={styles.planOptions}>
        <label>
          <Plan.Trigger value="free">
            <input type="radio" name="plan" value="free" checked />
          </Plan.Trigger>
          Free
        </label>
        <label>
          <Plan.Trigger value="pro">
            <input type="radio" name="plan" value="pro" />
          </Plan.Trigger>
          Pro
        </label>
        <label>
          <Plan.Trigger value="enterprise">
            <input type="radio" name="plan" value="enterprise" />
          </Plan.Trigger>
          Enterprise
        </label>
      </div>

      <Plan.Show when="free">
        <div class={styles.planDetail}>
          <h3>Free Plan</h3>
          <p>Up to 3 projects, basic features.</p>
        </div>
      </Plan.Show>
      <Plan.Show when="pro">
        <div class={styles.planDetail}>
          <h3>Pro Plan</h3>
          <p>Unlimited projects, priority support.</p>
        </div>
      </Plan.Show>
      <Plan.Show when="enterprise">
        <div class={styles.planDetail}>
          <h3>Enterprise Plan</h3>
          <p>Custom SLA, dedicated account manager.</p>
        </div>
      </Plan.Show>
    </Plan>

    {/* ── Section 2: Form validity ─────────────────────────────── */}
    <h2>2. Form Validity (valid/invalid → Show/Hide)</h2>
    <p>
      The submit button is disabled until the form is valid. Error messages
      appear when fields are invalid.
    </p>

    <FormValidity tag="form">
      <div>
        <label>
          Email:
          <input type="email" required placeholder="you@example.com" />
        </label>
      </div>
      <div>
        <label>
          Name:
          <input type="text" required minlength={2} placeholder="Your name" />
        </label>
      </div>

      <FormValidity.Show when="invalid">
        <p class={styles.validationError}>
          Please fill in all fields correctly.
        </p>
      </FormValidity.Show>

      <FormValidity.Disable when="invalid">
        <button type="submit">Submit</button>
      </FormValidity.Disable>
    </FormValidity>

    {/* ── Section 3: Confirm checkbox (Disable/Enable) ─────────── */}
    <h2>3. Confirm Checkbox (Disable / Enable)</h2>
    <p>
      Demonstrates both <code>Disable</code> and <code>Enable</code> effects
      based on checkbox state.
    </p>

    <Confirm>
      <label>
        <Confirm.Trigger value="checked">
          <input type="checkbox" />
        </Confirm.Trigger>
        I agree to the terms
      </label>

      <Confirm.Disable when="unchecked">
        <button type="submit" class="outline">
          Submit (Disable)
        </button>
      </Confirm.Disable>

      <Confirm.Disable when="checked">
        <button type="submit">Submit (Disable on check)</button>
      </Confirm.Disable>

      <p class={styles.animationNote}>
        Uncheck the box: first button disables, second enables. Check the box:
        first enables, second disables.
      </p>
    </Confirm>

    {/* ── Section 4: Focus-based show ──────────────────────────── */}
    <h2>4. Focus-Based Show</h2>
    <p>Helper text appears when the field is focused.</p>

    <FocusField>
      <label>
        Password:
        <FocusField.Trigger value="focused">
          <input type="password" placeholder="Enter password" />
        </FocusField.Trigger>
      </label>

      <FocusField.Show when="focused" animate="slide-down">
        <p class={styles.helperText}>
          Must be at least 8 characters with a number and special character.
        </p>
      </FocusField.Show>
    </FocusField>

    {/* ── Section 5: Typed color selection ─────────────────────── */}
    <h2>5. Typed Color Selection</h2>
    <p>
      The <code>when</code> prop is restricted to <code>"red" | "blue"</code>.
    </p>

    <Color>
      <div class={styles.planOptions}>
        <label>
          <Color.Trigger value="red">
            <input type="radio" name="color" value="red" checked />
          </Color.Trigger>
          Red
        </label>
        <label>
          <Color.Trigger value="blue">
            <input type="radio" name="color" value="blue" />
          </Color.Trigger>
          Blue
        </label>
      </div>

      <Color.Show when="red">
        <p class={styles.colorSwatch} style={{ backgroundColor: "#e74c3c" }}>
          Red selected
        </p>
      </Color.Show>
      <Color.Show when="blue">
        <p class={styles.colorSwatch} style={{ backgroundColor: "#3498db" }}>
          Blue selected
        </p>
      </Color.Show>
    </Color>

    {/* ── Section 6: Animation presets ─────────────────────────── */}
    <h2>6. Animation Presets</h2>
    <p>Animated transitions use opacity/visibility instead of display:none.</p>

    <AnimatedPlan>
      <div class={styles.planOptions}>
        <label>
          <AnimatedPlan.Trigger value="free">
            <input type="radio" name="anim-plan" value="free" checked />
          </AnimatedPlan.Trigger>
          Free
        </label>
        <label>
          <AnimatedPlan.Trigger value="pro">
            <input type="radio" name="anim-plan" value="pro" />
          </AnimatedPlan.Trigger>
          Pro
        </label>
      </div>

      <AnimatedPlan.Show when="free" animate="fade">
        <div class={styles.planDetail}>
          <h3>Free (fade)</h3>
          <p>Fades in and out smoothly.</p>
        </div>
      </AnimatedPlan.Show>
      <AnimatedPlan.Show when="pro" animate="slide-up">
        <div class={styles.planDetail}>
          <h3>Pro (slide-up)</h3>
          <p>Slides up into view.</p>
        </div>
      </AnimatedPlan.Show>
    </AnimatedPlan>

    <hr />
    <p>
      <a href="/components">&larr; Back to Components</a>
    </p>
  </section>
);
