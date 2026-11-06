import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type SummaryInline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'person'; text: string };

export type SummaryBlock =
  | { kind: 'heading'; level: 2 | 3; inlines: SummaryInline[] }
  | { kind: 'paragraph'; inlines: SummaryInline[] }
  | { kind: 'list'; items: SummaryInline[][] };

const MENTION =
  /\[([^[\]\n]{1,200})\]\((mention:user:[A-Za-z0-9_-]{1,128}|https:\/\/[^)\s]+)\)/g;
const BOLD = /\*\*([^*\n]+)\*\*/g;

function atName(label: string): string {
  const visible = label
    .replace(/[[\]()\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^@+/, '');
  return visible ? `@${visible}` : '';
}

function hashName(label: string): string {
  const visible = label
    .replace(/[[\]()\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^#+/, '');
  return visible ? `#${visible}` : '';
}

function plainMentions(value: string): string {
  return value.replace(MENTION, (full, label: string, target: string) => {
    if (target.startsWith('mention:user:')) {
      return atName(label) || full;
    }
    if (target.startsWith('https://')) {
      return hashName(label) || full;
    }
    return full;
  });
}

/** Safe blocks for a standup summary: headings, lists, bold, @names, and #names. */
export function parseSummaryBlocks(value: string): SummaryBlock[] {
  const blocks: SummaryBlock[] = [];
  let list: SummaryInline[][] | null = null;
  const flushList = (): void => {
    if (list && list.length > 0) {
      blocks.push({ kind: 'list', items: list });
    }
    list = null;
  };
  for (const line of plainMentions(value).replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim()) {
      flushList();
      continue;
    }
    const heading = /^(#{2,3}) (.+)$/.exec(line);
    if (heading) {
      flushList();
      blocks.push({
        kind: 'heading',
        level: heading[1]?.length === 2 ? 2 : 3,
        inlines: parseInlines(heading[2] ?? ''),
      });
      continue;
    }
    const item = /^- (.+)$/.exec(line);
    if (item) {
      list = list ?? [];
      list.push(parseInlines(item[1] ?? ''));
      continue;
    }
    flushList();
    blocks.push({ kind: 'paragraph', inlines: parseInlines(line) });
  }
  flushList();
  return blocks;
}

function parseInlines(value: string): SummaryInline[] {
  const inlines: SummaryInline[] = [];
  let last = 0;
  for (const match of value.matchAll(MENTION)) {
    const index = match.index ?? 0;
    if (index > last) {
      inlines.push(...parseBold(value.slice(last, index)));
    }
    const label = match[1] ?? '';
    const target = match[2] ?? '';
    if (target.startsWith('mention:user:')) {
      inlines.push({ kind: 'person', text: label });
    } else if (target.startsWith('https://')) {
      inlines.push({ kind: 'link', text: label, href: target });
    }
    last = index + match[0].length;
  }
  if (last < value.length) {
    inlines.push(...parseBold(value.slice(last)));
  }
  return inlines.length > 0 ? inlines : [{ kind: 'text', text: '' }];
}

function parseBold(value: string): SummaryInline[] {
  const inlines: SummaryInline[] = [];
  let last = 0;
  for (const match of value.matchAll(BOLD)) {
    const index = match.index ?? 0;
    if (index > last) {
      inlines.push({ kind: 'text', text: value.slice(last, index) });
    }
    inlines.push({ kind: 'bold', text: match[1] ?? '' });
    last = index + match[0].length;
  }
  if (last < value.length || inlines.length === 0) {
    inlines.push({ kind: 'text', text: value.slice(last) });
  }
  return inlines;
}

@Component({
  selector: 'sv-summary-inlines',
  templateUrl: './summary-inlines.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryInlines {
  readonly parts = input.required<SummaryInline[]>();
}

@Component({
  selector: 'sv-summary-blocks',
  imports: [SummaryInlines],
  templateUrl: './summary-blocks.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryBlocks {
  readonly blocks = input.required<SummaryBlock[]>();
}

@Component({
  selector: 'sv-mention-text',
  imports: [SummaryBlocks],
  templateUrl: './mention-text.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MentionText {
  readonly text = input.required<string>();
  readonly blocks = computed(() => parseSummaryBlocks(this.text()));
}
