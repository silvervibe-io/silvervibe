import { inject, Injectable } from '@angular/core';
import type { CustomTokenDto } from '@silvervibe/shared/api-client';
import { AuthDataService } from '@silvervibe/shared/api-client/api/auth-data.service';
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
