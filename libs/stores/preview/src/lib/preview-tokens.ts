import { InjectionToken, type Signal } from '@angular/core';

/** Allowlisted emails (lowercase) that may see the role/tier preview switcher. */
export const PREVIEW_SWITCHER_EMAILS = new InjectionToken<readonly string[]>(
  'PREVIEW_SWITCHER_EMAILS',
  { factory: () => [] },
);

/**
 * Current signed-in email as a signal (wired from AuthService in app config).
 * Kept as a token so this util lib does not depend on type:data-access auth.
 */
export const PREVIEW_SWITCHER_USER_EMAIL = new InjectionToken<
  Signal<string | null>
>('PREVIEW_SWITCHER_USER_EMAIL');
