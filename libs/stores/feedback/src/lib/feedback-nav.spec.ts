import { describe, expect, it } from 'vitest';
import { feedbackShellLinks } from './feedback-nav';

describe('feedbackShellLinks', () => {
  it('returns nav links with translated labels', () => {
    const links = feedbackShellLinks((key) => key);
    expect(links).toEqual([
      { label: 'feedback.nav.requests', href: '/app' },
      { label: 'feedback.nav.create', href: '/app/create' },
      { label: 'feedback.nav.account', href: '/account' },
    ]);
  });

  it('prepends an external portal link when provided', () => {
    const links = feedbackShellLinks(
      (key) => key,
      'https://silvervibe.io/portal',
    );
    expect(links[0]).toEqual({
      label: 'nav.portal',
      href: 'https://silvervibe.io/portal',
      external: true,
    });
  });
});
