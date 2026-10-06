import { Route } from '@angular/router';

/**
 * Public `main` / production: keep feature routes off until ready to ship.
 * Add screens on `develop`; do not link them from the landing until launch.
 * Unknown URLs fall back to `/` (landing lives on `App`, not a child route).
 */
export const appRoutes: Route[] = [
  {
    path: '**',
    redirectTo: '',
  },
];
