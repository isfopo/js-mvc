import type { FC } from "hono/jsx";
import type { TenetDetailViewModel } from "../view-model";
import { StatusBadge } from "../../../components/StatusBadge";
import { UserAvatar } from "../../../components/UserAvatar";

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
  { value: "approve", label: "Approve", style: "primary" },
  { value: "abstain", label: "Abstain", style: "secondary outline" },
  { value: "block", label: "Block", style: "outline" },
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
    <header style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap;">
      <StatusBadge status={tenet.status} />
      <span style="font-size: 0.85rem; color: var(--pico-muted-color);">
        Proposed by {tenet.proposedBy.login} on {new Date(tenet.createdAt).toLocaleDateString()}
      </span>
    </header>

    <h1>{tenet.title}</h1>

    {tenet.decision && (
      <article style="border-left: 3px solid var(--pico-success-color); padding-left: 1rem;">
        <strong>Decision:</strong> {tenet.decision}
        {tenet.rationale && <p style="margin-top: 0.5rem;"><strong>Rationale:</strong> {tenet.rationale}</p>}
      </article>
    )}

    <hgroup>
      <h2>Context</h2>
      <p>{tenet.context}</p>
    </hgroup>

    <h2>Options</h2>
    {tenet.options.map((opt, i) => (
      <article key={opt.id}>
        <h3>{opt.title}</h3>
        {opt.description && <p>{opt.description}</p>}
        {opt.pros && (
          <details>
            <summary>Pros</summary>
            <p style="color: var(--pico-success-color);">{opt.pros}</p>
          </details>
        )}
        {opt.cons && (
          <details>
            <summary>Cons</summary>
            <p style="color: var(--pico-error-color);">{opt.cons}</p>
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
            {userVote.reason && <span> — {userVote.reason}</span>}
          </p>
        ) : null}
        <form method="post" action={`/tenets/${tenet.slug}/vote`}>
          <input type="hidden" name="choice" />
          <input type="hidden" name="reason" />
          <div style="display: flex; gap: 0.5rem;">
            {VOTE_CHOICES.map((vc) => (
              <button
                type="submit"
                class={vc.style}
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
      <p style="color: var(--pico-muted-color);">No votes yet.</p>
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
              <td style="display: flex; align-items: center; gap: 0.5rem;">
                <UserAvatar login={v.user.login} avatarUrl={v.user.avatarUrl} />
                {v.user.login}
              </td>
              <td>
                <span
                  style={`font-weight: 600; ${
                    v.choice === "approve"
                      ? "color: var(--pico-success-color);"
                      : v.choice === "block"
                      ? "color: var(--pico-error-color);"
                      : ""
                  }`}
                >
                  {v.choice}
                </span>
              </td>
              <td>{v.reason ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}

    {canTransition && (
      <div style="display: flex; gap: 0.5rem; margin-top: 2rem;">
        {STATUS_TRANSITIONS[tenet.status]?.filter((t) => allowedTransitions.includes(t.target as any)).map((t) => (
          <form method="post" action={`/tenets/${tenet.slug}/status`} style="display: inline;">
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
