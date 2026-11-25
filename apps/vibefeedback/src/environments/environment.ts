import { firebaseWeb } from './firebase-web.local';
import { growthbook } from './growthbook.local';
import { previewSwitcherEmails } from './preview-switcher.local';
import { publicUrls } from './public-urls.local';

export const environment = {
  production: false,
  firebase: firebaseWeb,
  growthbook,
  previewSwitcherEmails: [...previewSwitcherEmails],
  apiBaseUrl: publicUrls.apiBaseUrl,
};
