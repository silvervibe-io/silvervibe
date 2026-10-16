import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { STANDUP_APP_ORIGIN } from '@silvervibe/shared/auth';
import { Shell } from '@silvervibe/shared/ui';

@Component({
  selector: 'sv-tools-vibestandup',
  imports: [RouterLink, Shell, TranslocoPipe],
  templateUrl: './tools-vibestandup.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class ToolsVibestandup {
  readonly standupOrigin = inject(STANDUP_APP_ORIGIN, { optional: true }) ?? '';
}
