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
});
