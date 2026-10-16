import { Route } from '@angular/router';
import { authGuard } from '@silvervibe/shared/auth';

/**
 * Home is the marketing landing from `@silvervibe/vibestandup/pages/home`.
 * Auth routes stay available for sign-in. Unknown URLs fall back to `/`.
 */
export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('@silvervibe/vibestandup/pages/home').then((m) => m.Home),
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('@silvervibe/shared/feature-auth').then((m) => m.SignIn),
    data: {
      productTitle: 'Vibe Standup',
      blurbKey: 'auth.signIn.blurb.standup',
    },
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/shared/feature-auth').then((m) => m.Account),
    data: {
      productTitle: 'Vibe Standup',
    },
  },
  {
    path: '**',
    redirectTo: '',
  },
];
