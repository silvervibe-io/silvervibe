import type { PreviewWorkspaceRole } from '@silvervibe/stores/preview';

export type WorkspaceToolView = {
  toolKey: string;
  enabled: boolean;
};

export type WorkspaceMembershipView = {
  id: string;
  name: string;
  slug: string;
  role: PreviewWorkspaceRole;
  tools: WorkspaceToolView[];
};

export type CreateWorkspaceInput = {
  name: string;
  slug: string;
};

export type CreateTeamInput = {
  name: string;
  slug: string;
};

export type SlackConnectionView = {
  status: 'DISCONNECTED' | 'PENDING' | 'CONNECTED' | 'ERROR';
  configured: boolean;
  authMode: 'oauth' | 'webhook' | null;
  channelLabel: string | null;
  toolEnabled: boolean;
  oauthAvailable: boolean;
};

export type SlackOAuthStartView = {
  authorizeUrl: string;
};

export type TeamsConnectionView = {
  status: 'DISCONNECTED' | 'PENDING' | 'CONNECTED' | 'ERROR';
  configured: boolean;
  authMode: 'oauth' | 'webhook' | null;
  channelLabel: string | null;
  needsChannel: boolean;
  toolEnabled: boolean;
  oauthAvailable: boolean;
};

export type TeamsOAuthStartView = {
  authorizeUrl: string;
};

export type TeamsGraphTeamView = {
  id: string;
  displayName: string;
};

export type TeamsGraphChannelView = {
  id: string;
  displayName: string;
};

export type SelectTeamsChannelInput = {
  teamId: string;
  channelId: string;
  channelLabel?: string;
};

export type WorkspaceState = {
  memberships: WorkspaceMembershipView[];
  selectedWorkspaceId: string | null;
  loading: boolean;
  error: string | null;
};

export const WORKSPACE_INITIAL_STATE: WorkspaceState = {
  memberships: [],
  selectedWorkspaceId: null,
  loading: false,
  error: null,
};
