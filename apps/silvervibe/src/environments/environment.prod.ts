import { firebaseWeb } from './firebase-web.local';
import { growthbook } from './growthbook.local';
import { previewSwitcherEmails } from './preview-switcher.local';
import { publicUrls } from './public-urls.local';

/**
 * Optional production shape (same locals as `environment.ts`).
 * Cloudflare Pages builds use `environment.ts` after `sync-firebase-web`.
 * Set `PUBLIC_API_URL` + `PUBLIC_STANDUP_URL` on the Pages project.
 */
export const environment = {
  production: true,
  firebase: firebaseWeb,
  growthbook,
  previewSwitcherEmails: [...previewSwitcherEmails],
  apiBaseUrl: publicUrls.apiBaseUrl,
  standupAppOrigin: publicUrls.standupAppOrigin,
};
