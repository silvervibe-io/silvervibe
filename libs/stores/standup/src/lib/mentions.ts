export type MentionSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'person'; text: string };

export type MentionIssueView = {
  provider: 'github' | 'gitlab' | 'bitbucket' | 'trello' | 'jira' | 'linear';
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

function atName(label: string): string {
  const visible = mentionLabel(label).replace(/^@+/, '');
  return visible ? `@${visible}` : '';
}

function hashName(label: string): string {
  const visible = mentionLabel(label).replace(/^#+/, '');
  return visible ? `#${visible}` : '';
}

/** Person mention as `@Name`. */
export function personMention(name: string): string {
  return atName(name);
}

/** Issue mention as `#Name`. */
export function issueMention(name: string): string {
  return hashName(name);
}

/** Turns stored `[@Name](mention:user:…)` and `[Name](https://…)` tokens into `@Name` and `#Name`. */
export function plainMentions(value: string): string {
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
