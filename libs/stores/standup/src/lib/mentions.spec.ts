import {
  activeMentionToken,
  issueMention,
  parseMentionSegments,
  personMention,
  plainMentions,
} from './mentions';

describe('mentions', () => {
  it('parses person tokens and https links only', () => {
    expect(
      parseMentionSegments(
        'see [@Ada](mention:user:user_1) [PROJ-1 Done](https://example.test/1) [x](http://nope)',
      ),
    ).toEqual([
      { kind: 'text', text: 'see ' },
      { kind: 'person', text: '@Ada' },
      { kind: 'text', text: ' ' },
      { kind: 'link', text: 'PROJ-1 Done', href: 'https://example.test/1' },
      { kind: 'text', text: ' [x](http://nope)' },
    ]);
  });

  it('builds @name and #name mentions', () => {
    expect(personMention('Ada [Lovelace]')).toBe('@Ada Lovelace');
    expect(issueMention('PROJ-12')).toBe('#PROJ-12');
    expect(
      plainMentions(
        'see [@Ada](mention:user:user_1) [PROJ-1 Done](https://example.test/1)',
      ),
    ).toBe('see @Ada #PROJ-1 Done');
  });

  it('finds the @ or # token at the caret', () => {
    expect(activeMentionToken('hello @ad', 9)).toEqual({
      kind: 'person',
      query: 'ad',
      start: 6,
    });
    expect(activeMentionToken('fix #12 later', 7)).toEqual({
      kind: 'issue',
      query: '12',
      start: 4,
    });
    expect(activeMentionToken('done @ada now', 13)).toBeNull();
  });
});
