import {
  mentionsToAdf,
  mentionsToMarkdown,
  mentionsToSlack,
  parseMentionSegments,
} from './mention-text';

const person = '[@Ada Lovelace](mention:user:user_1)';
const issue = '[PROJ-12 Ship it](https://example.atlassian.net/browse/PROJ-12)';

describe('mention text', () => {
  it('keeps unknown markup as text and accepts https and person tokens', () => {
    expect(
      parseMentionSegments(`see ${person} and ${issue} plus [x](http://nope)`),
    ).toEqual([
      { kind: 'text', text: 'see ' },
      { kind: 'person', text: '@Ada Lovelace' },
      { kind: 'text', text: ' and ' },
      {
        kind: 'link',
        text: 'PROJ-12 Ship it',
        href: 'https://example.atlassian.net/browse/PROJ-12',
      },
      { kind: 'text', text: ' plus [x](http://nope)' },
    ]);
  });

  it('rewrites people for markdown and leaves issue links', () => {
    expect(mentionsToMarkdown(`${person} ${issue}`)).toBe(
      `**@Ada Lovelace** ${issue}`,
    );
  });

  it('rewrites Slack mrkdwn links and bold names', () => {
    expect(mentionsToSlack(`A & B ${person} ${issue}`)).toBe(
      'A & B *@Ada Lovelace* <https://example.atlassian.net/browse/PROJ-12|PROJ-12 Ship it>',
    );
  });

  it('builds Jira link marks and strong person names', () => {
    expect(mentionsToAdf(`${person}\n${issue}`)).toEqual({
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '@Ada Lovelace',
              marks: [{ type: 'strong' }],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'PROJ-12 Ship it',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://example.atlassian.net/browse/PROJ-12',
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });
});
