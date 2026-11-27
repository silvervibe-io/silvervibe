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
      productTitle: 'VibeMeeting',
      blurbKey: 'auth.signIn.blurb.meeting',
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
      productTitle: 'VibeMeeting',
    },
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/vibemeeting/pages/meeting').then(
        (m) => m.MeetingList,
      ),
  },
  {
    path: 'app/create',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/vibemeeting/pages/meeting').then(
        (m) => m.MeetingCreate,
      ),
  },
  {
    path: 'app/meetings/:meetingId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/vibemeeting/pages/meeting').then(
        (m) => m.MeetingDetail,
      ),
  },
  {
    path: '**',
    redirectTo: 'app',
  },
];
