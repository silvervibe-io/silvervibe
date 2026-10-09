export const environment = {
  production: false,
  firebase: {
    // Fill locally from `.env` (FIREBASE_*). Do not commit real apiKey — GitHub secret scanning flags it.
    apiKey: '',
    authDomain: '',
    projectId: '',
    appId: '',
  },
  growthbook: {
    clientKey: '',
    apiHost: 'https://cdn.growthbook.io',
  },
  apiBaseUrl: '/api',
};
