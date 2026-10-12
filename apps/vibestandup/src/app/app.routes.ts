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
    loadComponent: () =>
      import('@silvervibe/shared/feature-auth').then((m) => m.SignIn),
    data: {
      productTitle: 'Vibe Standup',
      blurb:
        'Foundation auth for local API calls. Not linked from the home standup.',
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
