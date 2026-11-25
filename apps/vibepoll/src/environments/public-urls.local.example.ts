/** Fallback stub. Prefer `npm run firebase:sync-web` from repo-root `.env`. */
export const publicUrls = {
  apiBaseUrl: '/api',
  standupAppOrigin: 'http://localhost:4201',
  pollAppOrigin: 'http://localhost:4202',
  retroAppOrigin: 'http://localhost:4203',
  feedbackAppOrigin: 'http://localhost:4204',
} as const;
