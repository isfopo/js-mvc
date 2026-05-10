import type { FC } from "hono/jsx";
import { StatusBadge } from "../StatusBadge";
import { UserAvatar } from "../UserAvatar";
import type { TenetSummary } from "../../services/TenetsService";

interface Props {
  tenet: TenetSummary;
}

export const TenetCard: FC<Props> = ({ tenet }) => (
  <article>
    <header style="display: flex; align-items: center; gap: 0.5rem; justify-content: space-between;">
      <StatusBadge status={tenet.status} />
      <span style="font-size: 0.8rem; color: var(--pico-muted-color);">
        {new Date(tenet.createdAt).toLocaleDateString()}
      </span>
    </header>
    <a href={`/tenets/${tenet.slug}`} style="text-decoration: none; color: inherit;">
      <h3 style="margin: 0.5rem 0;">{tenet.title}</h3>
    </a>
    <footer style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--pico-muted-color);">
      <UserAvatar login={tenet.proposedBy.login} avatarUrl={tenet.proposedBy.avatarUrl} />
      <span>{tenet.proposedBy.login}</span>
    </footer>
  </article>
);
