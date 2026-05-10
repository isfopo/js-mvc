import type { FC } from "hono/jsx";
import type { TenetFormViewModel } from "../view-model";

export const View: FC<TenetFormViewModel> = ({ validationErrors }) => (
  <section>
    <hgroup>
      <h1>Propose a Tenet</h1>
      <p>Record an architecture decision for your team to review.</p>
    </hgroup>

    <form method="post" action="/tenets">
      <div style="margin-bottom: 1rem;">
        <label for="title">Title</label>
        <input
          id="title"
          name="title"
          type="text"
          required
          aria-invalid={validationErrors?.title ? "true" : undefined}
        />
        {validationErrors?.title && (
          <small style="color: var(--pico-error-color);">{validationErrors.title}</small>
        )}
      </div>

      <div style="margin-bottom: 1rem;">
        <label for="context">Context</label>
        <textarea
          id="context"
          name="context"
          rows={5}
          required
          aria-invalid={validationErrors?.context ? "true" : undefined}
          placeholder="What problem are you trying to solve? What constraints exist?"
        />
        {validationErrors?.context && (
          <small style="color: var(--pico-error-color);">{validationErrors.context}</small>
        )}
      </div>

      <fieldset>
        <legend>Options</legend>
        <p style="font-size: 0.85rem; color: var(--pico-muted-color);">
          Each option represents a possible choice. Add pros and cons for each.
        </p>
        <div id="options-container">
          <div class="option-row" style="margin-bottom: 1rem; padding: 1rem; border: 1px solid var(--pico-muted-border-color); border-radius: var(--pico-border-radius);">
            <div style="margin-bottom: 0.5rem;">
              <label for="opt-0-title">Option 1 title</label>
              <input id="opt-0-title" name="options[0][title]" type="text" required />
            </div>
            <div style="margin-bottom: 0.5rem;">
              <label for="opt-0-desc">Description</label>
              <textarea id="opt-0-desc" name="options[0][description]" rows={2} />
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
              <div>
                <label for="opt-0-pros">Pros</label>
                <textarea id="opt-0-pros" name="options[0][pros]" rows={3} />
              </div>
              <div>
                <label for="opt-0-cons">Cons</label>
                <textarea id="opt-0-cons" name="options[0][cons]" rows={3} />
              </div>
            </div>
          </div>
        </div>
        {validationErrors?.options && (
          <small style="color: var(--pico-error-color);">{validationErrors.options}</small>
        )}
      </fieldset>

      <button type="submit">Create Tenet</button>
    </form>
  </section>
);
