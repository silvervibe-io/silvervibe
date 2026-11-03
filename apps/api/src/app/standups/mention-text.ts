export type MentionSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'person'; text: string };

const MENTION =
  /\[([^[\]\n]{1,200})\]\((mention:user:[A-Za-z0-9_-]{1,128}|https:\/\/[^)\s]+)\)/g;

/** Split standup text into plain text, person names, and https links. */
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

/** Markdown digests: person tokens become bold names, issue links stay. */
export function mentionsToMarkdown(value: string): string {
  return value.replace(MENTION, (full, label: string, target: string) => {
    if (target.startsWith('mention:user:')) {
      return `**${label}**`;
    }
    if (target.startsWith('https://')) {
      return `[${label}](${target})`;
    }
    return full;
  });
}

function slackPlain(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '/');
}

/** Slack mrkdwn: person tokens become bold, https links become `<url|label>`. */
export function mentionsToSlack(value: string): string {
  return value.replace(MENTION, (full, label: string, target: string) => {
    if (target.startsWith('mention:user:')) {
      return `*${slackPlain(label)}*`;
    }
    if (target.startsWith('https://')) {
      return `<${target}|${slackPlain(label)}>`;
    }
    return full;
  });
}

type AdfNode = {
  type: 'text';
  text: string;
  marks?: Array<{ type: 'strong' } | { type: 'link'; attrs: { href: string } }>;
};

/** Jira ADF: person tokens are strong, https links are link marks. */
export function mentionsToAdf(value: string): {
  type: 'doc';
  version: 1;
  content: Array<{ type: 'paragraph'; content: AdfNode[] }>;
} {
  return {
    type: 'doc',
    version: 1,
    content: value.split('\n').map((line) => ({
      type: 'paragraph' as const,
      content: adfLine(line),
    })),
  };
}

function adfLine(line: string): AdfNode[] {
  const nodes: AdfNode[] = [];
  for (const segment of parseMentionSegments(line)) {
    if (segment.kind === 'person') {
      nodes.push({
        type: 'text',
        text: segment.text,
        marks: [{ type: 'strong' }],
      });
    } else if (segment.kind === 'link') {
      nodes.push({
        type: 'text',
        text: segment.text,
        marks: [{ type: 'link', attrs: { href: segment.href } }],
      });
    } else if (segment.text) {
      nodes.push({ type: 'text', text: segment.text });
    }
  }
  return nodes.length > 0 ? nodes : [{ type: 'text', text: ' ' }];
}
