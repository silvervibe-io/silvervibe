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
import { MeetingFacade } from '@silvervibe/stores/meeting';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { MeetingShellLinks } from '../meeting-shell-links';

@Component({
  selector: 'vm-meeting-list',
  imports: [RouterLink, Shell, TranslocoPipe],
  templateUrl: './meeting-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class MeetingList implements OnInit {
  private readonly meetingFacade = inject(MeetingFacade);
  private readonly workspaces = inject(WorkspaceFacade);
  private readonly shellLinks = inject(MeetingShellLinks);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly links = this.shellLinks.links;
  readonly loading = this.meetingFacade.loading;
  readonly error = this.meetingFacade.error;
  readonly items = this.meetingFacade.meetings;
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
    await this.meetingFacade.loadMeetings(workspaceId);
  }
}
