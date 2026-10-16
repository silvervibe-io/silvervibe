import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Shell } from '@silvervibe/shared/ui';

@Component({
  selector: 'sv-about',
  imports: [RouterLink, Shell, TranslocoPipe],
  templateUrl: './about.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class About {}
