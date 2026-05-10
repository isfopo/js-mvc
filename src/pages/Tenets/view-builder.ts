import type { UserRow } from "../../data/models/user";
import type { TenetDetail, TenetSummary } from "../../services/TenetsService";
import type { TenetStatus } from "../../data/models/tenet";
import type {
  TenetListViewModel,
  TenetDetailViewModel,
} from "./view-model";

function toUserInfo(user: UserRow) {
  return {
    id: user.id,
    login: user.login,
    avatarUrl: user.avatar_url,
    name: user.name,
  };
}

export const viewBuilder = {
  index(tenets: TenetSummary[], currentUser: UserRow): TenetListViewModel {
    return { tenets, currentUser: toUserInfo(currentUser) };
  },

  show(
    tenet: TenetDetail,
    currentUser: UserRow,
  ): TenetDetailViewModel {
    const userVote = tenet.votes.find((v) => v.userId === currentUser.id) ?? null;
    const canVote = tenet.status === "voting";
    const isProposer = tenet.proposedBy.id === currentUser.id;

    const allowedTransitions = allowedTransitionsFor(tenet.status, isProposer);

    return {
      tenet,
      currentUser: toUserInfo(currentUser),
      userVote,
      canVote,
      canTransition: allowedTransitions.length > 0,
      allowedTransitions,
    };
  },
};

const STATUS_FLOW: Record<TenetStatus, { to: TenetStatus[]; needsProposer: boolean }> = {
  draft:        { to: ["voting"],              needsProposer: true },
  voting:       { to: ["accepted", "rejected"], needsProposer: true },
  accepted:     { to: ["implemented", "superseded"], needsProposer: false },
  rejected:     { to: [],                       needsProposer: false },
  implemented:  { to: ["superseded"],           needsProposer: false },
  superseded:   { to: [],                       needsProposer: false },
};

function allowedTransitionsFor(
  status: TenetStatus,
  isProposer: boolean,
): TenetStatus[] {
  const flow = STATUS_FLOW[status];
  if (!flow) return [];
  if (flow.needsProposer && !isProposer) return [];
  return flow.to;
}
