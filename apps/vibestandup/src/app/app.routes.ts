import { Route } from '@angular/router';
import { authGuard } from '@silvervibe/shared/auth';

/**
 * Marketing home + authenticated product workspace.
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
      accountPath: '/app',
    },
  },
  {
    path: 'auth/handoff',
    loadComponent: () =>
      import('@silvervibe/shared/feature-auth').then((m) => m.AuthHandoff),
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
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/vibestandup/pages/my-standup').then(
        (m) => m.MyStandup,
      ),
  },
  {
    path: 'app/team',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/vibestandup/pages/team-admin').then(
        (m) => m.TeamAdmin,
      ),
  },
  {
    path: 'app/workspace',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/vibestandup/pages/workspace-admin').then(
        (m) => m.WorkspaceAdmin,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
