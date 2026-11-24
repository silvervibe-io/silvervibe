import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import { firstValueFrom } from 'rxjs';
import type {
  CreatePollInput,
  PollDetailView,
  PollResultsView,
  PollSummaryView,
  WorkspaceMemberView,
} from './poll.models';

@Injectable({ providedIn: 'root' })
export class PollService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listMembers(workspaceId: string): Promise<WorkspaceMemberView[]> {
    return firstValueFrom(
      this.http.get<WorkspaceMemberView[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/members`,
      ),
    );
  }

  listPolls(workspaceId: string): Promise<PollSummaryView[]> {
    return firstValueFrom(
      this.http.get<PollSummaryView[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/polls`,
      ),
    );
  }

  createPoll(
    workspaceId: string,
    input: CreatePollInput,
  ): Promise<PollDetailView> {
    return firstValueFrom(
      this.http.post<PollDetailView>(
        `${this.baseUrl}/workspaces/${workspaceId}/polls`,
        {
          question: input.question,
          options: input.options,
          allowMulti: input.allowMulti,
          startsAt: input.startsAt || undefined,
          endsAt: input.endsAt || undefined,
          inviteUserIds: input.inviteUserIds,
        },
      ),
    );
  }

  getPoll(pollId: string): Promise<PollDetailView> {
    return firstValueFrom(
      this.http.get<PollDetailView>(`${this.baseUrl}/polls/${pollId}`),
    );
  }

  closePoll(pollId: string): Promise<PollDetailView> {
    return firstValueFrom(
      this.http.post<PollDetailView>(
        `${this.baseUrl}/polls/${pollId}/close`,
        {},
      ),
    );
  }

  vote(pollId: string, optionIds: string[]): Promise<PollDetailView> {
    return firstValueFrom(
      this.http.post<PollDetailView>(`${this.baseUrl}/polls/${pollId}/vote`, {
        optionIds,
      }),
    );
  }

  results(pollId: string): Promise<PollResultsView> {
    return firstValueFrom(
      this.http.get<PollResultsView>(`${this.baseUrl}/polls/${pollId}/results`),
    );
  }
}
