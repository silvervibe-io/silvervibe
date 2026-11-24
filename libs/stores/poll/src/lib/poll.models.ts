export type PollStatus = 'DRAFT' | 'OPEN' | 'CLOSED';

export type PollSummaryView = {
  id: string;
  workspaceId: string;
  question: string;
  allowMulti: boolean;
  status: PollStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdById: string;
  createdAt: string;
  optionCount: number;
  inviteCount: number;
  hasVoted: boolean;
};

export type PollOptionView = {
  id: string;
  label: string;
  sortOrder: number;
};

export type PollInviteView = {
  userId: string;
  email: string | null;
  displayName: string | null;
};

export type PollDetailView = PollSummaryView & {
  options: PollOptionView[];
  invites: PollInviteView[];
  myOptionIds: string[];
  canVote: boolean;
  canClose: boolean;
  canSeeResults: boolean;
};

export type PollResultOptionView = {
  optionId: string;
  label: string;
  voteCount: number;
};

export type PollResultsView = {
  pollId: string;
  totalBallots: number;
  options: PollResultOptionView[];
};

export type WorkspaceMemberView = {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
};

export type CreatePollInput = {
  question: string;
  options: string[];
  allowMulti: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  inviteUserIds: string[];
};

export type PollState = {
  polls: PollSummaryView[];
  selected: PollDetailView | null;
  results: PollResultsView | null;
  members: WorkspaceMemberView[];
  loading: boolean;
  error: string | null;
};

export const POLL_INITIAL_STATE: PollState = {
  polls: [],
  selected: null,
  results: null,
  members: [],
  loading: false,
  error: null,
};
