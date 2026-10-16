import { InjectionToken } from '@angular/core';

/** Origin of the VibeStandup app (e.g. https://standup.silvervibe.io). */
export const STANDUP_APP_ORIGIN = new InjectionToken<string>(
  'STANDUP_APP_ORIGIN',
);
