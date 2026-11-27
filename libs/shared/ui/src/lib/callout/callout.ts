import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type CalloutVariant = 'info' | 'tip' | 'warning';

/**
 * Calm inline guidance. Variant uses text + border; do not rely on color alone.
 */
@Component({
  selector: 'sv-callout',
  imports: [],
  templateUrl: './callout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
    role: 'note',
  },
})
export class Callout {
  readonly variant = input<CalloutVariant>('info');
  readonly title = input<string | null>(null);
  /** Plain body when not projecting content. */
  readonly body = input<string | null>(null);

  readonly variantLabel = computed(() => {
    switch (this.variant()) {
      case 'tip':
        return 'Tip';
      case 'warning':
        return 'Warning';
      default:
        return 'Info';
    }
  });

  readonly panelClass = computed(() => {
    const tone =
      this.variant() === 'tip'
        ? 'border-success/40 bg-success/10'
        : this.variant() === 'warning'
          ? 'border-warning/40 bg-warning/10'
          : 'border-info/40 bg-info/10';
    return `rounded-lg border px-3 py-2 text-sm text-base-content ${tone}`;
  });
}
