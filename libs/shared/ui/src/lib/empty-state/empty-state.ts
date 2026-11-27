import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

/**
 * Calm empty state with one primary action and optional secondary.
 */
@Component({
  selector: 'sv-empty-state',
  imports: [],
  templateUrl: './empty-state.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
  },
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly body = input<string | null>(null);
  readonly primaryLabel = input<string | null>(null);
  readonly secondaryLabel = input<string | null>(null);
  readonly primaryClick = output<void>();
  readonly secondaryClick = output<void>();
}
