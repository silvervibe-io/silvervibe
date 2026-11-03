import { Route } from '@angular/router';
import { authGuard } from '@silvervibe/shared/auth';
import { standupAreaGuard } from './standup-access.guard';

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
      accountPath: '/app?enter=1',
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
    canActivate: [authGuard, standupAreaGuard],
    data: { standupArea: 'team' },
    loadComponent: () =>
      import('@silvervibe/vibestandup/pages/team-admin').then(
        (m) => m.TeamAdmin,
      ),
  },
  {
    path: 'app/workspace',
    canActivate: [authGuard, standupAreaGuard],
    data: { standupArea: 'workspace' },
    loadComponent: () =>
      import('@silvervibe/vibestandup/pages/workspace-admin').then(
        (m) => m.WorkspaceAdmin,
      ),
  },
  {
    path: 'invite/:token',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/vibestandup/pages/team-admin').then(
        (m) => m.InviteAccept,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
