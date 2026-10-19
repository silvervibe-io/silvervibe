import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Shell } from '@silvervibe/shared/ui';
import { StandupFacade } from '@silvervibe/stores/standup';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';

@Component({
  selector: 'vs-invite-accept',
  imports: [RouterLink, Shell, TranslocoPipe],
  templateUrl: './invite-accept.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class InviteAccept implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly standup = inject(StandupFacade);
  private readonly workspaces = inject(WorkspaceFacade);

  readonly busy = signal(true);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.error.set('standup.invite.missingToken');
      this.busy.set(false);
      return;
    }

    try {
      const result = await this.standup.acceptInvite(token);
      await this.workspaces.loadMyWorkspaces();
      this.workspaces.selectWorkspace(result.workspaceId);
      this.success.set(true);
    } catch (err: unknown) {
      this.error.set(
        err instanceof Error ? err.message : 'standup.invite.acceptFailed',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
