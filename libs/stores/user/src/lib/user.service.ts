import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { CustomTokenDto } from '@silvervibe/shared/api-client';
import { AuthDataService } from '@silvervibe/shared/api-client/api/auth-data.service';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import { firstValueFrom } from 'rxjs';
import type { UserProfile } from './user.models';

export type UserDayHours = {
  enabled: boolean;
  start: string;
  end: string;
};

export type UserWeekSchedule = {
  mon: UserDayHours;
  tue: UserDayHours;
  wed: UserDayHours;
  thu: UserDayHours;
  fri: UserDayHours;
  sat: UserDayHours;
  sun: UserDayHours;
};

export type UserSchedule = {
  timezone: string;
  workHours: UserWeekSchedule;
};

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly authApi = inject(AuthDataService);
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  getMe(): Promise<UserProfile> {
    return firstValueFrom(this.authApi.usersControllerMe());
  }

  createCustomToken(): Promise<CustomTokenDto> {
    return firstValueFrom(this.authApi.authHandoffControllerCustomToken());
  }

  getSchedule(): Promise<UserSchedule> {
    return firstValueFrom(
      this.http.get<UserSchedule>(`${this.apiBase}/me/schedule`),
    );
  }

  updateSchedule(body: UserSchedule): Promise<UserSchedule> {
    return firstValueFrom(
      this.http.patch<UserSchedule>(`${this.apiBase}/me/schedule`, body),
    );
  }
}
