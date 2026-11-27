import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LangSwitch, ThemeToggle } from '@silvervibe/shared/ui';

@Component({
  selector: 'sv-terms',
  imports: [RouterLink, TranslocoPipe, LangSwitch, ThemeToggle],
  templateUrl: './terms.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen bg-base-100 text-base-content',
  },
})
export class Terms {}
