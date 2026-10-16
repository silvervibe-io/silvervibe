import { Route } from '@angular/router';
import { authGuard } from '@silvervibe/shared/auth';

/**
 * Public marketing + signed-in portal. Unknown URLs fall back to `/`.
 */
export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('@silvervibe/pages/home').then((m) => m.Home),
  },
  {
    path: 'about',
    loadComponent: () => import('@silvervibe/pages/about').then((m) => m.About),
  },
  {
    path: 'tools/vibestandup',
    loadComponent: () =>
      import('@silvervibe/pages/tools-vibestandup').then(
        (m) => m.ToolsVibestandup,
      ),
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('@silvervibe/shared/feature-auth').then((m) => m.SignIn),
    data: {
      productTitle: 'Silver Vibe',
      blurbKey: 'auth.signIn.blurb.platform',
      accountPath: '/portal',
    },
  },
  {
    path: 'portal',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@silvervibe/pages/portal').then((m) => m.Portal),
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
