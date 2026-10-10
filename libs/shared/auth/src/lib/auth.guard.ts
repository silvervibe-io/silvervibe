import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Requires a signed-in Firebase user; otherwise redirects to `/auth`. */
export const authGuard: CanActivateFn = async (_route, _state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  if (auth.user()) {
    return true;
  }
  return router.createUrlTree(['/auth']);
};
