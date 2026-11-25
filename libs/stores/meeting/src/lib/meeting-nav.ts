export type MeetingShellLink = {
  label: string;
  href: string;
};

export function meetingShellLinks(
  translate: (key: string) => string,
): MeetingShellLink[] {
  return [
    { label: translate('meeting.nav.meetings'), href: '/app' },
    { label: translate('meeting.nav.create'), href: '/app/create' },
    { label: translate('meeting.nav.account'), href: '/account' },
  ];
}
