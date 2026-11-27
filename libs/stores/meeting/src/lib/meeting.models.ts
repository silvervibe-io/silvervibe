export type MeetingStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type MeetingEditPolicy =
  | 'CREATOR_OR_ADMIN'
  | 'CREATOR_ONLY'
  | 'ANY_INVITEE';
export type MeetingClosePolicy =
  | 'CREATOR_OR_ADMIN'
  | 'CREATOR_ONLY'
  | 'ANY_INVITEE';

export type MeetingSummaryView = {
  id: string;
  workspaceId: string;
  title: string;
  context: string | null;
  status: MeetingStatus;
  editPolicy: MeetingEditPolicy;
  closePolicy: MeetingClosePolicy;
  scheduledAt: string | null;
  createdById: string;
  createdAt: string;
  inviteCount: number;
  agendaCount: number;
  decisionCount: number;
  actionCount: number;
};

export type MeetingInviteView = {
  userId: string;
  email: string | null;
  displayName: string | null;
};

export type MeetingAgendaItemView = {
  id: string;
  body: string;
  sortOrder: number;
};

export type MeetingDecisionView = {
  id: string;
  body: string;
  sortOrder: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type MeetingActionView = {
  id: string;
  body: string;
  assigneeId: string | null;
  done: boolean;
  sortOrder: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type MeetingDetailView = MeetingSummaryView & {
  recap: string | null;
  invites: MeetingInviteView[];
  agendaItems: MeetingAgendaItemView[];
  decisions: MeetingDecisionView[];
  actions: MeetingActionView[];
  canEditNotes: boolean;
  canClose: boolean;
  canEditSettings: boolean;
};

export type CreateMeetingInput = {
  title: string;
  context?: string | null;
  agendaItems: string[];
  editPolicy: MeetingEditPolicy;
  closePolicy: MeetingClosePolicy;
  scheduledAt?: string | null;
  inviteUserIds: string[];
};

export type SetDecisionsInput = {
  decisions: Array<{ body: string }>;
};

export type SetActionsInput = {
  actions: Array<{ body: string; assigneeId?: string | null; done?: boolean }>;
};

export type WorkspaceMemberView = {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
};

export type MeetingState = {
  meetings: MeetingSummaryView[];
  selected: MeetingDetailView | null;
  members: WorkspaceMemberView[];
  loading: boolean;
  error: string | null;
};

export const MEETING_INITIAL_STATE: MeetingState = {
  meetings: [],
  selected: null,
  members: [],
  loading: false,
  error: null,
};
