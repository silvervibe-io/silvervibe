import { firebaseWeb } from './firebase-web.local';
import { growthbook } from './growthbook.local';

export const environment = {
  production: false,
  firebase: firebaseWeb,
  growthbook,
  apiBaseUrl: '/api',
};
