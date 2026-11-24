export type PollShellLink = {
  label: string;
  href: string;
};

export function pollShellLinks(
  translate: (key: string) => string,
): PollShellLink[] {
  return [
    { label: translate('poll.nav.polls'), href: '/app' },
    { label: translate('poll.nav.create'), href: '/app/create' },
    { label: translate('poll.nav.account'), href: '/account' },
  ];
}
