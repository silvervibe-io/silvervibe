import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import { firstValueFrom } from 'rxjs';
import type {
  CreateFeedbackInput,
  FeedbackDetailView,
  FeedbackSummaryView,
  UpsertAnswersInput,
  WorkspaceMemberView,
} from './feedback.models';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listMembers(workspaceId: string): Promise<WorkspaceMemberView[]> {
    return firstValueFrom(
      this.http.get<WorkspaceMemberView[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/feedback-members`,
      ),
    );
  }

  listRequests(workspaceId: string): Promise<FeedbackSummaryView[]> {
    return firstValueFrom(
      this.http.get<FeedbackSummaryView[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/feedback-requests`,
      ),
    );
  }

  createRequest(
    workspaceId: string,
    input: CreateFeedbackInput,
  ): Promise<FeedbackDetailView> {
    return firstValueFrom(
      this.http.post<FeedbackDetailView>(
        `${this.baseUrl}/workspaces/${workspaceId}/feedback-requests`,
        {
          title: input.title,
          context: input.context || undefined,
          prompts: input.prompts,
          answerVisibility: input.answerVisibility,
          anonymous: input.anonymous,
          closePolicy: input.closePolicy,
          endsAt: input.endsAt || undefined,
          inviteUserIds: input.inviteUserIds,
        },
      ),
    );
  }

  getRequest(requestId: string): Promise<FeedbackDetailView> {
    return firstValueFrom(
      this.http.get<FeedbackDetailView>(
        `${this.baseUrl}/feedback-requests/${requestId}`,
      ),
    );
  }

  upsertAnswers(
    requestId: string,
    input: UpsertAnswersInput,
  ): Promise<FeedbackDetailView> {
    return firstValueFrom(
      this.http.put<FeedbackDetailView>(
        `${this.baseUrl}/feedback-requests/${requestId}/answers`,
        input,
      ),
    );
  }

  close(requestId: string, summary?: string): Promise<FeedbackDetailView> {
    return firstValueFrom(
      this.http.post<FeedbackDetailView>(
        `${this.baseUrl}/feedback-requests/${requestId}/close`,
        { summary },
      ),
    );
  }
}
