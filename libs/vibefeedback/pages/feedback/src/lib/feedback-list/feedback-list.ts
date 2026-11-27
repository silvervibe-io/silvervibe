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
import { FeedbackFacade } from '@silvervibe/stores/feedback';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { FeedbackShellLinks } from '../feedback-shell-links';

@Component({
  selector: 'vf-feedback-list',
  imports: [RouterLink, Shell, TranslocoPipe],
  templateUrl: './feedback-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class FeedbackList implements OnInit {
  private readonly feedback = inject(FeedbackFacade);
  private readonly workspaces = inject(WorkspaceFacade);
  private readonly shellLinks = inject(FeedbackShellLinks);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly links = this.shellLinks.links;
  readonly loading = this.feedback.loading;
  readonly error = this.feedback.error;
  readonly items = this.feedback.requests;
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
    await this.feedback.loadRequests(workspaceId);
  }
}
