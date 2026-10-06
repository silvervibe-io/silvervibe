export const TOOL_KEYS = {
  vibestandup: 'vibestandup',
  addonsSlack: 'addons.slack',
  addonsTeams: 'addons.teams',
  addonsJira: 'addons.jira',
  addonsLinear: 'addons.linear',
  addonsGithub: 'addons.github',
} as const;

export type ToolKey = (typeof TOOL_KEYS)[keyof typeof TOOL_KEYS];

export const FLAG_KEYS = {
  toolsVibestandupEnabled: 'tools.vibestandup.enabled',
  addonsGithubWebhooks: 'addons.github.webhooks',
} as const;

export type FlagKey = (typeof FLAG_KEYS)[keyof typeof FLAG_KEYS];
