import type { TenetDetail, TenetSummary, UserInfo } from "data/tenet/service";
import type { TenetStatus } from "data/tenet/model";

export type { TenetStatus, TenetDetail, TenetSummary, UserInfo };

export interface TenetListViewModel {
  tenets: TenetSummary[];
  currentUser: UserInfo;
}

export interface TenetDetailViewModel {
  tenet: TenetDetail;
  currentUser: UserInfo;
  userVote: { choice: string; reason: string | null } | null;
  canVote: boolean;
  canTransition: boolean;
  allowedTransitions: TenetStatus[];
}

export interface TenetFormViewModel {
  isEditing: boolean;
  tenet?: TenetDetail;
  validationErrors?: Record<string, string>;
}
