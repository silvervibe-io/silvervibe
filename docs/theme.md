# Design system / theme foundation

Issue: [#2](https://github.com/silvervibe-io/silvervibe/issues/2).

## Goals

- **Light-first**, with a first-class **dark** theme
- Calm, clear, user-friendly (soft contrast, high readability — not neon/purple glow)
- Shared tokens via daisyUI + CSS variables; new product UI should use semantic colors (`bg-base-100`, `text-base-content`, `btn-primary`, …)

The public **landing** may keep bespoke marketing colors until an explicit landing redesign. Authenticated / shell screens should use the theme.

## Themes

| `data-theme`      | Mode  | Role                        |
| ----------------- | ----- | --------------------------- |
| `silvervibe`      | Light | Default                     |
| `silvervibe-dark` | Dark  | `prefersdark` + user toggle |

Source: `libs/shared/ui/src/styles/silvervibe-themes.css`

## How apps opt in

1. In `styles.css`:

```css
@import 'tailwindcss';
@plugin "daisyui" {
  themes: false;
}
@import '../../../libs/shared/ui/src/styles/silvervibe-themes.css';
@source '../';
@source '../../../libs';
```

2. In `app.config.ts`, add `provideSilvervibeTheme()` from `@silvervibe/shared/ui`.
3. Prefer `sv-shell` for app chrome (includes a light/dark toggle).
4. Set `<html data-theme="silvervibe">` in `index.html` to avoid a flash before JS runs.

## Runtime API

```ts
import { ThemeService, provideSilvervibeTheme } from '@silvervibe/shared/ui';

inject(ThemeService).toggle(); // or setMode('dark' | 'light')
```

Preference is stored in `localStorage` under `silvervibe.theme`.

## Checklist (acceptance #2)

- [ ] Both apps import shared theme CSS
- [ ] `provideSilvervibeTheme()` registered
- [ ] Shell toggle switches `data-theme` between `silvervibe` and `silvervibe-dark`
- [ ] New screens use daisyUI semantic colors (not one-off greys for content UI)
