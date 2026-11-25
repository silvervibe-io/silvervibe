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
import { RetroFacade } from '@silvervibe/stores/retro';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { RetroShellLinks } from '../retro-shell-links';

@Component({
  selector: 'vr-retro-list',
  imports: [RouterLink, Shell, TranslocoPipe],
  templateUrl: './retro-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class RetroList implements OnInit {
  private readonly retros = inject(RetroFacade);
  private readonly workspaces = inject(WorkspaceFacade);
  private readonly shellLinks = inject(RetroShellLinks);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly links = this.shellLinks.links;
  readonly loading = this.retros.loading;
  readonly error = this.retros.error;
  readonly items = this.retros.retros;
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
    await this.retros.loadRetros(workspaceId);
  }
}
