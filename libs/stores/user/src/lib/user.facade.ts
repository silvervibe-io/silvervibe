import { inject, Injectable } from '@angular/core';
import type { CustomTokenDto } from '@silvervibe/shared/api-client';
import { UserService } from './user.service';
import { UserStore } from './user.store';

/**
 * Public API for user profile + auth handoff.
 * Components should inject this facade, not the store or HTTP client.
 */
@Injectable({ providedIn: 'root' })
export class UserFacade {
  private readonly store = inject(UserStore);
  private readonly api = inject(UserService);

  readonly profile = this.store.profile;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  loadMe(): Promise<void> {
    return this.store.loadMe();
  }

  clear(): void {
    this.store.clear();
  }

  createCustomToken(): Promise<CustomTokenDto> {
    return this.api.createCustomToken();
  }
}
