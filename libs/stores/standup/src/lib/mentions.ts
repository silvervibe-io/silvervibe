export type MentionSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'person'; text: string };

export type MentionIssueView = {
  provider: 'github' | 'jira' | 'linear';
  key: string;
  title: string;
  url: string;
};

const MENTION =
  /\[([^[\]\n]{1,200})\]\((mention:user:[A-Za-z0-9_-]{1,128}|https:\/\/[^)\s]+)\)/g;

export function parseMentionSegments(value: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let last = 0;
  for (const match of value.matchAll(MENTION)) {
    const index = match.index ?? 0;
    if (index > last) {
      segments.push({ kind: 'text', text: value.slice(last, index) });
    }
    const label = match[1] ?? '';
    const target = match[2] ?? '';
    if (target.startsWith('mention:user:')) {
      segments.push({ kind: 'person', text: label });
    } else if (target.startsWith('https://')) {
      segments.push({ kind: 'link', text: label, href: target });
    }
    last = index + match[0].length;
  }
  if (last < value.length || segments.length === 0) {
    segments.push({ kind: 'text', text: value.slice(last) });
  }
  return segments;
}

export function mentionLabel(value: string): string {
  return value
    .replace(/[[\]()\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function personMention(userId: string, name: string): string {
  const safeId = userId.replace(/[^A-Za-z0-9_-]/g, '');
  const visible = mentionLabel(name).replace(/^@/, '');
  return `[@${visible}](mention:user:${safeId})`;
}

export function issueMention(label: string, url: string): string {
  if (!url.startsWith('https://')) {
    return mentionLabel(label);
  }
  return `[${mentionLabel(label)}](${url})`;
}

export function activeMentionToken(
  value: string,
  caret: number,
): { kind: 'person' | 'issue'; query: string; start: number } | null {
  const upto = value.slice(0, Math.max(0, caret));
  const match = /(?:^|\s)([@#])([^\s@#]*)$/.exec(upto);
  if (!match) {
    return null;
  }
  const query = match[2] ?? '';
  const start = caret - query.length - 1;
  if (start < 0) {
    return null;
  }
  return {
    kind: match[1] === '@' ? 'person' : 'issue',
    query,
    start,
  };
}
