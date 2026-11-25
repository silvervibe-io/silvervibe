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
      productTitle: 'VibeFeedback',
      blurbKey: 'auth.signIn.blurb.feedback',
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
      productTitle: 'VibeFeedback',
    },
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/vibefeedback/pages/feedback').then(
        (m) => m.FeedbackList,
      ),
  },
  {
    path: 'app/create',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/vibefeedback/pages/feedback').then(
        (m) => m.FeedbackCreate,
      ),
  },
  {
    path: 'app/requests/:requestId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/vibefeedback/pages/feedback').then(
        (m) => m.FeedbackDetail,
      ),
  },
  {
    path: '**',
    redirectTo: 'app',
  },
];
