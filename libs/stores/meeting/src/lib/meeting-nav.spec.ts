import { describe, expect, it } from 'vitest';
import { meetingShellLinks } from './meeting-nav';

describe('meetingShellLinks', () => {
  it('returns nav links with translated labels', () => {
    const links = meetingShellLinks((key) => key);
    expect(links).toEqual([
      { label: 'meeting.nav.meetings', href: '/app' },
      { label: 'meeting.nav.create', href: '/app/create' },
      { label: 'meeting.nav.account', href: '/account' },
    ]);
  });
});
