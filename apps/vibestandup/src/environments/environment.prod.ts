export const environment = {
  production: true,
  firebase: {
    // Inject at build/deploy time. Do not commit real apiKey.
    apiKey: '',
    authDomain: '',
    projectId: '',
    appId: '',
  },
  growthbook: {
    clientKey: '',
    apiHost: 'https://cdn.growthbook.io',
  },
  /** Empty in production builds — preview switcher stays hidden. */
  previewSwitcherEmails: [] as string[],
  apiBaseUrl: 'https://api.silvervibe.io/api',
};
