import type { FC } from "hono/jsx";
import type { TenetDetailViewModel } from "../view-model";
import { StatusBadge } from "../../../components/StatusBadge";
import { UserAvatar } from "../../../components/UserAvatar";
import styles from "./show.module.css";

const STATUS_TRANSITIONS: Record<string, { label: string; target: string }[]> = {
  draft: [{ label: "Start Voting", target: "voting" }],
  voting: [
    { label: "Accept", target: "accepted" },
    { label: "Reject", target: "rejected" },
  ],
  accepted: [
    { label: "Mark Implemented", target: "implemented" },
    { label: "Supersede", target: "superseded" },
  ],
  implemented: [{ label: "Supersede", target: "superseded" }],
};

const VOTE_CHOICES = [
  { value: "approve", label: "Approve", class: "primary" },
  { value: "abstain", label: "Abstain", class: "secondary outline" },
  { value: "block", label: "Block", class: "outline" },
];

export const View: FC<TenetDetailViewModel> = ({
  tenet,
  currentUser,
  userVote,
  canVote,
  canTransition,
  allowedTransitions,
}) => (
  <section>
    <header>
      <StatusBadge status={tenet.status} />
      <small>
        Proposed by {tenet.proposedBy.login} on {new Date(tenet.createdAt).toLocaleDateString()}
      </small>
    </header>

    <h1>{tenet.title}</h1>

    {tenet.decision && (
      <article class={styles.decisionBox}>
        <strong>Decision:</strong> {tenet.decision}
        {tenet.rationale && <p><strong>Rationale:</strong> {tenet.rationale}</p>}
      </article>
    )}

    <hgroup>
      <h2>Context</h2>
      <p>{tenet.context}</p>
    </hgroup>

    <h2>Options</h2>
    {tenet.options.map((opt) => (
      <article key={opt.id}>
        <h3>{opt.title}</h3>
        {opt.description && <p>{opt.description}</p>}
        {opt.pros && (
          <details>
            <summary>Pros</summary>
            <p>{opt.pros}</p>
          </details>
        )}
        {opt.cons && (
          <details>
            <summary>Cons</summary>
            <p>{opt.cons}</p>
          </details>
        )}
      </article>
    ))}

    {canVote && (
      <article>
        <h2>Vote</h2>
        {userVote ? (
          <p>
            You voted: <strong>{userVote.choice}</strong>
            {userVote.reason && <> &mdash; {userVote.reason}</>}
          </p>
        ) : null}
        <form method="post" action={`/tenets/${tenet.slug}/vote`}>
          <input type="hidden" name="choice" />
          <input type="hidden" name="reason" />
          <div class={styles.voteGroup}>
            {VOTE_CHOICES.map((vc) => (
              <button
                type="submit"
                class={vc.class}
                data-vote-choice={vc.value}
                data-controller="vote"
                data-action={`click->vote#submit`}
              >
                {vc.label}
              </button>
            ))}
          </div>
        </form>
      </article>
    )}

    <h2>Votes</h2>
    {tenet.votes.length === 0 ? (
      <p><small>No votes yet.</small></p>
    ) : (
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Choice</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {tenet.votes.map((v) => (
            <tr key={v.userId}>
              <td>
                <UserAvatar login={v.user.login} avatarUrl={v.user.avatarUrl} />
                {" "}{v.user.login}
              </td>
              <td><strong>{v.choice}</strong></td>
              <td>{v.reason ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}

    {canTransition && (
      <div class={styles.transitionGroup}>
        {STATUS_TRANSITIONS[tenet.status]
          ?.filter((t) => allowedTransitions.includes(t.target as any))
          .map((t) => (
            <form method="post" action={`/tenets/${tenet.slug}/status`} class={styles.inlineForm}>
              <input type="hidden" name="status" value={t.target} />
              <button
                type="submit"
                data-controller="status"
                data-action={`click->status#transition`}
                data-status-target={t.target}
                data-status-message={`Change status to ${t.target}?`}
              >
                {t.label}
              </button>
            </form>
          ))}
      </div>
    )}
  </section>
);
