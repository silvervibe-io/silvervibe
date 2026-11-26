export type FeedbackShellLink = {
  label: string;
  href: string;
  external?: boolean;
};

export function feedbackShellLinks(
  translate: (key: string) => string,
  portalHref?: string,
): FeedbackShellLink[] {
  const links: FeedbackShellLink[] = [];
  if (portalHref) {
    links.push({
      label: translate('nav.portal'),
      href: portalHref,
      external: true,
    });
  }
  links.push(
    { label: translate('feedback.nav.requests'), href: '/app' },
    { label: translate('feedback.nav.create'), href: '/app/create' },
    { label: translate('feedback.nav.account'), href: '/account' },
  );
  return links;
}
