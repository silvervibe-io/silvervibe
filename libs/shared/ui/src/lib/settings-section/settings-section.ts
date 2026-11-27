import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * One-job settings band: title, purpose, optional learn-more, content, save when dirty.
 */
@Component({
  selector: 'sv-settings-section',
  imports: [],
  templateUrl: './settings-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block space-y-4',
  },
})
export class SettingsSection {
  readonly title = input.required<string>();
  /** One-sentence purpose under the title. */
  readonly purpose = input<string | null>(null);
  /** Longer guidance shown in a disclosure. */
  readonly learnMore = input<string | null>(null);
  readonly learnMoreLabel = input('Learn more');
  readonly dirty = input(false);
  readonly saving = input(false);
  readonly saveLabel = input('Save');
  readonly saveDisabled = input(false);
  readonly save = output<void>();

  readonly learnOpen = signal(false);

  toggleLearnMore(): void {
    this.learnOpen.update((open) => !open);
  }

  onSave(): void {
    if (this.saving() || this.saveDisabled()) {
      return;
    }
    this.save.emit();
  }
}
