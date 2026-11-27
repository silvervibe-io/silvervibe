import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import { firstValueFrom } from 'rxjs';
import type {
  CreateMeetingInput,
  MeetingDetailView,
  MeetingSummaryView,
  SetActionsInput,
  SetDecisionsInput,
  WorkspaceMemberView,
} from './meeting.models';

@Injectable({ providedIn: 'root' })
export class MeetingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listMembers(workspaceId: string): Promise<WorkspaceMemberView[]> {
    return firstValueFrom(
      this.http.get<WorkspaceMemberView[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/meeting-members`,
      ),
    );
  }

  listMeetings(workspaceId: string): Promise<MeetingSummaryView[]> {
    return firstValueFrom(
      this.http.get<MeetingSummaryView[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/meetings`,
      ),
    );
  }

  createMeeting(
    workspaceId: string,
    input: CreateMeetingInput,
  ): Promise<MeetingDetailView> {
    return firstValueFrom(
      this.http.post<MeetingDetailView>(
        `${this.baseUrl}/workspaces/${workspaceId}/meetings`,
        {
          title: input.title,
          context: input.context || undefined,
          agendaItems: input.agendaItems,
          editPolicy: input.editPolicy,
          closePolicy: input.closePolicy,
          scheduledAt: input.scheduledAt || undefined,
          inviteUserIds: input.inviteUserIds,
        },
      ),
    );
  }

  getMeeting(meetingId: string): Promise<MeetingDetailView> {
    return firstValueFrom(
      this.http.get<MeetingDetailView>(`${this.baseUrl}/meetings/${meetingId}`),
    );
  }

  setDecisions(
    meetingId: string,
    input: SetDecisionsInput,
  ): Promise<MeetingDetailView> {
    return firstValueFrom(
      this.http.put<MeetingDetailView>(
        `${this.baseUrl}/meetings/${meetingId}/decisions`,
        input,
      ),
    );
  }

  setActions(
    meetingId: string,
    input: SetActionsInput,
  ): Promise<MeetingDetailView> {
    return firstValueFrom(
      this.http.put<MeetingDetailView>(
        `${this.baseUrl}/meetings/${meetingId}/actions`,
        input,
      ),
    );
  }

  close(meetingId: string, recap?: string): Promise<MeetingDetailView> {
    return firstValueFrom(
      this.http.post<MeetingDetailView>(
        `${this.baseUrl}/meetings/${meetingId}/close`,
        { recap },
      ),
    );
  }
}
