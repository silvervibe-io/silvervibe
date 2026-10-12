import { InjectionToken } from '@angular/core';

/** Base URL for Nest API calls (e.g. `/api` or `https://api.silvervibe.io/api`). */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
