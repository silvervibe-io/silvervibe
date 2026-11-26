export type MeetingShellLink = {
  label: string;
  href: string;
  external?: boolean;
};

export function meetingShellLinks(
  translate: (key: string) => string,
  portalHref?: string,
): MeetingShellLink[] {
  const links: MeetingShellLink[] = [];
  if (portalHref) {
    links.push({
      label: translate('nav.portal'),
      href: portalHref,
      external: true,
    });
  }
  links.push(
    { label: translate('meeting.nav.meetings'), href: '/app' },
    { label: translate('meeting.nav.create'), href: '/app/create' },
    { label: translate('meeting.nav.account'), href: '/account' },
  );
  return links;
}
