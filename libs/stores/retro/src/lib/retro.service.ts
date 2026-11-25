import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import { firstValueFrom } from 'rxjs';
import type {
  CreateRetroInput,
  RetroDetailView,
  RetroSummaryView,
  UpsertNoteInput,
  WorkspaceMemberView,
} from './retro.models';

@Injectable({ providedIn: 'root' })
export class RetroService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listMembers(workspaceId: string): Promise<WorkspaceMemberView[]> {
    return firstValueFrom(
      this.http.get<WorkspaceMemberView[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/retro-members`,
      ),
    );
  }

  listRetros(workspaceId: string): Promise<RetroSummaryView[]> {
    return firstValueFrom(
      this.http.get<RetroSummaryView[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/retros`,
      ),
    );
  }

  createRetro(
    workspaceId: string,
    input: CreateRetroInput,
  ): Promise<RetroDetailView> {
    return firstValueFrom(
      this.http.post<RetroDetailView>(
        `${this.baseUrl}/workspaces/${workspaceId}/retros`,
        {
          title: input.title,
          noteVisibility: input.noteVisibility,
          closePolicy: input.closePolicy,
          endsAt: input.endsAt || undefined,
          inviteUserIds: input.inviteUserIds,
        },
      ),
    );
  }

  getRetro(retroId: string): Promise<RetroDetailView> {
    return firstValueFrom(
      this.http.get<RetroDetailView>(`${this.baseUrl}/retros/${retroId}`),
    );
  }

  addNote(retroId: string, input: UpsertNoteInput): Promise<RetroDetailView> {
    return firstValueFrom(
      this.http.post<RetroDetailView>(
        `${this.baseUrl}/retros/${retroId}/notes`,
        input,
      ),
    );
  }

  updateNote(
    retroId: string,
    noteId: string,
    input: UpsertNoteInput,
  ): Promise<RetroDetailView> {
    return firstValueFrom(
      this.http.put<RetroDetailView>(
        `${this.baseUrl}/retros/${retroId}/notes/${noteId}`,
        input,
      ),
    );
  }

  deleteNote(retroId: string, noteId: string): Promise<RetroDetailView> {
    return firstValueFrom(
      this.http.delete<RetroDetailView>(
        `${this.baseUrl}/retros/${retroId}/notes/${noteId}`,
      ),
    );
  }

  close(retroId: string, summary?: string): Promise<RetroDetailView> {
    return firstValueFrom(
      this.http.post<RetroDetailView>(
        `${this.baseUrl}/retros/${retroId}/close`,
        { summary },
      ),
    );
  }
}
