import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  parseSummaryBlocks,
  SummaryBlocks,
  type SummaryBlock,
  type SummaryInline,
} from '../mention-text/mention-text';

export type SummarySectionKind =
  | 'title'
  | 'help'
  | 'today'
  | 'yesterday'
  | 'other';

export interface SummarySection {
  kind: SummarySectionKind;
  title: string;
  blocks: SummaryBlock[];
}

function inlineText(inlines: SummaryInline[]): string {
  return inlines
    .map((part) => part.text)
    .join('')
    .trim();
}

function sectionKind(title: string): SummarySectionKind {
  const key = title.trim().toLowerCase();
  if (key === 'needs help' || key === 'blockers') {
    return 'help';
  }
  if (key === 'today') {
    return 'today';
  }
  if (key === 'yesterday') {
    return 'yesterday';
  }
  return 'other';
}

/** Puts Needs help, then Today, then Yesterday. Older Blockers headings count as help. */
export function groupSummarySections(value: string): SummarySection[] {
  const sections: SummarySection[] = [];
  let current: SummarySection | null = null;
  for (const block of parseSummaryBlocks(value)) {
    if (block.kind === 'heading' && (block.level === 2 || block.level === 3)) {
      if (current) {
        sections.push(current);
      }
      const title = inlineText(block.inlines);
      current = {
        kind: block.level === 2 ? 'title' : sectionKind(title),
        title,
        blocks: [],
      };
      continue;
    }
    current ??= { kind: 'other', title: '', blocks: [] };
    current.blocks.push(block);
  }
  if (current) {
    sections.push(current);
  }
  const titles = sections.filter((section) => section.kind === 'title');
  const rest = sections.filter((section) => section.kind !== 'title');
  const order: SummarySectionKind[] = ['help', 'today', 'yesterday', 'other'];
  return [
    ...titles,
    ...order.flatMap((kind) => rest.filter((section) => section.kind === kind)),
  ].filter((section) => section.kind === 'title' || section.blocks.length > 0);
}

@Component({
  selector: 'sv-standup-summary',
  imports: [SummaryBlocks, TranslocoPipe],
  templateUrl: './standup-summary.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StandupSummary {
  readonly text = input.required<string>();
  readonly sections = computed(() => groupSummarySections(this.text()));
}
