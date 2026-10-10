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
  apiBaseUrl: 'https://api.silvervibe.io/api',
};
