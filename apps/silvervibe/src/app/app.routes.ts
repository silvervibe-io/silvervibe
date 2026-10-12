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
    loadComponent: () =>
      import('@silvervibe/shared/feature-auth').then((m) => m.SignIn),
    data: {
      productTitle: 'Silver Vibe',
      blurbKey: 'auth.signIn.blurb.platform',
    },
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/shared/feature-auth').then((m) => m.Account),
    data: {
      productTitle: 'Silver Vibe',
    },
  },
  {
    path: 'privacy',
    loadComponent: () => import('./privacy/privacy').then((m) => m.Privacy),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
