import { firebaseWeb } from './firebase-web.local';
import { growthbook } from './growthbook.local';

export const environment = {
  production: false,
  firebase: firebaseWeb,
  growthbook,
  apiBaseUrl: '/api',
  /** Local vibestandup serve origin for portal handoff / tool links. */
  standupAppOrigin: 'http://localhost:4201',
};
