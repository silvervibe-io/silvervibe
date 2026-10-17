/** Public asset paths for shared UI SVGs (copied into each app as `/icons` and `/brand`). */
export const UI_ICON = {
  sun: 'icons/sun.svg',
  moon: 'icons/moon.svg',
  google: 'icons/google.svg',
  github: 'icons/github.svg',
} as const;

export const UI_BRAND = {
  mark: 'brand/mark.svg',
  markDark: 'brand/mark-dark.svg',
  logo: 'brand/logo.svg',
  logoDark: 'brand/logo-dark.svg',
  logoLg: 'brand/logo-lg.svg',
} as const;

export type UiIconName = keyof typeof UI_ICON;
