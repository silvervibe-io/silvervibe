import { Route } from '@angular/router';
import { authGuard } from '@silvervibe/shared/auth';

/**
 * Public `main` / production: keep feature routes off the landing until ready.
 * `/auth` and `/account` are unlisted foundation routes (not linked from landing).
 * Unknown URLs fall back to `/`.
 */
export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./landing/landing').then((m) => m.Landing),
  },
  {
    path: 'auth',
    loadComponent: () => import('./auth/sign-in/sign-in').then((m) => m.SignIn),
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./auth/account/account').then((m) => m.Account),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
