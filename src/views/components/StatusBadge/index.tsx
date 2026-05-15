import type { FC } from "hono/jsx";
import type { TenetStatus } from "db/tenet/model";
import styles from "./index.module.css";

const LABELS: Record<TenetStatus, string> = {
  draft: "Draft",
  voting: "Voting",
  accepted: "Accepted",
  rejected: "Rejected",
  implemented: "Implemented",
  superseded: "Superseded",
};

interface Props {
  status: TenetStatus;
}

export const StatusBadge: FC<Props> = ({ status }) => (
  <span class={styles[status]}>
    {LABELS[status]}
  </span>
);
