import { firebaseWeb } from './firebase-web.local';

export const environment = {
  production: false,
  firebase: firebaseWeb,
  growthbook: {
    clientKey: '',
    apiHost: 'https://cdn.growthbook.io',
  },
  apiBaseUrl: '/api',
};
