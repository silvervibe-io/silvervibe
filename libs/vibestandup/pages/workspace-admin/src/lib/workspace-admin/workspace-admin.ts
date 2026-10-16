import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { API_BASE_URL } from '@silvervibe/shared/auth';
import { Shell } from '@silvervibe/shared/ui';
import { WorkspaceStore } from '@silvervibe/stores/workspace';
import { firstValueFrom } from 'rxjs';

type CreateTeamModel = {
  name: string;
  slug: string;
};

@Component({
  selector: 'vs-workspace-admin',
  imports: [FormField, RouterLink, Shell, TranslocoPipe],
  templateUrl: './workspace-admin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class WorkspaceAdmin implements OnInit {
  private readonly workspaces = inject(WorkspaceStore);
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  readonly loading = this.workspaces.loading;
  readonly error = this.workspaces.error;
  readonly memberships = this.workspaces.memberships;
  readonly selected = computed(() => this.workspaces.selectedWorkspace());
  readonly isAdmin = computed(() => this.workspaces.isWorkspaceAdmin());
  readonly tools = computed(() => this.selected()?.tools ?? []);
  readonly message = signal<string | null>(null);

  readonly teamModel = signal<CreateTeamModel>({ name: '', slug: '' });
  readonly teamForm = form(this.teamModel, (schemaPath) => {
    required(schemaPath.name);
    required(schemaPath.slug);
  });

  ngOnInit(): void {
    void this.workspaces.loadMyWorkspaces();
  }

  selectWorkspace(workspaceId: string): void {
    this.workspaces.selectWorkspace(workspaceId);
  }

  async toggleTool(toolKey: string, enabled: boolean): Promise<void> {
    const ws = this.selected();
    if (!ws || !this.isAdmin()) {
      return;
    }
    await firstValueFrom(
      this.http.put(`${this.apiBase}/workspaces/${ws.id}/tools/${toolKey}`, {
        enabled,
      }),
    );
    await this.workspaces.loadMyWorkspaces();
    this.workspaces.selectWorkspace(ws.id);
    this.message.set('standup.workspace.toolUpdated');
  }

  async createTeam(event: Event): Promise<void> {
    event.preventDefault();
    const ws = this.selected();
    if (!ws || !this.isAdmin()) {
      return;
    }
    await submit(this.teamForm, {
      action: async () => {
        const body = this.teamModel();
        await firstValueFrom(
          this.http.post(`${this.apiBase}/workspaces/${ws.id}/teams`, body),
        );
        this.teamModel.set({ name: '', slug: '' });
        this.message.set('standup.workspace.teamCreated');
        return undefined;
      },
    });
  }
}
