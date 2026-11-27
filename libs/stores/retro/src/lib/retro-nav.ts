export type RetroShellLink = {
  label: string;
  href: string;
  external?: boolean;
};

export function retroShellLinks(
  translate: (key: string) => string,
  portalHref?: string,
): RetroShellLink[] {
  const links: RetroShellLink[] = [];
  if (portalHref) {
    links.push({
      label: translate('nav.portal'),
      href: portalHref,
      external: true,
    });
  }
  links.push(
    { label: translate('retro.nav.retros'), href: '/app' },
    { label: translate('retro.nav.create'), href: '/app/create' },
    { label: translate('retro.nav.account'), href: '/account' },
  );
  return links;
}
