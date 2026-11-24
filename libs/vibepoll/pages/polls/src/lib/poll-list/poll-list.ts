import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Shell } from '@silvervibe/shared/ui';
import { PollFacade } from '@silvervibe/stores/poll';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { PollShellLinks } from '../poll-shell-links';

@Component({
  selector: 'vp-poll-list',
  imports: [RouterLink, Shell, TranslocoPipe],
  templateUrl: './poll-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class PollList implements OnInit {
  private readonly polls = inject(PollFacade);
  private readonly workspaces = inject(WorkspaceFacade);
  private readonly shellLinks = inject(PollShellLinks);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly links = this.shellLinks.links;
  readonly loading = this.polls.loading;
  readonly error = this.polls.error;
  readonly items = this.polls.polls;
  readonly workspaceName = computed(
    () => this.workspaces.selectedWorkspace()?.name ?? '',
  );

  async ngOnInit(): Promise<void> {
    const enter = this.route.snapshot.queryParamMap.get('enter') === '1';
    const requestedWorkspaceId =
      this.route.snapshot.queryParamMap.get('workspaceId');
    await this.workspaces.loadMyWorkspaces(requestedWorkspaceId);
    if (enter) {
      await this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { enter: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    const workspaceId = this.workspaces.selectedWorkspaceId();
    if (!workspaceId) {
      return;
    }
    await this.polls.loadPolls(workspaceId);
  }
}
