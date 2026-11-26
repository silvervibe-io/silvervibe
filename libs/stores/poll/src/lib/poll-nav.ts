export type PollShellLink = {
  label: string;
  href: string;
  external?: boolean;
};

export function pollShellLinks(
  translate: (key: string) => string,
  portalHref?: string,
): PollShellLink[] {
  const links: PollShellLink[] = [];
  if (portalHref) {
    links.push({
      label: translate('nav.portal'),
      href: portalHref,
      external: true,
    });
  }
  links.push(
    { label: translate('poll.nav.polls'), href: '/app' },
    { label: translate('poll.nav.create'), href: '/app/create' },
    { label: translate('poll.nav.account'), href: '/account' },
  );
  return links;
}
