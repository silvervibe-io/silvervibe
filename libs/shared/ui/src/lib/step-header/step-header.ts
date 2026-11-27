import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * Wizard progress: “Step x of y · next: …”
 */
@Component({
  selector: 'sv-step-header',
  imports: [],
  templateUrl: './step-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block space-y-1',
  },
})
export class StepHeader {
  readonly step = input.required<number>();
  readonly total = input.required<number>();
  readonly title = input.required<string>();
  readonly nextLabel = input<string | null>(null);

  readonly progressLabel = computed(
    () => `Step ${this.step()} of ${this.total()}`,
  );
}
