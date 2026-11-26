import { InjectionToken } from '@angular/core';

/** Origin of the Silver Vibe portal (marketing + /portal hub). */
export const PORTAL_APP_ORIGIN = new InjectionToken<string>(
  'PORTAL_APP_ORIGIN',
);

/** Resolve portal origin for product shells (local :4200 or silvervibe.io). */
export function defaultPortalAppOrigin(): string {
  if (typeof window === 'undefined') {
    return 'https://silvervibe.io';
  }
  const { hostname, origin, port } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return port === '4200' ? origin : 'http://localhost:4200';
  }
  if (hostname === 'silvervibe.io' || hostname === 'www.silvervibe.io') {
    return origin;
  }
  return 'https://silvervibe.io';
}
