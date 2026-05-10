import type { FC } from "hono/jsx";
import type { TenetListViewModel } from "../view-model";
import { TenetCard } from "../../../components/TenetCard";

export const View: FC<TenetListViewModel> = ({ tenets, currentUser }) => (
  <section>
    <header style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
      <hgroup>
        <h1>Decisions</h1>
        <p>Architecture decision records for your team.</p>
      </hgroup>
      <a href="/tenets/new" role="button">Propose</a>
    </header>

    {tenets.length === 0 ? (
      <article style="text-align: center; padding: 3rem 1rem; color: var(--pico-muted-color);">
        <p style="font-size: 1.2rem; margin-bottom: 1rem;">No tenets yet.</p>
        <p>Propose the first architecture decision for your team.</p>
        <a href="/tenets/new" role="button" style="margin-top: 1rem;">
          Propose a Tenet
        </a>
      </article>
    ) : (
      <div style="display: grid; gap: 1rem;">
        {tenets.map((t) => (
          <TenetCard tenet={t} />
        ))}
      </div>
    )}
  </section>
);
