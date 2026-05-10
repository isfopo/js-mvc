import type { FC } from "hono/jsx";
import type { TenetFormViewModel } from "../view-model";
import styles from "./new.module.css";

export const View: FC<TenetFormViewModel> = ({ validationErrors }) => (
  <section>
    <hgroup>
      <h1>Propose a Tenet</h1>
      <p>Record an architecture decision for your team to review.</p>
    </hgroup>

    <form method="post" action="/tenets">
      <label for="title">Title</label>
      <input
        id="title"
        name="title"
        type="text"
        required
        aria-invalid={validationErrors?.title ? "true" : undefined}
      />
      {validationErrors?.title && <small>{validationErrors.title}</small>}

      <label for="context">Context</label>
      <textarea
        id="context"
        name="context"
        rows={5}
        required
        aria-invalid={validationErrors?.context ? "true" : undefined}
        placeholder="What problem are you trying to solve? What constraints exist?"
      />
      {validationErrors?.context && <small>{validationErrors.context}</small>}

      <fieldset>
        <legend>Options</legend>
        <p>
          <small>Each option represents a possible choice. Add pros and cons for each.</small>
        </p>

        <article class={styles.optionCard}>
          <label for="opt-0-title">Option 1 title</label>
          <input id="opt-0-title" name="options[0][title]" type="text" required />

          <label for="opt-0-desc">Description</label>
          <textarea id="opt-0-desc" name="options[0][description]" rows={2} />

          <div class={styles.prosConsGrid}>
            <label for="opt-0-pros">
              Pros
              <textarea id="opt-0-pros" name="options[0][pros]" rows={3} />
            </label>
            <label for="opt-0-cons">
              Cons
              <textarea id="opt-0-cons" name="options[0][cons]" rows={3} />
            </label>
          </div>
        </article>

        {validationErrors?.options && <small>{validationErrors.options}</small>}
      </fieldset>

      <button type="submit">Create Tenet</button>
    </form>
  </section>
);
