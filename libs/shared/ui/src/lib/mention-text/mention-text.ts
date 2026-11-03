import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type MentionSegmentView =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'person'; text: string };

@Component({
  selector: 'sv-mention-text',
  templateUrl: './mention-text.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MentionText {
  readonly segments = input.required<MentionSegmentView[]>();
}
