import { describe, expect, it } from 'vitest';
import { pollShellLinks } from './poll-nav';

describe('pollShellLinks', () => {
  it('builds app links from translation keys', () => {
    expect(pollShellLinks((key) => key)).toEqual([
      { label: 'poll.nav.polls', href: '/app' },
      { label: 'poll.nav.create', href: '/app/create' },
      { label: 'poll.nav.account', href: '/account' },
    ]);
  });
});
