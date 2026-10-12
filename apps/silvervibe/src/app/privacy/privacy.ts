import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LangSwitch } from '@silvervibe/shared/ui';

@Component({
  selector: 'sv-privacy',
  imports: [RouterLink, TranslocoPipe, LangSwitch],
  templateUrl: './privacy.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class Privacy {}
