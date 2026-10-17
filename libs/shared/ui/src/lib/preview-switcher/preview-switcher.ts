import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  getVibestandupLimits,
  type PlanKey,
} from '@silvervibe/shared/feature-flags';
import {
  PREVIEW_PLAN_KEYS,
  PREVIEW_WORKSPACE_ROLES,
  PreviewContextStore,
  type PreviewWorkspaceRole,
} from '@silvervibe/stores/preview';

@Component({
  selector: 'sv-preview-switcher',
  imports: [TranslocoPipe],
  templateUrl: './preview-switcher.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'contents',
  },
})
export class PreviewSwitcher {
  private readonly preview = inject(PreviewContextStore);

  readonly visible = this.preview.isEligible;
  readonly orgLabel = this.preview.orgLabel;
  readonly workspaceRole = this.preview.workspaceRole;
  readonly planKey = this.preview.planKey;
  readonly roles = PREVIEW_WORKSPACE_ROLES;
  readonly plans = PREVIEW_PLAN_KEYS;

  readonly planHint = computed(() => {
    const limits = getVibestandupLimits(this.preview.planKey());
    return {
      planKey: this.preview.planKey(),
      maxTeams: limits.maxTeams,
      maxMembersPerTeam: limits.maxMembersPerTeam,
    };
  });

  onRoleChange(event: Event): void {
    const value = (event.target as HTMLSelectElement)
      .value as PreviewWorkspaceRole;
    this.preview.setWorkspaceRole(value);
  }

  onPlanChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as PlanKey;
    this.preview.setPlanKey(value);
  }
}
