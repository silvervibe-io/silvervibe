import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface ShellLink {
  label: string;
  href: string;
  external?: boolean;
}

@Component({
  selector: 'sv-shell',
  imports: [RouterLink],
  templateUrl: './shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
})
export class Shell {
  readonly title = input('Silvervibe');
  readonly links = input<ShellLink[]>([]);
}
