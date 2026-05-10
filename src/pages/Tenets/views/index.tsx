import type { FC } from "hono/jsx";

export const View: FC = () => (
  <section>
    <hgroup>
      <h1>Decisions</h1>
      <p>Architecture decision records for your team.</p>
    </hgroup>
    <p>No tenets yet. Propose the first one.</p>
    <a href="/tenets/new" role="button">Propose a Tenet</a>
  </section>
);
