import type { FC } from "hono/jsx";
import type { TenetDetailViewModel } from "views/pages/Tenets/view-model";
import { Action } from "utils/Action";
import { StatusBadge } from "views/components/StatusBadge";
import styles from "./show.module.css";

const Vote = Action("vote");
const Status = Action("status");

const STATUS_TRANSITIONS: Record<string, { label: string; target: string; message: string }[]> = {
  draft: [{ label: "Start Voting", target: "voting", message: "Start voting on this tenet?" }],
  voting: [
    { label: "Accept", target: "accepted", message: "Accept this tenet?" },
    { label: "Reject", target: "rejected", message: "Reject this tenet?" },
  ],
  accepted: [
    { label: "Mark Implemented", target: "implemented", message: "Mark as implemented?" },
    { label: "Supersede", target: "superseded", message: "Supersede this tenet?" },
  ],
  implemented: [{ label: "Supersede", target: "superseded", message: "Supersede this tenet?" }],
};

const VOTE_CHOICES = [
  { value: "approve", label: "Approve", css: "primary" },
  { value: "abstain", label: "Abstain", css: "secondary outline" },
  { value: "block", label: "Block", css: "outline" },
];

export const View: FC<TenetDetailViewModel> = ({
  tenet,
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
            {userVote.reason && <span> &mdash; {userVote.reason}</span>}
          </p>
        ) : null}
        <form method="post" action={`/tenets/${tenet.slug}/vote`}>
          <input type="hidden" name="choice" />
          <input type="hidden" name="reason" />
          <div class={styles.voteGroup}>
            {VOTE_CHOICES.map((vc) => (
              <Vote.Trigger event="click" method="submit" choice={vc.value}>
                <button type="submit" class={vc.css}>{vc.label}</button>
              </Vote.Trigger>
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
              <td>{v.user.login}</td>
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
              <Status.Trigger event="click" method="transition" target={t.target} message={t.message}>
                <button type="submit">{t.label}</button>
              </Status.Trigger>
            </form>
          ))}
      </div>
    )}
  </section>
);
