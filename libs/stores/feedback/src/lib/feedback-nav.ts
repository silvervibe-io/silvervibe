export type FeedbackShellLink = {
  label: string;
  href: string;
};

export function feedbackShellLinks(
  translate: (key: string) => string,
): FeedbackShellLink[] {
  return [
    { label: translate('feedback.nav.requests'), href: '/app' },
    { label: translate('feedback.nav.create'), href: '/app/create' },
    { label: translate('feedback.nav.account'), href: '/account' },
  ];
}
