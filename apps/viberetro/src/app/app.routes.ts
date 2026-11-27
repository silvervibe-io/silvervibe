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
      productTitle: 'VibeRetro',
      blurbKey: 'auth.signIn.blurb.retro',
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
      productTitle: 'VibeRetro',
    },
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/viberetro/pages/retros').then((m) => m.RetroList),
  },
  {
    path: 'app/create',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/viberetro/pages/retros').then((m) => m.RetroCreate),
  },
  {
    path: 'app/retros/:retroId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/viberetro/pages/retros').then((m) => m.RetroBoard),
  },
  {
    path: '**',
    redirectTo: 'app',
  },
];
