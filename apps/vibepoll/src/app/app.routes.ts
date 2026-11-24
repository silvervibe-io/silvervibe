import { Route } from '@angular/router';
import { authGuard } from '@silvervibe/shared/auth';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'app',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('@silvervibe/shared/feature-auth').then((m) => m.SignIn),
    data: {
      productTitle: 'VibePoll',
      blurbKey: 'auth.signIn.blurb.poll',
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
      productTitle: 'VibePoll',
    },
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/vibepoll/pages/polls').then((m) => m.PollList),
  },
  {
    path: 'app/create',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/vibepoll/pages/polls').then((m) => m.PollCreate),
  },
  {
    path: 'app/polls/:pollId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/vibepoll/pages/polls').then((m) => m.PollDetail),
  },
  {
    path: '**',
    redirectTo: 'app',
  },
];
