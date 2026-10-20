import { inject, Injectable } from '@angular/core';
import {
  AuthDataService,
  type CustomTokenDto,
} from '@silvervibe/shared/api-client';
import { firstValueFrom } from 'rxjs';
import type { UserProfile } from './user.models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly authApi = inject(AuthDataService);

  getMe(): Promise<UserProfile> {
    return firstValueFrom(this.authApi.usersControllerMe());
  }

  createCustomToken(): Promise<CustomTokenDto> {
    return firstValueFrom(this.authApi.authHandoffControllerCustomToken());
  }
}
