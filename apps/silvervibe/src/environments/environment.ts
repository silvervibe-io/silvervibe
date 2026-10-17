import { firebaseWeb } from './firebase-web.local';
import { growthbook } from './growthbook.local';
import { previewSwitcherEmails } from './preview-switcher.local';

export const environment = {
  production: false,
  firebase: firebaseWeb,
  growthbook,
  previewSwitcherEmails: [...previewSwitcherEmails],
  apiBaseUrl: '/api',
  /** Local vibestandup serve origin for portal handoff / tool links. */
  standupAppOrigin: 'http://localhost:4201',
};
