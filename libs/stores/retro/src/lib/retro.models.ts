export type RetroStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type RetroNoteVisibility =
  | 'LIVE'
  | 'PRIVATE_UNTIL_CLOSE'
  | 'AFTER_CONTRIBUTE';
export type RetroClosePolicy =
  | 'CREATOR_OR_ADMIN'
  | 'CREATOR_ONLY'
  | 'ANY_INVITEE';
export type RetroNoteColumn = 'WENT_WELL' | 'IMPROVE' | 'ACTIONS';

export type RetroSummaryView = {
  id: string;
  workspaceId: string;
  title: string;
  status: RetroStatus;
  noteVisibility: RetroNoteVisibility;
  closePolicy: RetroClosePolicy;
  endsAt: string | null;
  createdById: string;
  createdAt: string;
  inviteCount: number;
  noteCount: number;
  hasContributed: boolean;
};

export type RetroInviteView = {
  userId: string;
  email: string | null;
  displayName: string | null;
};

export type RetroNoteView = {
  id: string;
  column: RetroNoteColumn;
  body: string;
  authorId: string;
  authorDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
  mine: boolean;
};

export type RetroDetailView = RetroSummaryView & {
  summary: string | null;
  invites: RetroInviteView[];
  notes: RetroNoteView[];
  canAddNotes: boolean;
  canClose: boolean;
  canEditSettings: boolean;
};

export type CreateRetroInput = {
  title: string;
  noteVisibility: RetroNoteVisibility;
  closePolicy: RetroClosePolicy;
  endsAt?: string | null;
  inviteUserIds: string[];
};

export type UpsertNoteInput = {
  column: RetroNoteColumn;
  body: string;
};

export type WorkspaceMemberView = {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
};

export type RetroState = {
  retros: RetroSummaryView[];
  selected: RetroDetailView | null;
  members: WorkspaceMemberView[];
  loading: boolean;
  error: string | null;
};

export const RETRO_INITIAL_STATE: RetroState = {
  retros: [],
  selected: null,
  members: [],
  loading: false,
  error: null,
};
