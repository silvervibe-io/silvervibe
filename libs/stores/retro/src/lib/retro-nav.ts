export type RetroShellLink = {
  label: string;
  href: string;
};

export function retroShellLinks(
  translate: (key: string) => string,
): RetroShellLink[] {
  return [
    { label: translate('retro.nav.retros'), href: '/app' },
    { label: translate('retro.nav.create'), href: '/app/create' },
    { label: translate('retro.nav.account'), href: '/account' },
  ];
}
