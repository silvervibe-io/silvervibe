import { Route } from '@angular/router';
import { authGuard } from '@silvervibe/shared/auth';

/**
 * Home stays the standup draft. `/auth` and `/account` are unlisted foundation
 * routes (not linked from home). Unknown URLs fall back to `/`.
 */
export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./home/home').then((m) => m.Home),
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
