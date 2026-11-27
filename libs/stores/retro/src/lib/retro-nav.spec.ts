import { describe, expect, it } from 'vitest';
import { retroShellLinks } from './retro-nav';

describe('retroShellLinks', () => {
  it('builds app links from translation keys', () => {
    expect(retroShellLinks((key) => key)).toEqual([
      { label: 'retro.nav.retros', href: '/app' },
      { label: 'retro.nav.create', href: '/app/create' },
      { label: 'retro.nav.account', href: '/account' },
    ]);
  });

  it('prepends an external portal link when provided', () => {
    expect(
      retroShellLinks((key) => key, 'https://silvervibe.io/portal')[0],
    ).toEqual({
      label: 'nav.portal',
      href: 'https://silvervibe.io/portal',
      external: true,
    });
  });
});
